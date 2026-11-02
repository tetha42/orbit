import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getPublicIdentity, getSystemSettings, setSystemSettings } from '@/db';
import { requireApp } from '@/lib/auth/access';
import { logSystemEvent } from '@/db/repositories/logs.repo';

export const dynamic = 'force-dynamic';

const IMMUTABLE_IDENTITY = {
	error: 'The studio name (tetha42) and the application name (Orbit) are product identity and cannot be changed.',
	code: 'IMMUTABLE_IDENTITY',
} as const;

const clean = (value: unknown, max = 120) =>
	typeof value === 'string' ? value.trim().slice(0, max) : '';

export async function GET(request: Request) {
	const auth = await requireApp(request, 'settings', 'kullan');
	if (!auth.authorized) return auth.response;
	const [identity, settings] = await Promise.all([getPublicIdentity(), getSystemSettings()]);
	return NextResponse.json({ ok: true, identity, settings: { siteIcon: settings.site_icon || null } });
}

export async function PATCH(request: Request) {
	const auth = await requireApp(request, 'settings', 'yonet');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'mezun') {
		return NextResponse.json({ error: 'Alumni accounts are read-only.' }, { status: 403 });
	}

	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	// Reject any attempt to rebrand the studio or the product itself, even if a
	// custom client sends the field.
	for (const protectedKey of ['studio', 'universite', 'appName', 'applicationName']) {
		if (body[protectedKey] !== undefined) {
			const value = String(body[protectedKey] ?? '').trim();
			const expected = protectedKey === 'appName' || protectedKey === 'applicationName' ? 'Orbit' : 'tetha42';
			if (value !== expected) {
				return NextResponse.json(IMMUTABLE_IDENTITY, { status: 400 });
			}
		}
	}

	const updates: Record<string, string> = {};
	if (body.siteName !== undefined) {
		const siteName = clean(body.siteName);
		if (!siteName) {
			return NextResponse.json({ error: 'Site name cannot be empty.', code: 'SITE_NAME_REQUIRED' }, { status: 400 });
		}
		updates.kulup_adi = siteName;
	}
	if (body.shortName !== undefined) updates.site_short_name = clean(body.shortName, 32);
	if (body.descriptionTr !== undefined) updates.site_description_tr = clean(body.descriptionTr, 400);
	if (body.descriptionEn !== undefined) updates.site_description_en = clean(body.descriptionEn, 400);

	if (Object.keys(updates).length === 0) {
		return NextResponse.json({ ok: true, identity: await getPublicIdentity() });
	}

	// Name/description changes also invalidate the installed PWA's manifest.
	updates.site_brand_version = `${Date.now()}-${randomBytes(4).toString('hex')}`;
	await setSystemSettings(updates);
	void logSystemEvent({
		servis: 'settings',
		seviye: 'INFO',
		mesaj: `Site identity updated (${auth.user.ad} ${auth.user.soyad})`,
		detay: updates,
		userId: auth.user.id,
	});

	return NextResponse.json({ ok: true, identity: await getPublicIdentity() });
}
