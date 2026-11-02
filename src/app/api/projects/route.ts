import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { createProject, getProjects, getPgPool, type ProjectInput } from '@/db';
import { publishEventQuiet } from '@/db/events';
import { can, requireApp } from '@/lib/auth/access';
import { parseProjectInput } from '@/server/projectInput';

export const dynamic = 'force-dynamic';

/** The showcase as this member may see it, plus what the app should offer them. */
export async function GET(request: Request) {
	const auth = await requireApp(request, 'projects', 'kullan');
	if (!auth.authorized) return auth.response;
	try {
		const manage = can(auth.user, 'projects', 'yonet');
		const projects = await getProjects(auth.user.id, manage);
		return NextResponse.json({ projeler: projects, izinler: { manage } });
	} catch (error) {
		console.error('API /api/projeler GET error:', error);
		return NextResponse.json({ error: 'Projeler okunamadı.' }, { status: 500 });
	}
}

/**
 * Adds a project. A member's submission is a proposal (`oneri`) until management
 * publishes it; management may publish directly or keep it as a draft proposal.
 */
async function handlePOST(request: Request) {
	const auth = await requireApp(request, 'projects', 'kullan');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'mezun') {
		return NextResponse.json({ error: 'Mezunlar sadece okuma erişimine sahiptir.' }, { status: 403 });
	}
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const parsed = await parseProjectInput(body, auth.user, false);
		if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
		const manage = can(auth.user, 'projects', 'yonet');
		const project = await createProject({
			...(parsed.value as ProjectInput),
			olusturanId: auth.user.id,
			status: manage && body.status !== 'oneri' ? 'yayinda' : 'oneri',
		});
		await publishEventQuiet(getPgPool(), [{ k: 'project_updated' }]);
		return NextResponse.json({ success: true, proje: project }, { status: 201 });
	} catch (error) {
		console.error('API /api/projeler POST error:', error);
		return NextResponse.json({ error: 'Project kaydedilemedi.' }, { status: 500 });
	}
}

export const POST = withAudit(handlePOST, { action: 'projects.create', target: 'projects' });
