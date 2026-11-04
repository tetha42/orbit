import { NextResponse } from 'next/server';
import { getRegistrationCoreConfig, setRegistrationCoreConfig } from '@/db';
import { requireApp } from '@/lib/auth/access';
import { logSystemEvent } from '@/db/repositories/logs.repo';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
	const auth = await requireApp(request, 'settings', 'manage');
	if (!auth.authorized) return auth.response;
	const config = await getRegistrationCoreConfig();
	return NextResponse.json(
		{ ok: true, config },
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
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return NextResponse.json({ error: 'Invalid registration field configuration.' }, { status: 400 });
	}
	const config = await setRegistrationCoreConfig(body);
	void logSystemEvent({
		service: 'settings',
		level: 'INFO',
		message: `Registration core fields updated (${auth.user.firstName || auth.user.name || ""} ${auth.user.lastName || auth.user.surname || ""})`,
		detail: {
			trackVisible: config.track.visible,
			levelVisible: config.level.visible,
			trackOptions: config.track.options.length,
			levelOptions: config.level.options.length,
			memberIdRequired: config.memberId.required,
		},
		userId: auth.user.id,
	});
	return NextResponse.json(
		{ ok: true, config },
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}
