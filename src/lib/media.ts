/**
 * Attachment sniffing for chat.
 *
 * The declared MIME type and file name are attacker-controlled. Everything that
 * is rendered inline (images, video, audio, PDF, text) is identified from the
 * bytes; office/archive formats are only accepted with a known container magic
 * and are served as downloads, never executed by the browser.
 */

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export type MediaKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'document' | 'archive';

export interface SniffedMedia {
	mime: string;
	ext: string;
	kind: MediaKind;
}

const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'csv', 'json', 'log', 'yaml', 'yml', 'xml']);

function isProbablyUtf8Text(buffer: Buffer): boolean {
	if (buffer.includes(0)) return false;
	const sample = buffer.subarray(0, Math.min(buffer.length, 65536)).toString('utf8');
	// Replacement characters mean invalid UTF-8, so the file is not shown inline.
	return !sample.includes('\uFFFD');
}

function extensionOf(name: string): string {
	const parts = name.toLowerCase().split('.');
	return parts.length > 1 ? parts.pop() ?? '' : '';
}

/**
 * @param buffer file bytes
 * @param fileName the client's file name, used only to distinguish text and
 *                 office containers whose magic bytes are shared
 */
export function sniffMedia(buffer: Buffer, fileName: string): SniffedMedia | null {
	if (buffer.length === 0) return null;

	// Images
	if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
		return { mime: 'image/jpeg', ext: '.jpg', kind: 'image' };
	}
	if (
		buffer.length >= 8 &&
		buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
	) {
		return { mime: 'image/png', ext: '.png', kind: 'image' };
	}
	if (
		buffer.length >= 12 &&
		buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
		buffer.subarray(8, 12).toString('latin1') === 'WEBP'
	) {
		return { mime: 'image/webp', ext: '.webp', kind: 'image' };
	}
	if (buffer.length >= 6 && buffer.subarray(0, 4).toString('latin1') === 'GIF8') {
		return { mime: 'image/gif', ext: '.gif', kind: 'image' };
	}
	if (buffer.length >= 12 && buffer.subarray(4, 12).toString('latin1') === 'ftypavif') {
		return { mime: 'image/avif', ext: '.avif', kind: 'image' };
	}

	// PDF
	if (buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-') {
		return { mime: 'application/pdf', ext: '.pdf', kind: 'pdf' };
	}

	// ISO base media (MP4, M4A, MOV). The brand at bytes 8..12 distinguishes them.
	if (buffer.length >= 12 && buffer.subarray(4, 8).toString('latin1') === 'ftyp') {
		const brand = buffer.subarray(8, 12).toString('latin1');
		const extension = extensionOf(fileName);
		if (/^(M4A|M4B)/.test(brand) || extension === 'm4a' || extension === 'm4b') {
			return { mime: 'audio/mp4', ext: '.m4a', kind: 'audio' };
		}
		if (/^(qt)/.test(brand)) {
			return { mime: 'video/quicktime', ext: '.mov', kind: 'video' };
		}
		return { mime: 'video/mp4', ext: '.mp4', kind: 'video' };
	}
	// WebM / Matroska
	if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
		const webmExtension = extensionOf(fileName);
		if (webmExtension === 'mkv' || webmExtension === 'mk3d') {
			return { mime: 'video/x-matroska', ext: '.mkv', kind: 'video' };
		}
		if (webmExtension === 'mka') {
			return { mime: 'audio/x-matroska', ext: '.mka', kind: 'audio' };
		}
		if (webmExtension === 'weba') {
			return { mime: 'audio/webm', ext: '.weba', kind: 'audio' };
		}
		return { mime: 'video/webm', ext: '.webm', kind: 'video' };
	}
	// Ogg (audio or video; the browser sniffs the codec itself)
	if (buffer.length >= 4 && buffer.subarray(0, 4).toString('latin1') === 'OggS') {
		return { mime: 'audio/ogg', ext: '.ogg', kind: 'audio' };
	}
	// WAV
	if (
		buffer.length >= 12 &&
		buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
		buffer.subarray(8, 12).toString('latin1') === 'WAVE'
	) {
		return { mime: 'audio/wav', ext: '.wav', kind: 'audio' };
	}
	// MP3: ID3 tag or an MPEG frame sync
	if (
		(buffer.length >= 3 && buffer.subarray(0, 3).toString('latin1') === 'ID3') ||
		(buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
	) {
		return { mime: 'audio/mpeg', ext: '.mp3', kind: 'audio' };
	}
	// FLAC
	if (buffer.length >= 4 && buffer.subarray(0, 4).toString('latin1') === 'fLaC') {
		return { mime: 'audio/flac', ext: '.flac', kind: 'audio' };
	}

	// ZIP container: office documents, ODF, and plain archives. The browser
	// never executes these, so the exact type is only used for the file card.
	if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
		const extension = extensionOf(fileName);
		const office: Record<string, string> = {
			docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
			odt: 'application/vnd.oasis.opendocument.text',
			ods: 'application/vnd.oasis.opendocument.spreadsheet',
			odp: 'application/vnd.oasis.opendocument.presentation',
			epub: 'application/epub+zip',
		};
		if (office[extension]) {
			return { mime: office[extension], ext: `.${extension}`, kind: 'document' };
		}
		return { mime: 'application/zip', ext: '.zip', kind: 'archive' };
	}
	// Legacy OLE office files (doc/xls/ppt)
	if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) {
		const extension = extensionOf(fileName);
		const legacy: Record<string, string> = {
			doc: 'application/msword',
			xls: 'application/vnd.ms-excel',
			ppt: 'application/vnd.ms-powerpoint',
		};
		return {
			mime: legacy[extension] ?? 'application/x-ole-storage',
			ext: extension ? `.${extension}` : '.bin',
			kind: 'document',
		};
	}

	// Plain text / Markdown / JSON. The bytes must be valid UTF-8 with no NULs.
	const extension = extensionOf(fileName);
	if (TEXT_EXTENSIONS.has(extension) && isProbablyUtf8Text(buffer)) {
		const mime =
			extension === 'md' || extension === 'markdown'
				? 'text/markdown'
				: extension === 'json'
					? 'application/json'
					: extension === 'csv'
						? // eslint-disable-next-line no-restricted-syntax -- MIME type, not a CSV download.
						  'text/csv'
						: 'text/plain';
		return { mime, ext: `.${extension}`, kind: 'text' };
	}

	return null;
}
