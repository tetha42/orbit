import { NextResponse } from 'next/server';
import {
	createCustomWallpaper,
	deleteCustomWallpaper,
	getCustomWallpaperById,
	getCustomWallpapers,
	getWallpaperOverrides,
	renameCustomWallpaper,
	setWallpaperOverride,
	clearWallpaperOverride,
} from '@/db';
import { WALLPAPERS } from '@/core/theme/wallpapers';
import { requireApp } from '@/lib/auth/access';
import { customAssetUrl, removeCustomImage, writeCustomImage } from '@/lib/server/customData';
import { sniffImage } from '@/lib/uploads';
import { logSystemEvent } from '@/server/db/domains/logs.repo';

export const dynamic = 'force-dynamic';

const MAX_WALLPAPER_BYTES = 12 * 1024 * 1024;

const clean = (value: unknown, max = 120) =>
	typeof value === 'string' ? value.trim().slice(0, max) : '';

export async function GET(request: Request) {
	const auth = await requireApp(request, 'settings', 'kullan');
	if (!auth.authorized) return auth.response;
	const wallpapers = (await getCustomWallpapers()).map((wallpaper) => ({
		...wallpaper,
		url: customAssetUrl('wallpapers', wallpaper.filename),
	}));
	return NextResponse.json({
		ok: true,
		wallpapers,
		overrides: await getWallpaperOverrides(),
	});
}

export async function POST(request: Request) {
	const auth = await requireApp(request, 'settings', 'yonet');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'mezun') {
		return NextResponse.json({ error: 'Alumni accounts are read-only.' }, { status: 403 });
	}

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
	if (file.size <= 0 || file.size > MAX_WALLPAPER_BYTES) {
		return NextResponse.json({ error: 'The wallpaper must be smaller than 12 MB.' }, { status: 413 });
	}
	const titleTr = clean(formData.get('titleTr')) || 'Özel Duvar Kağıdı';
	const titleEn = clean(formData.get('titleEn')) || 'Custom Wallpaper';
	const type = clean(formData.get('type'), 40) || 'custom';

	const buffer = Buffer.from(await file.arrayBuffer());
	const image = sniffImage(buffer);
	if (!image) {
		return NextResponse.json(
			{ error: 'Only JPEG, PNG, WebP, GIF or AVIF images are supported.', code: 'UNSUPPORTED_IMAGE' },
			{ status: 415 }
		);
	}

	const filename = await writeCustomImage('wallpapers', buffer, image.ext);
	const wallpaper = await createCustomWallpaper({
		titleTr,
		titleEn,
		type,
		filename,
		mime: image.mime,
		size: buffer.length,
		createdBy: auth.user.id,
	});

	void logSystemEvent({
		servis: 'settings',
		seviye: 'INFO',
		mesaj: `Custom wallpaper added: ${titleEn}`,
		detay: { wallpaperId: wallpaper.id, filename },
		userId: auth.user.id,
	});

	return NextResponse.json({
		ok: true,
		wallpaper: { ...wallpaper, url: customAssetUrl('wallpapers', filename) },
	});
}

export async function PATCH(request: Request) {
	const auth = await requireApp(request, 'settings', 'yonet');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'mezun') {
		return NextResponse.json({ error: 'Alumni accounts are read-only.' }, { status: 403 });
	}
	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	const id = String(body.id ?? '').trim();
	const titleTr = clean(body.titleTr);
	const titleEn = clean(body.titleEn);
	if (!id || !titleTr || !titleEn) {
		return NextResponse.json(
			{ error: 'Both Turkish and English wallpaper names are required.', code: 'WALLPAPER_NAME_REQUIRED' },
			{ status: 400 }
		);
	}

	if (body.builtin === true) {
		const exists = WALLPAPERS.some((wallpaper) => wallpaper.id === id);
		if (!exists) return NextResponse.json({ error: 'Wallpaper not found.' }, { status: 404 });
		if (body.restore === true) {
			const overrides = await clearWallpaperOverride(id);
			return NextResponse.json({ ok: true, overrides });
		}
		const overrides = await setWallpaperOverride(id, { titleTr, titleEn });
		return NextResponse.json({ ok: true, override: overrides[id], overrides });
	}

	const wallpaper = await renameCustomWallpaper(id, titleTr, titleEn);
	if (!wallpaper) return NextResponse.json({ error: 'Wallpaper not found.' }, { status: 404 });
	return NextResponse.json({
		ok: true,
		wallpaper: { ...wallpaper, url: customAssetUrl('wallpapers', wallpaper.filename) },
	});
}

export async function DELETE(request: Request) {
	const auth = await requireApp(request, 'settings', 'yonet');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'mezun') {
		return NextResponse.json({ error: 'Alumni accounts are read-only.' }, { status: 403 });
	}
	const id = new URL(request.url).searchParams.get('id') ?? '';
	const builtin = new URL(request.url).searchParams.get('builtin') === '1';
	if (!id) return NextResponse.json({ error: 'Wallpaper id is required.' }, { status: 400 });

	if (builtin) {
		if (!WALLPAPERS.some((wallpaper) => wallpaper.id === id)) {
			return NextResponse.json({ error: 'Wallpaper not found.' }, { status: 404 });
		}
		const overrides = await setWallpaperOverride(id, { hidden: true });
		return NextResponse.json({ ok: true, hiddenId: id, overrides });
	}

	const existing = await getCustomWallpaperById(id);
	if (!existing) return NextResponse.json({ error: 'Wallpaper not found.' }, { status: 404 });
	const removed = await deleteCustomWallpaper(id);
	if (!removed) return NextResponse.json({ error: 'Wallpaper not found.' }, { status: 404 });
	await removeCustomImage('wallpapers', removed.filename);
	return NextResponse.json({ ok: true, removedId: id });
}
