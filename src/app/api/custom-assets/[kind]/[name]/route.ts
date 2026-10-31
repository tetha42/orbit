import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import {
	customAssetDir,
	isCustomAssetKind,
	isSafeCustomImageName,
} from '@/lib/server/customData';

export const dynamic = 'force-dynamic';

const MIME_BY_EXT: Record<string, string> = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
	gif: 'image/gif',
	avif: 'image/avif',
};

const notFound = () => new Response('Not found', { status: 404 });

/**
 * Serves custom branding images (site icon, wallpapers). Names are generated
 * server-side and checked here before touching the filesystem, so a request
 * cannot escape the custom asset directory.
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ kind: string; name: string }> }
) {
	const { kind, name } = await params;
	if (!isCustomAssetKind(kind) || !isSafeCustomImageName(name)) return notFound();

	const filePath = path.join(customAssetDir(kind), name);
	let size: number;
	try {
		size = (await stat(filePath)).size;
	} catch {
		return notFound();
	}

	const ext = name.split('.').pop()?.toLowerCase() ?? '';
	const mime = MIME_BY_EXT[ext];
	if (!mime) return notFound();

	const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
	return new Response(stream, {
		headers: {
			'Content-Type': mime,
			'Content-Length': String(size),
			'Content-Disposition': `inline; filename="${name}"`,
			'X-Content-Type-Options': 'nosniff',
			'Content-Security-Policy': "default-src 'none'; sandbox",
			// Content-addressed names never change bytes; a long cache is safe.
			'Cache-Control': 'public, max-age=31536000, immutable',
		},
	});
}
