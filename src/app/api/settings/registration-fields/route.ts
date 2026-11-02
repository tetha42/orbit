import { NextResponse } from 'next/server';
import { getRegistrationCoreConfig, setRegistrationCoreConfig } from '@/db';
import { requireApp } from '@/lib/auth/access';
import { logSystemEvent } from '@/db/repositories/logs.repo';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
	const auth = await requireApp(request, 'settings', 'yonet');
	if (!auth.authorized) return auth.response;
	const config = await getRegistrationCoreConfig();
	return NextResponse.json(
		{ ok: true, config },
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}

export async function PATCH(request: Request) {
	const auth = await requireApp(request, 'settings', 'yonet');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'mezun') {
		return NextResponse.json({ error: 'Alumni accounts are read-only.' }, { status: 403 });
	}

	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return NextResponse.json({ error: 'Invalid registration field configuration.' }, { status: 400 });
	}
	const config = await setRegistrationCoreConfig(body);
	void logSystemEvent({
		servis: 'settings',
		seviye: 'INFO',
		mesaj: `Registration core fields updated (${auth.user.ad} ${auth.user.soyad})`,
		detay: {
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
