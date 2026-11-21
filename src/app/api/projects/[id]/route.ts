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

const notFound = () => NextResponse.json({ error: 'Project not found.' }, { status: 404 });
const forbidden = (error: string) => NextResponse.json({ error }, { status: 403 });

/** Someone else's proposal is invisible — "not found", not "forbidden". */
async function load(id: string, user: AuthorizedUser): Promise<{ project: Project; manage: boolean; owner: boolean } | null> {
	const project = await getProjectById(id, user.id);
	if (!project) return null;
	const manage = can(user, 'projects', 'manage');
	const owner = project.creatorId === user.id;
	if (project.status !== 'published' && !manage && !owner) return null;
	return { project: project, manage, owner };
}

export async function GET(request: Request, { params }: Params) {
	const auth = await requireApp(request, 'projects', 'use');
	if (!auth.authorized) return auth.response;
	const { id } = await params;
	const found = await load(id, auth.user);
	return found ? NextResponse.json(found.project) : notFound();
}

/**
 * Content fields: the author (unless archived) and management.
 * `status` and `isFeatured` (publishing, archiving, pinning): management only.
 */
async function handlePATCH(request: Request, { params }: Params) {
	const auth = await requireApp(request, 'projects', 'use');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'alumni') return forbidden('Alumni members have read-only access.');
	try {
		const { id } = await params;
		const found = await load(id, auth.user);
		if (!found) return notFound();
		const { project, manage, owner } = found;
		const body = (await request.json()) as Record<string, unknown>;

		const editsContent = ['title', 'summary', 'description', 'repoUrl', 'liveUrl', 'technologies', 'teamId'].some(
			(k) => body[k] !== undefined
		);
		if (editsContent && !manage && !(owner && project.status !== 'archived')) {
			return forbidden('Only the project owner or management can edit this project.');
		}
		const rawFeatured = body.isFeatured;
		if ((body.status !== undefined || rawFeatured !== undefined) && !manage) {
			return forbidden('Publishing and featuring are restricted to administrators.');
		}
		if (body.status !== undefined && !isProjectStatus(body.status)) {
			return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
		}
		if (rawFeatured !== undefined && typeof rawFeatured !== 'boolean') {
			return NextResponse.json({ error: 'Invalid value.' }, { status: 400 });
		}

		const parsed = await parseProjectInput(body, auth.user, true);
		if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
		const next = { ...project, ...parsed.value };
		if (!next.repoUrl && !next.liveUrl) {
			return NextResponse.json({ error: 'At least one repository or live demo URL is required.' }, { status: 400 });
		}

		await updateProject(id, {
			...parsed.value,
			status: body.status as Project['status'] | undefined,
			// Only a published project can be pinned; archiving or unpublishing unpins it.
			isFeatured:
				rawFeatured !== undefined
					? Boolean(rawFeatured) && (body.status ?? project.status) === 'published'
					: body.status !== undefined && body.status !== 'published'
						? false
						: undefined,
		});
		await publishEventQuiet(getPgPool(), [{ k: 'project_updated' }]);
		return NextResponse.json({ success: true, project: await getProjectById(id, auth.user.id) });
	} catch (error) {
		console.error('API /api/projects PATCH error:', error);
		return NextResponse.json({ error: 'Failed to update project.' }, { status: 500 });
	}
}

/** Management, or the author while it is still a proposal. */
async function handleDELETE(request: Request, { params }: Params) {
	const auth = await requireApp(request, 'projects', 'use');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'alumni') return forbidden('Alumni members have read-only access.');
	const { id } = await params;
	const found = await load(id, auth.user);
	if (!found) return notFound();
	if (!found.manage && !(found.owner && found.project.status === 'proposed')) {
		return forbidden('Only administrators can remove a published project.');
	}
	await deleteProject(id);
	await publishEventQuiet(getPgPool(), [{ k: 'project_updated' }]);
	return NextResponse.json({ success: true });
}

/** `{ action: 'star' }` toggles the caller's star on a published project. */
async function handlePOST(request: Request, { params }: Params) {
	const auth = await requireApp(request, 'projects', 'use');
	if (!auth.authorized) return auth.response;
	const { id } = await params;
	const found = await load(id, auth.user);
	if (!found) return notFound();
	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	if (body.action !== 'star') return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
	if (found.project.status !== 'published') {
		return NextResponse.json({ error: 'Only published projects can be starred.' }, { status: 400 });
	}
	const result = await toggleProjectLike(id, auth.user.id);
	await publishEventQuiet(getPgPool(), [{ k: 'project_updated' }]);
	return NextResponse.json({ success: true, ...result });
}

export const POST = withAudit(handlePOST, { action: 'projects.item.create', target: 'projects.item' });
export const PATCH = withAudit(handlePATCH, { action: 'projects.item.update', target: 'projects.item' });
export const DELETE = withAudit(handleDELETE, { action: 'projects.item.delete', target: 'projects.item' });
