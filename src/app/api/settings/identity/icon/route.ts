import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getSystemSettings, setSystemSettings } from '@/db';
import { requireApp } from '@/lib/auth/access';
import { logSystemEvent } from '@/server/db/domains/logs.repo';
import {
	customAssetUrl,
	isSafeCustomImageName,
	customImageNameFromUrl,
	removeCustomImage,
	writeCustomImage,
} from '@/lib/server/customData';
import { sniffImage } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

const MAX_ICON_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
	const auth = await requireApp(request, 'settings', 'yonet');
	if (!auth.authorized) return auth.response;

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return NextResponse.json({ error: 'Invalid upload request.' }, { status: 400 });
	}
	const file = formData.get('file');
	if (!(file instanceof File)) {
		return NextResponse.json({ error: 'Choose an image file.' }, { status: 400 });
	}
	if (file.size <= 0 || file.size > MAX_ICON_BYTES) {
		return NextResponse.json({ error: 'The icon must be smaller than 2 MB.' }, { status: 413 });
	}

	const buffer = Buffer.from(await file.arrayBuffer());
	const image = sniffImage(buffer);
	if (!image) {
		return NextResponse.json(
			{ error: 'Only JPEG, PNG, WebP, GIF or AVIF images are supported.', code: 'UNSUPPORTED_IMAGE' },
			{ status: 415 }
		);
	}

	const settings = await getSystemSettings();
	const previous = customImageNameFromUrl(settings.site_icon);
	const filename = await writeCustomImage('identity', buffer, image.ext);
	const version = `${Date.now()}-${randomBytes(4).toString('hex')}`;
	const iconUrl = `${customAssetUrl('identity', filename)}?v=${version}`;
	await setSystemSettings({ site_icon: iconUrl, site_brand_version: version });
	if (previous && previous !== filename) await removeCustomImage('identity', previous);

	void logSystemEvent({
		servis: 'settings',
		seviye: 'INFO',
		mesaj: `Site icon updated (${auth.user.ad} ${auth.user.soyad})`,
		userId: auth.user.id,
	});
	return NextResponse.json({ ok: true, iconUrl });
}

export async function DELETE(request: Request) {
	const auth = await requireApp(request, 'settings', 'yonet');
	if (!auth.authorized) return auth.response;
	const settings = await getSystemSettings();
	const previous = customImageNameFromUrl(settings.site_icon);
	await setSystemSettings({ site_icon: '', site_brand_version: `${Date.now()}-${randomBytes(4).toString('hex')}` });
	if (previous && isSafeCustomImageName(previous)) await removeCustomImage('identity', previous);
	return NextResponse.json({ ok: true, iconUrl: null });
}
