import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import path from 'path';
import { getStoredFile } from '@/db';
import { authenticate } from '@/lib/auth/access';
import { canReadUpload } from '@/lib/vaultAccess';
import { UPLOAD_NAME_RE, mimeForName, uploadDir } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

const notFound = () => new Response('Not found', { status: 404 });

type ByteRangeResult =
	| { kind: 'full' }
	| { kind: 'partial'; start: number; end: number }
	| { kind: 'invalid' };

function parseByteRange(rangeHeader: string | null, size: number): ByteRangeResult {
	if (rangeHeader === null) return { kind: 'full' };
	if (size <= 0) return { kind: 'invalid' };

	const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
	if (!match) return { kind: 'invalid' };

	const [, startRaw, endRaw] = match;
	if (!startRaw && !endRaw) return { kind: 'invalid' };

	let start: number;
	let end: number;

	if (!startRaw) {
		const suffixLength = Number(endRaw);
		if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
			return { kind: 'invalid' };
		}
		start = Math.max(0, size - suffixLength);
		end = size - 1;
	} else {
		start = Number(startRaw);
		if (!Number.isSafeInteger(start) || start < 0 || start >= size) {
			return { kind: 'invalid' };
		}
		if (!endRaw) {
			end = size - 1;
		} else {
			const requestedEnd = Number(endRaw);
			if (!Number.isSafeInteger(requestedEnd) || requestedEnd < start) {
				return { kind: 'invalid' };
			}
			end = Math.min(size - 1, requestedEnd);
		}
	}

	return { kind: 'partial', start, end };
}

function streamFileToWeb(
	resolvedPath: string,
	range?: { start: number; end: number },
	signal?: AbortSignal
): ReadableStream<Uint8Array> {
	const nodeStream = createReadStream(resolvedPath, range);
	let closed = false;
	let abortHandler: (() => void) | undefined;

	const cleanup = () => {
		if (abortHandler && signal) {
			signal.removeEventListener('abort', abortHandler);
			abortHandler = undefined;
		}
		closed = true;
		nodeStream.destroy();
	};

	return new ReadableStream<Uint8Array>({
		start(controller) {
			abortHandler = () => {
				if (closed) return;
				cleanup();
				try {
					controller.close();
				} catch {
					// Stream controller may already be closed when the request aborts.
				}
			};
			if (signal) {
				if (signal.aborted) {
					abortHandler();
					return;
				}
				signal.addEventListener('abort', abortHandler, { once: true });
			}
			nodeStream.on('data', (chunk: Buffer | string) => {
				if (closed) return;
				const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
				try {
					controller.enqueue(new Uint8Array(buf));
				} catch {
					// Consumer canceled mid-chunk; tear down the underlying file descriptor.
					cleanup();
					return;
				}
				if (controller.desiredSize !== null && controller.desiredSize <= 0) {
					nodeStream.pause();
				}
			});
			nodeStream.on('end', () => {
				if (closed) return;
				cleanup();
				try {
					controller.close();
				} catch {
					// Stream controller may already be closed if canceled concurrently.
				}
			});
			nodeStream.on('error', (err) => {
				if (closed) return;
				cleanup();
				try {
					controller.error(err);
				} catch {
					// Stream controller may already be closed if canceled concurrently.
				}
			});
		},
		pull() {
			if (!closed) nodeStream.resume();
		},
		cancel() {
			cleanup();
		},
	});
}

/**
 * Serves a private upload or byte-range slice.
 *
 * The name is matched against the exact shape the upload route generates before
 * it is joined to a path, so it cannot escape the upload directory. A file the
 * caller may not see answers 404, not 403 — its existence is not confirmed.
 */
export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
	const { name } = await params;
	if (!UPLOAD_NAME_RE.test(name)) return notFound();

	const auth = await authenticate(request);
	if (!auth.authorized) return auth.response;
	if (!(await canReadUpload(auth.user, name))) return notFound();

	const rootDir = path.resolve(uploadDir());
	const resolvedPath = path.resolve(rootDir, name);
	if (!resolvedPath.startsWith(rootDir + path.sep)) return notFound();

	let size: number;
	try {
		const fileStat = await stat(resolvedPath);
		if (!fileStat.isFile()) return notFound();
		size = fileStat.size;
	} catch {
		return notFound();
	}

	const range = parseByteRange(request.headers.get('range'), size);
	if (range.kind === 'invalid') {
		return new Response(null, {
			status: 416,
			headers: {
				'Content-Range': `bytes */${size}`,
				'Accept-Ranges': 'bytes',
				'Cache-Control': 'private, no-cache',
			},
		});
	}

	const file = await getStoredFile(name);
	const mime = file?.mime ?? mimeForName(name);

	// Chrome's native PDF viewer refuses to initialise under a sandboxed CSP, so
	// PDF gets the same strict sniffing/nosniff treatment without `sandbox`.
	const contentSecurityPolicy =
		mime === 'application/pdf'
			? "default-src 'none'; style-src 'unsafe-inline'"
			: "default-src 'none'; style-src 'unsafe-inline'; sandbox";

	const baseHeaders: Record<string, string> = {
		'Content-Type': mime,
		'Accept-Ranges': 'bytes',
		'Content-Disposition': `inline; filename="${name}"`,
		// The type is fixed by the bytes we sniffed at upload; never let a browser guess.
		'X-Content-Type-Options': 'nosniff',
		'Content-Security-Policy': contentSecurityPolicy,
		'Cache-Control': 'private, no-cache',
	};

	if (range.kind === 'partial') {
		const stream = streamFileToWeb(
			resolvedPath,
			{ start: range.start, end: range.end },
			request.signal
		);
		return new Response(stream, {
			status: 206,
			headers: {
				...baseHeaders,
				'Content-Length': String(range.end - range.start + 1),
				'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
			},
		});
	}

	const stream = streamFileToWeb(resolvedPath, undefined, request.signal);
	return new Response(stream, {
		status: 200,
		headers: {
			...baseHeaders,
			'Content-Length': String(size),
		},
	});
}
