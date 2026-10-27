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
import { publishEventQuiet } from '@/db/olaylar';
import { requireApp } from '@/lib/auth/access';
import {
	ACIKLAMA_MAX,
	BASLIK_MAX,
	MADDE_MAX,
	YORUM_MAX,
	normalizeEtiketler,
	normalizeOncelik,
	normalizeTeslimTarihi,
} from '@/lib/kanban';
import { badRequest, forbidden, getTaskAccess, isAssignable, notFound } from '@/lib/server/taskAccess';

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
		const detay = await getTeamTaskDetail(id);
		if (!detay) return notFound();
		return NextResponse.json({
			...detay,
			// What the sheet should offer; the server checks again on every write.
			izinler: { manage: access.manage, work: access.work, comment: access.view },
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
export async function PATCH(request: Request, { params }: Params) {
	const auth = await requireApp(request, 'teams', 'kullan');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'mezun') return forbidden('Mezunlar sadece okuma erişimine sahiptir.');
	try {
		const { id } = await params;
		const access = await getTaskAccess(auth.user, id);
		if (!access || !access.view) return notFound();

		const body = (await request.json()) as Record<string, unknown>;
		const patch: TeamTaskPatch = {};

		if (body.baslik !== undefined) {
			if (typeof body.baslik !== 'string' || !body.baslik.trim()) return badRequest('Başlık boş olamaz.');
			if (body.baslik.trim().length > BASLIK_MAX) return badRequest(`Başlık en fazla ${BASLIK_MAX} karakter olabilir.`);
			patch.baslik = body.baslik.trim();
		}
		if (body.aciklama !== undefined) {
			if (typeof body.aciklama !== 'string') return badRequest('Geçersiz açıklama.');
			if (body.aciklama.length > ACIKLAMA_MAX) return badRequest(`Açıklama en fazla ${ACIKLAMA_MAX} karakter olabilir.`);
			patch.aciklama = body.aciklama.trim();
		}
		if (body.oncelik !== undefined) {
			const oncelik = normalizeOncelik(body.oncelik);
			if (!oncelik) return badRequest('Geçersiz öncelik.');
			patch.oncelik = oncelik;
		}
		if (body.etiketler !== undefined) {
			const etiketler = normalizeEtiketler(body.etiketler);
			if (!etiketler) return badRequest('Etiketler bir metin listesi olmalıdır.');
			patch.etiketler = etiketler;
		}
		if (body.teslimTarihi !== undefined) {
			const due = normalizeTeslimTarihi(body.teslimTarihi);
			if (due === undefined) return badRequest('Geçersiz teslim tarihi.');
			patch.teslimTarihi = due;
		}
		let claimingFromPool = false;
		if (body.atananUyeId !== undefined) {
			const assignee = typeof body.atananUyeId === 'string' && body.atananUyeId ? body.atananUyeId : null;
			// Taking an unassigned task from the pool is open to any team member;
			// every other ownership change belongs to management and the captain.
			claimingFromPool = assignee === auth.user.id && !access.task.atananUyeId;
			if (!access.manage && !claimingFromPool) {
				return forbidden('Görev atamasını yalnızca yönetim veya takım kaptanı değiştirebilir.');
			}
			if (assignee && !isAssignable(access, assignee)) return badRequest('Görev yalnızca takım üyelerine atanabilir.');
			patch.atananUyeId = assignee;
		}

		if (!access.manage) {
			const fields = Object.keys(patch) as (keyof TeamTaskPatch)[];
			const onlyClaim = claimingFromPool && fields.length === 1;
			// The assignee may refine the description and labels of their own task.
			const assigneeEdit = access.work && fields.every((f) => f === 'aciklama' || f === 'etiketler' || (f === 'atananUyeId' && claimingFromPool));
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
		await publishEventQuiet(getPgPool(), { k: 'takim_guncellendi', teamId: access.task.teamId });
		return NextResponse.json({ success: true, task });
	} catch (error) {
		console.error('API /api/takimlar/gorevler PATCH error:', error);
		return NextResponse.json({ error: 'Görev güncellenemedi.' }, { status: 500 });
	}
}

/** Checklist lines and comments: `{ action: 'addItem' | 'updateItem' | 'deleteItem' | 'addComment' | 'deleteComment' }`. */
export async function POST(request: Request, { params }: Params) {
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
				const metin = typeof body.metin === 'string' ? body.metin.trim() : '';
				if (!metin) return badRequest('Madde metni boş olamaz.');
				if (metin.length > MADDE_MAX) return badRequest(`Madde en fazla ${MADDE_MAX} karakter olabilir.`);
				const madde = await addTaskItem(id, metin, auth.user.id);
				await publishEventQuiet(getPgPool(), { k: 'takim_guncellendi', teamId: access.task.teamId });
				return NextResponse.json({ success: true, madde });
			}

			const maddeId = typeof body.maddeId === 'string' ? body.maddeId : '';
			const madde = maddeId ? await getTaskItem(maddeId) : null;
			// A line from another task is "not found" here, not "forbidden".
			if (!madde || madde.gorevId !== id) return NextResponse.json({ error: 'Madde bulunamadı.' }, { status: 404 });

			if (action === 'deleteItem') {
				await deleteTaskItem(maddeId);
				await publishEventQuiet(getPgPool(), { k: 'takim_guncellendi', teamId: access.task.teamId });
				return NextResponse.json({ success: true });
			}

			const patch: { metin?: string; tamamMi?: boolean } = {};
			if (body.metin !== undefined) {
				const metin = typeof body.metin === 'string' ? body.metin.trim() : '';
				if (!metin) return badRequest('Madde metni boş olamaz.');
				if (metin.length > MADDE_MAX) return badRequest(`Madde en fazla ${MADDE_MAX} karakter olabilir.`);
				patch.metin = metin;
			}
			if (body.tamamMi !== undefined) {
				if (typeof body.tamamMi !== 'boolean') return badRequest('Geçersiz değer.');
				patch.tamamMi = body.tamamMi;
			}
			await updateTaskItem(maddeId, patch, auth.user.id);
			await publishEventQuiet(getPgPool(), { k: 'takim_guncellendi', teamId: access.task.teamId });
			return NextResponse.json({ success: true });
		}

		if (action === 'addComment') {
			const icerik = typeof body.icerik === 'string' ? body.icerik.trim() : '';
			if (!icerik) return badRequest('Yorum boş olamaz.');
			if (icerik.length > YORUM_MAX) return badRequest(`Yorum en fazla ${YORUM_MAX} karakter olabilir.`);
			const yorum = await addTaskComment(id, auth.user.id, icerik);
			await publishEventQuiet(getPgPool(), { k: 'takim_guncellendi', teamId: access.task.teamId });
			return NextResponse.json({
				success: true,
				yorum: { ...yorum, kullaniciAdSoyad: `${auth.user.ad} ${auth.user.soyad}` },
			});
		}

		if (action === 'deleteComment') {
			const yorumId = typeof body.yorumId === 'string' ? body.yorumId : '';
			const yorum = yorumId ? await getTaskComment(yorumId) : null;
			if (!yorum || yorum.gorevId !== id) return NextResponse.json({ error: 'Yorum bulunamadı.' }, { status: 404 });
			// Your own words, or moderation by management and the captain.
			if (yorum.userId !== auth.user.id && !access.manage) {
				return forbidden('Bu yorumu yalnızca yazarı, kaptan veya yönetim silebilir.');
			}
			await deleteTaskComment(yorumId);
			await publishEventQuiet(getPgPool(), { k: 'takim_guncellendi', teamId: access.task.teamId });
			return NextResponse.json({ success: true });
		}

		return badRequest('Geçersiz işlem.');
	} catch (error) {
		console.error('API /api/takimlar/gorevler POST error:', error);
		return NextResponse.json({ error: 'İşlem tamamlanamadı.' }, { status: 500 });
	}
}
