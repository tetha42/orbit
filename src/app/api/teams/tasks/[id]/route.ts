import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import {
	addTaskItem,
	addTaskComment,
	deleteTaskItem,
	deleteTaskComment,
	getTaskItem,
	getTaskComment,
	getTeamTaskDetail,
	updateTaskItem,
	updateTeamTask,
	getPgPool,
	type TeamTaskPatch,
} from '@/db';
import { publishEventQuiet } from '@/db/events';
import { requireApp } from '@/lib/auth/access';
import {
	DESCRIPTION_MAX,
	TITLE_MAX,
	ITEM_MAX,
	COMMENT_MAX,
	normalizeTags,
	normalizePriority,
	normalizeDueDate,
} from '@/lib/kanban';
import { badRequest, forbidden, getTaskAccess, isAssignable, notFound } from '@/server/taskAccess';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** The task with its checklist, discussion and history — for whoever can see the board. */
export async function GET(request: Request, { params }: Params) {
	const auth = await requireApp(request, 'teams', 'kullan');
	if (!auth.authorized) return auth.response;
	try {
		const { id } = await params;
		const access = await getTaskAccess(auth.user, id);
		if (!access || !access.view) return notFound();
		const detail = await getTeamTaskDetail(id);
		if (!detail) return notFound();
		return NextResponse.json({
			...detail,
			// What the sheet should offer; the server checks again on every write.
			permissions: { manage: access.manage, work: access.work, comment: access.view },
		});
	} catch (error) {
		console.error('API /api/takimlar/gorevler GET error:', error);
		return NextResponse.json({ error: 'Görev okunamadı.' }, { status: 500 });
	}
}

/**
 * Edits a task. Management and the captain may change anything; the assignee may
 * change the description and labels of their own task, not who owns it or when
 * it is due.
 */
async function handlePATCH(request: Request, { params }: Params) {
	const auth = await requireApp(request, 'teams', 'kullan');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'mezun') return forbidden('Mezunlar sadece okuma erişimine sahiptir.');
	try {
		const { id } = await params;
		const access = await getTaskAccess(auth.user, id);
		if (!access || !access.view) return notFound();

		const body = (await request.json()) as Record<string, unknown>;
		const patch: TeamTaskPatch = {};

		if (body.title !== undefined) {
			if (typeof body.title !== 'string' || !body.title.trim()) return badRequest('Başlık boş olamaz.');
			if (body.title.trim().length > TITLE_MAX) return badRequest(`Başlık en fazla ${TITLE_MAX} karakter olabilir.`);
			patch.title = body.title.trim();
		}
		if (body.description !== undefined) {
			if (typeof body.description !== 'string') return badRequest('Geçersiz açıklama.');
			if (body.description.length > DESCRIPTION_MAX) return badRequest(`Açıklama en fazla ${DESCRIPTION_MAX} karakter olabilir.`);
			patch.description = body.description.trim();
		}
		if (body.priority !== undefined) {
			const priority = normalizePriority(body.priority);
			if (!priority) return badRequest('Geçersiz öncelik.');
			patch.priority = priority;
		}
		if (body.tags !== undefined) {
			const tags = normalizeTags(body.tags);
			if (!tags) return badRequest('Etiketler bir metin listesi olmalıdır.');
			patch.tags = tags;
		}
		if (body.dueDate !== undefined) {
			const due = normalizeDueDate(body.dueDate);
			if (due === undefined) return badRequest('Geçersiz teslim tarihi.');
			patch.dueDate = due;
		}
		let claimingFromPool = false;
		if (body.assigneeMemberId !== undefined) {
			const assignee = typeof body.assigneeMemberId === 'string' && body.assigneeMemberId ? body.assigneeMemberId : null;
			// Taking an unassigned task from the pool is open to any team member;
			// every other ownership change belongs to management and the captain.
			claimingFromPool = assignee === auth.user.id && !access.task.assigneeMemberId;
			if (!access.manage && !claimingFromPool) {
				return forbidden('Görev atamasını yalnızca yönetim veya takım kaptanı değiştirebilir.');
			}
			if (assignee && !isAssignable(access, assignee)) return badRequest('Görev yalnızca takım üyelerine atanabilir.');
			patch.assigneeMemberId = assignee;
		}

		if (!access.manage) {
			const fields = Object.keys(patch) as (keyof TeamTaskPatch)[];
			const onlyClaim = claimingFromPool && fields.length === 1;
			// The assignee may refine the description and labels of their own task.
			const assigneeEdit = access.work && fields.every((f) => f === 'description' || f === 'tags' || (f === 'assigneeMemberId' && claimingFromPool));
			if (!onlyClaim && !assigneeEdit) {
				return forbidden(
					access.work
						? 'Başlık, öncelik ve teslim tarihini yalnızca yönetim veya takım kaptanı değiştirebilir.'
						: 'Bu görevi düzenleme yetkiniz yok.'
				);
			}
		}

		const task = await updateTeamTask(id, patch, auth.user.id);
		if (!task) return notFound();
		await publishEventQuiet(getPgPool(), { k: 'team_updated', teamId: access.task.teamId });
		return NextResponse.json({ success: true, task });
	} catch (error) {
		console.error('API /api/takimlar/gorevler PATCH error:', error);
		return NextResponse.json({ error: 'Görev güncellenemedi.' }, { status: 500 });
	}
}

