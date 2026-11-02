import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { deleteProject, getProjectById, toggleProjectLike, updateProject, getPgPool } from '@/db';
import { publishEventQuiet } from '@/db/events';
import type { Project } from '@/db/schema';
import { can, requireApp, type AuthorizedUser } from '@/lib/auth/access';
import { isProjectStatus } from '@/lib/projects';
import { parseProjectInput } from '@/server/projectInput';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

const notFound = () => NextResponse.json({ error: 'Project bulunamadı.' }, { status: 404 });
const forbidden = (error: string) => NextResponse.json({ error }, { status: 403 });

/** Someone else's proposal is invisible — "not found", not "forbidden". */
async function load(id: string, user: AuthorizedUser): Promise<{ proje: Project; manage: boolean; owner: boolean } | null> {
	const project = await getProjectById(id, user.id);
	if (!project) return null;
	const manage = can(user, 'projects', 'yonet');
	const owner = project.olusturanId === user.id;
	if (project.status !== 'yayinda' && !manage && !owner) return null;
	return { proje: project, manage, owner };
}

export async function GET(request: Request, { params }: Params) {
	const auth = await requireApp(request, 'projects', 'kullan');
	if (!auth.authorized) return auth.response;
	const { id } = await params;
	const found = await load(id, auth.user);
	return found ? NextResponse.json(found.proje) : notFound();
}

/**
 * Content fields: the author (unless archived) and management.
 * `status` and `oneCikan` (publishing, archiving, pinning): management only.
 */
async function handlePATCH(request: Request, { params }: Params) {
	const auth = await requireApp(request, 'projects', 'kullan');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'mezun') return forbidden('Mezunlar sadece okuma erişimine sahiptir.');
	try {
		const { id } = await params;
		const found = await load(id, auth.user);
		if (!found) return notFound();
		const { proje, manage, owner } = found;
		const body = (await request.json()) as Record<string, unknown>;

		const editsContent = ['baslik', 'ozet', 'aciklama', 'repoUrl', 'canliUrl', 'teknolojiler', 'teamId'].some(
			(k) => body[k] !== undefined
		);
		if (editsContent && !manage && !(owner && proje.status !== 'arsiv')) {
			return forbidden('Bu projeyi yalnızca sahibi veya yönetim düzenleyebilir.');
		}
		if ((body.status !== undefined || body.oneCikan !== undefined) && !manage) {
			return forbidden('Yayınlama ve öne çıkarma yönetim kuruluna aittir.');
		}
		if (body.status !== undefined && !isProjectStatus(body.status)) {
			return NextResponse.json({ error: 'Geçersiz status.' }, { status: 400 });
		}
		if (body.oneCikan !== undefined && typeof body.oneCikan !== 'boolean') {
			return NextResponse.json({ error: 'Geçersiz değer.' }, { status: 400 });
		}

		const parsed = await parseProjectInput(body, auth.user, true);
		if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
		const next = { ...proje, ...parsed.value };
		if (!next.repoUrl && !next.canliUrl) {
			return NextResponse.json({ error: 'Depo veya canlı demo bağlantılarından en az biri gereklidir.' }, { status: 400 });
		}

		await updateProject(id, {
			...parsed.value,
			status: body.status as Project['status'] | undefined,
			// Only a published project can be pinned; archiving or unpublishing unpins it.
			oneCikan:
				body.oneCikan !== undefined
					? Boolean(body.oneCikan) && (body.status ?? proje.status) === 'yayinda'
					: body.status !== undefined && body.status !== 'yayinda'
						? false
						: undefined,
		});
		await publishEventQuiet(getPgPool(), [{ k: 'project_updated' }]);
		return NextResponse.json({ success: true, proje: await getProjectById(id, auth.user.id) });
	} catch (error) {
		console.error('API /api/projeler PATCH error:', error);
		return NextResponse.json({ error: 'Project güncellenemedi.' }, { status: 500 });
	}
}

/** Management, or the author while it is still a proposal. */
async function handleDELETE(request: Request, { params }: Params) {
	const auth = await requireApp(request, 'projects', 'kullan');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'mezun') return forbidden('Mezunlar sadece okuma erişimine sahiptir.');
	const { id } = await params;
	const found = await load(id, auth.user);
	if (!found) return notFound();
	if (!found.manage && !(found.owner && found.proje.status === 'oneri')) {
		return forbidden('Yayındaki bir projeyi yalnızca yönetim kaldırabilir.');
	}
	await deleteProject(id);
	await publishEventQuiet(getPgPool(), [{ k: 'project_updated' }]);
	return NextResponse.json({ success: true });
}

/** `{ action: 'star' }` toggles the caller's star on a published project. */
async function handlePOST(request: Request, { params }: Params) {
	const auth = await requireApp(request, 'projects', 'kullan');
	if (!auth.authorized) return auth.response;
	const { id } = await params;
	const found = await load(id, auth.user);
	if (!found) return notFound();
	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	if (body.action !== 'star') return NextResponse.json({ error: 'Geçersiz işlem.' }, { status: 400 });
	if (found.proje.status !== 'yayinda') {
		return NextResponse.json({ error: 'Yalnızca yayındaki projeler yıldızlanabilir.' }, { status: 400 });
	}
	const result = await toggleProjectLike(id, auth.user.id);
	await publishEventQuiet(getPgPool(), [{ k: 'project_updated' }]);
	return NextResponse.json({ success: true, ...result });
}

export const POST = withAudit(handlePOST, { action: 'projects.item.create', target: 'projects.item' });
export const PATCH = withAudit(handlePATCH, { action: 'projects.item.update', target: 'projects.item' });
export const DELETE = withAudit(handleDELETE, { action: 'projects.item.delete', target: 'projects.item' });
