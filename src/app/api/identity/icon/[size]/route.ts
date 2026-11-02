import { NextResponse } from 'next/server';
import { stat } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { getPublicIdentity } from '@/db';
import {
	customAssetDir,
	customImageNameFromUrl,
	isSafeCustomImageName,
} from '@/server/customData';
import { defaultIconForSize } from '@/lib/identityIcon';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_SIZES = new Set([16, 32, 48, 64, 180, 192, 256, 512]);
const ICON_BACKGROUND = { r: 9, g: 9, b: 11, alpha: 1 };

// A tiny module-level cache keeps repeated manifest/favicon fetches from
// invoking sharp every time. Entries are keyed by the generated filename, so a
// new upload can never reuse an old icon.
const iconCache = new Map<string, Buffer>();
const CACHE_LIMIT = 24;

const notFound = () => new Response('Not found', { status: 404 });

/**
 * Serves the uploaded community icon at an exact size. A browser favicon,
 * Apple touch icon and the 192/512 PWA icons all come from this one upload, so
 * the admin never has to prepare multiple files.
 *
 * `?v=` is part of the URL; it changes on every upload and lets the response be
 * cached immutably without making the next upload stale.
 */
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ size: string }> }
) {
	const { size: rawSize } = await params;
	const size = Number.parseInt(rawSize, 10);
	if (!Number.isInteger(size) || !ALLOWED_SIZES.has(size)) return notFound();

	const requestUrl = new URL(request.url);
	const maskable = requestUrl.searchParams.get('maskable') === '1';
	const version = requestUrl.searchParams.get('v') || '';

	let iconUrl: string | null = null;
	try {
		iconUrl = (await getPublicIdentity()).iconUrl;
	} catch {
		iconUrl = null;
	}

	const filename = customImageNameFromUrl(iconUrl);
	if (!filename || !isSafeCustomImageName(filename)) {
		return NextResponse.redirect(new URL(defaultIconForSize(size, maskable), request.url));
	}

	const source = path.join(customAssetDir('identity'), filename);
	try {
		await stat(source);
	} catch {
		return NextResponse.redirect(new URL(defaultIconForSize(size, maskable), request.url));
	}

	const cacheKey = `${filename}:${size}:${maskable ? 1 : 0}`;
	try {
		let buffer = iconCache.get(cacheKey);
		if (!buffer) {
			const inner = maskable ? Math.round(size * 0.78) : size;
			const offset = Math.round((size - inner) / 2);
			let pipeline = sharp(source, { failOn: 'none' }).rotate().resize(inner, inner, {
				fit: 'contain',
				background: maskable ? ICON_BACKGROUND : { r: 0, g: 0, b: 0, alpha: 0 },
			});
			if (maskable) {
				pipeline = pipeline.extend({
					top: offset,
					bottom: size - inner - offset,
					left: offset,
					right: size - inner - offset,
					background: ICON_BACKGROUND,
				});
			}
			buffer = await pipeline.png().toBuffer();
			iconCache.set(cacheKey, buffer);
			if (iconCache.size > CACHE_LIMIT) {
				const oldest = iconCache.keys().next().value;
				if (oldest) iconCache.delete(oldest);
			}
		}
		return new Response(new Uint8Array(buffer), {
			headers: {
				'Content-Type': 'image/png',
				'Content-Length': String(buffer.length),
				'Content-Disposition': `inline; filename="icon-${size}.png"`,
				'X-Content-Type-Options': 'nosniff',
				'Content-Security-Policy': "default-src 'none'; sandbox",
				'Cache-Control': version
					? 'public, max-age=31536000, immutable'
					: 'public, max-age=300',
			},
		});
	} catch {
		return NextResponse.redirect(new URL(defaultIconForSize(size, maskable), request.url));
	}
}