/** Checklist lines and comments: `{ action: 'addItem' | 'updateItem' | 'deleteItem' | 'addComment' | 'deleteComment' }`. */
async function handlePOST(request: Request, { params }: Params) {
	const auth = await requireApp(request, 'teams', 'kullan');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'mezun') return forbidden('Mezunlar sadece okuma erişimine sahiptir.');
	try {
		const { id } = await params;
		// The task, and through it the team, comes from the URL — never from the body.
		const access = await getTaskAccess(auth.user, id);
		if (!access || !access.view) return notFound();

		const body = (await request.json()) as Record<string, unknown>;
		const action = body.action;

		if (action === 'addItem' || action === 'updateItem' || action === 'deleteItem') {
			if (!access.work) return forbidden('Kontrol listesini yalnızca görevin sahibi, kaptan veya yönetim değiştirebilir.');

			if (action === 'addItem') {
				const text = typeof body.text === 'string' ? body.text.trim() : '';
				if (!text) return badRequest('Madde metni boş olamaz.');
				if (text.length > ITEM_MAX) return badRequest(`Madde en fazla ${ITEM_MAX} karakter olabilir.`);
				const item = await addTaskItem(id, text, auth.user.id);
				await publishEventQuiet(getPgPool(), { k: 'team_updated', teamId: access.task.teamId });
				return NextResponse.json({ success: true, item });
			}

			const itemId = typeof body.itemId === 'string' ? body.itemId : '';
			const item = itemId ? await getTaskItem(itemId) : null;
			// A line from another task is "not found" here, not "forbidden".
			if (!item || item.taskId !== id) return NextResponse.json({ error: 'Madde bulunamadı.' }, { status: 404 });

			if (action === 'deleteItem') {
				await deleteTaskItem(itemId);
				await publishEventQuiet(getPgPool(), { k: 'team_updated', teamId: access.task.teamId });
				return NextResponse.json({ success: true });
			}

			const patch: { text?: string; doneMi?: boolean } = {};
			if (body.text !== undefined) {
				const text = typeof body.text === 'string' ? body.text.trim() : '';
				if (!text) return badRequest('Madde metni boş olamaz.');
				if (text.length > ITEM_MAX) return badRequest(`Madde en fazla ${ITEM_MAX} karakter olabilir.`);
				patch.text = text;
			}
			if (body.doneMi !== undefined) {
				if (typeof body.doneMi !== 'boolean') return badRequest('Geçersiz değer.');
				patch.doneMi = body.doneMi;
			}
			await updateTaskItem(itemId, patch, auth.user.id);
			await publishEventQuiet(getPgPool(), { k: 'team_updated', teamId: access.task.teamId });
			return NextResponse.json({ success: true });
		}

		if (action === 'addComment') {
			const content = typeof body.content === 'string' ? body.content.trim() : '';
			if (!content) return badRequest('Yorum boş olamaz.');
			if (content.length > COMMENT_MAX) return badRequest(`Yorum en fazla ${COMMENT_MAX} karakter olabilir.`);
			const comment = await addTaskComment(id, auth.user.id, content);
			await publishEventQuiet(getPgPool(), { k: 'team_updated', teamId: access.task.teamId });
			return NextResponse.json({
				success: true,
				comment: { ...comment, userNameSurname: `${auth.user.name} ${auth.user.surname}` },
			});
		}

		if (action === 'deleteComment') {
			const commentId = typeof body.commentId === 'string' ? body.commentId : '';
			const comment = commentId ? await getTaskComment(commentId) : null;
			if (!comment || comment.taskId !== id) return NextResponse.json({ error: 'Yorum bulunamadı.' }, { status: 404 });
			// Your own words, or moderation by management and the captain.
			if (comment.userId !== auth.user.id && !access.manage) {
				return forbidden('Bu yorumu yalnızca yazarı, kaptan veya yönetim silebilir.');
			}
			await deleteTaskComment(commentId);
			await publishEventQuiet(getPgPool(), { k: 'team_updated', teamId: access.task.teamId });
			return NextResponse.json({ success: true });
		}

		return badRequest('Geçersiz işlem.');
	} catch (error) {
		console.error('API /api/takimlar/gorevler POST error:', error);
		return NextResponse.json({ error: 'İşlem tamamlanamadı.' }, { status: 500 });
	}
}

export const POST = withAudit(handlePOST, { action: 'teams.tasks.item.create', target: 'teams.tasks.item' });
export const PATCH = withAudit(handlePATCH, { action: 'teams.tasks.item.update', target: 'teams.tasks.item' });
