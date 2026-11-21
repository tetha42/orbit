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
import { customAssetUrl, removeCustomImage, writeCustomImage } from '@/server/customData';
import { sniffImage } from '@/lib/uploads';
import { PayloadTooLargeError, readBoundedFormData } from '@/lib/httpBodyGuard';
import { logSystemEvent } from '@/db/repositories/logs.repo';

export const dynamic = 'force-dynamic';

const MAX_WALLPAPER_BYTES = 12 * 1024 * 1024;

const clean = (value: unknown, max = 120) =>
	typeof value === 'string' ? value.trim().slice(0, max) : '';

export async function GET(request: Request) {
	const auth = await requireApp(request, 'settings', 'use');
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
	const auth = await requireApp(request, 'settings', 'manage');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'alumni') {
		return NextResponse.json({ error: 'Alumni accounts are read-only.' }, { status: 403 });
	}

	let formData: FormData;
	try {
		formData = await readBoundedFormData(request, MAX_WALLPAPER_BYTES + 128 * 1024);
	} catch (error) {
		if (error instanceof PayloadTooLargeError) {
			return NextResponse.json({ error: 'The wallpaper must be smaller than 12 MB.' }, { status: 413 });
		}
		return NextResponse.json({ error: 'Invalid upload request.' }, { status: 400 });
	}
	const file = formData.get('file');
	if (!(file instanceof File)) {
		return NextResponse.json({ error: 'Choose an image file.' }, { status: 400 });
	}
	if (file.size <= 0 || file.size > MAX_WALLPAPER_BYTES) {
		return NextResponse.json({ error: 'The wallpaper must be smaller than 12 MB.' }, { status: 413 });
	}
	const titleEn = clean(formData.get('titleEn')) || clean(formData.get('titleTr')) || 'Custom Wallpaper';
	const titleTr = clean(formData.get('titleTr')) || titleEn;
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
		service: 'settings',
		level: 'INFO',
		message: `Custom wallpaper added: ${titleEn}`,
		detail: { wallpaperId: wallpaper.id, filename },
		userId: auth.user.id,
	});

	return NextResponse.json({
		ok: true,
		wallpaper: { ...wallpaper, url: customAssetUrl('wallpapers', filename) },
	});
}

export async function PATCH(request: Request) {
	const auth = await requireApp(request, 'settings', 'manage');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'alumni') {
		return NextResponse.json({ error: 'Alumni accounts are read-only.' }, { status: 403 });
	}
	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	const id = String(body.id ?? '').trim();
	const titleEn = clean(body.titleEn) || clean(body.titleTr);
	const titleTr = clean(body.titleTr) || titleEn;
	if (!id || !titleEn) {
		return NextResponse.json(
			{ error: 'Wallpaper name is required.', code: 'WALLPAPER_NAME_REQUIRED' },
			{ status: 400 }
		);
	}

	if (body.builtin === true) {
		const exists = WALLPAPERS.some((wallpaper) => wallpaper.id === id);
		if (!exists) return NextResponse.json({ error: 'Wallpaper not found.' }, { status: 404 });
		if (body.restore === true) {
			const overrides = await clearWallpaperOverride(id);
			void logSystemEvent({
				service: 'settings',
				level: 'INFO',
				message: `Built-in wallpaper override cleared: ${id}`,
				detail: { wallpaperId: id, builtin: true },
				userId: auth.user.id,
			});
			return NextResponse.json({ ok: true, overrides });
		}
		const overrides = await setWallpaperOverride(id, { titleTr, titleEn });
		void logSystemEvent({
			service: 'settings',
			level: 'INFO',
			message: `Built-in wallpaper updated: ${id}`,
			detail: { wallpaperId: id, builtin: true, titleEn },
			userId: auth.user.id,
		});
		return NextResponse.json({ ok: true, override: overrides[id], overrides });
	}

	const wallpaper = await renameCustomWallpaper(id, titleTr, titleEn);
	if (!wallpaper) return NextResponse.json({ error: 'Wallpaper not found.' }, { status: 404 });
	void logSystemEvent({
		service: 'settings',
		level: 'INFO',
		message: `Custom wallpaper renamed: ${titleEn}`,
		detail: { wallpaperId: id, titleEn },
		userId: auth.user.id,
	});
	return NextResponse.json({
		ok: true,
		wallpaper: { ...wallpaper, url: customAssetUrl('wallpapers', wallpaper.filename) },
	});
}

export async function DELETE(request: Request) {
	const auth = await requireApp(request, 'settings', 'manage');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'alumni') {
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
		void logSystemEvent({
			service: 'settings',
			level: 'WARN',
			message: `Built-in wallpaper hidden: ${id}`,
			detail: { wallpaperId: id, builtin: true },
			userId: auth.user.id,
		});
		return NextResponse.json({ ok: true, hiddenId: id, overrides });
	}

	const existing = await getCustomWallpaperById(id);
	if (!existing) return NextResponse.json({ error: 'Wallpaper not found.' }, { status: 404 });
	const removed = await deleteCustomWallpaper(id);
	if (!removed) return NextResponse.json({ error: 'Wallpaper not found.' }, { status: 404 });
	await removeCustomImage('wallpapers', removed.filename);
	void logSystemEvent({
		service: 'settings',
		level: 'WARN',
		message: `Custom wallpaper deleted: ${id}`,
		detail: { wallpaperId: id, filename: removed.filename },
		userId: auth.user.id,
	});
	return NextResponse.json({ ok: true, removedId: id });
}
