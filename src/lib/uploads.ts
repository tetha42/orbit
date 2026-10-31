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

/**
 * Names are generated server-side; anything else is refused before touching the
 * disk. Chat attachments share the directory and extend the extension list.
 */
export const UPLOAD_NAME_RE =
	/^\d{10,16}_[a-f0-9]{18}\.(jpg|jpeg|png|webp|gif|avif|pdf|mp4|mov|webm|weba|mkv|ogg|wav|mp3|flac|m4a|txt|md|markdown|csv|json|log|yaml|yml|xml|zip|docx|xlsx|pptx|odt|ods|odp|epub|doc|xls|ppt|bin)$/;

export interface SniffedFile {
	mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
	ext: '.jpg' | '.png' | '.webp' | '.pdf';
}

export interface SniffedImage {
	mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'image/avif';
	ext: '.jpg' | '.png' | '.webp' | '.gif' | '.avif';
}

/**
 * Identifies a raster image by its magic bytes. Used for the site icon and
 * custom wallpapers: a browser can render these formats inline, and nothing
 * else is accepted.
 */
export function sniffImage(buf: Buffer): SniffedImage | null {
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
	if (buf.length >= 6 && buf.subarray(0, 4).toString('latin1') === 'GIF8') {
		return { mime: 'image/gif', ext: '.gif' };
	}
	if (buf.length >= 12 && buf.subarray(4, 12).toString('latin1') === 'ftypavif') {
		return { mime: 'image/avif', ext: '.avif' };
	}
	return null;
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

const MIME_BY_EXTENSION: Record<string, string> = {
	png: 'image/png',
	webp: 'image/webp',
	gif: 'image/gif',
	avif: 'image/avif',
	pdf: 'application/pdf',
	mp4: 'video/mp4',
	m4v: 'video/mp4',
	mov: 'video/quicktime',
	webm: 'video/webm',
	weba: 'audio/webm',
	mkv: 'video/x-matroska',
	ogg: 'audio/ogg',
	wav: 'audio/wav',
	mp3: 'audio/mpeg',
	flac: 'audio/flac',
	m4a: 'audio/mp4',
	txt: 'text/plain',
	log: 'text/plain',
	md: 'text/markdown',
	markdown: 'text/markdown',
	// eslint-disable-next-line no-restricted-syntax -- MIME type, not a CSV download.
	csv: 'text/csv',
	json: 'application/json',
	yaml: 'text/yaml',
	yml: 'text/yaml',
	xml: 'application/xml',
	zip: 'application/zip',
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	odt: 'application/vnd.oasis.opendocument.text',
	ods: 'application/vnd.oasis.opendocument.spreadsheet',
	odp: 'application/vnd.oasis.opendocument.presentation',
	epub: 'application/epub+zip',
	doc: 'application/msword',
	xls: 'application/vnd.ms-excel',
	ppt: 'application/vnd.ms-powerpoint',
	bin: 'application/octet-stream',
};

export function mimeForName(name: string): string {
	const extension = name.split('.').pop()?.toLowerCase() ?? '';
	return MIME_BY_EXTENSION[extension] ?? (name.endsWith('.jpg') || name.endsWith('.jpeg') ? 'image/jpeg' : 'application/octet-stream');
}
