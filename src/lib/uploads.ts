import path from 'path';

/**
 * Where uploaded receipts live: outside `public/`, because Next only serves the
 * files that existed at build time (new uploads 404 in production) and anything
 * in `public/` is world-readable by URL. In docker compose this is a named volume.
 */
export function uploadDir(): string {
	// A deployment-chosen directory, not project source: keep the bundler from
	// tracing (and shipping) the whole project because of this dynamic path.
	return path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR?.trim() || './data/uploads');
}

/** 10 MB, matching the proxy's request-body ceiling. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Names are generated server-side; anything else is refused before touching the disk. */
export const UPLOAD_NAME_RE = /^\d{10,16}_[a-f0-9]{18}\.(jpg|png|webp|pdf)$/;

export interface SniffedFile {
	mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
	ext: '.jpg' | '.png' | '.webp' | '.pdf';
}

/**
 * Identifies a file by its leading bytes.
 *
 * The declared MIME type and the file name come from the client and prove
 * nothing — an `.html` file sent as `image/png` used to be stored and served
 * verbatim. Only what the bytes say is trusted.
 */
export function sniffFile(buf: Buffer): SniffedFile | null {
	if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
		return { mime: 'image/jpeg', ext: '.jpg' };
	}
	if (
		buf.length >= 8 &&
		buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
	) {
		return { mime: 'image/png', ext: '.png' };
	}
	if (
		buf.length >= 12 &&
		buf.subarray(0, 4).toString('latin1') === 'RIFF' &&
		buf.subarray(8, 12).toString('latin1') === 'WEBP'
	) {
		return { mime: 'image/webp', ext: '.webp' };
	}
	if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') {
		return { mime: 'application/pdf', ext: '.pdf' };
	}
	return null;
}

export function mimeForName(name: string): SniffedFile['mime'] {
	if (name.endsWith('.png')) return 'image/png';
	if (name.endsWith('.webp')) return 'image/webp';
	if (name.endsWith('.pdf')) return 'application/pdf';
	return 'image/jpeg';
}
