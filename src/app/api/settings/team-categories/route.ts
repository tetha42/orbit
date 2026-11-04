import { NextResponse } from 'next/server';
import { getTeamCategories, setTeamCategories } from '@/db';
import { requireApp } from '@/lib/auth/access';
import { logSystemEvent } from '@/db/repositories/logs.repo';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
	const auth = await requireApp(request, 'settings', 'manage');
	if (!auth.authorized) return auth.response;
	const categories = await getTeamCategories();
	return NextResponse.json(
		{ ok: true, categories },
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}

export async function PATCH(request: Request) {
	const auth = await requireApp(request, 'settings', 'manage');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'alumni') {
		return NextResponse.json({ error: 'Alumni accounts are read-only.' }, { status: 403 });
	}

	const body = await request.json().catch(() => null);
	const raw = Array.isArray(body) ? body : body && typeof body === 'object' ? (body as Record<string, unknown>).categories : null;
	if (!Array.isArray(raw)) {
		return NextResponse.json({ error: 'Invalid team categories.' }, { status: 400 });
	}
	const categories = await setTeamCategories(raw);
	void logSystemEvent({
		service: 'settings',
		level: 'INFO',
		message: `Team categories updated (${auth.user.firstName || auth.user.name || ""} ${auth.user.lastName || auth.user.surname || ""})`,
		detail: { count: categories.length, categories },
		userId: auth.user.id,
	});
	return NextResponse.json(
		{ ok: true, categories },
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}
