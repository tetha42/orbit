import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { getStoredFile } from '@/db';
import { authenticate } from '@/lib/auth/access';
import { canReadUpload } from '@/lib/vaultAccess';
import { UPLOAD_NAME_RE, mimeForName, uploadDir } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

const notFound = () => new Response('Not found', { status: 404 });

/**
 * Serves a private receipt.
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

	const filePath = path.join(uploadDir(), name);
	let size: number;
	try {
		size = (await stat(filePath)).size;
	} catch {
		return notFound();
	}

	const dosya = await getStoredFile(name);
	const mime = dosya?.mime ?? mimeForName(name);
	const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;

	// Chrome's native PDF viewer refuses to initialise under a sandboxed CSP, so
	// PDF gets the same strict sniffing/nosniff treatment without `sandbox`.
	const contentSecurityPolicy =
		mime === 'application/pdf'
			? "default-src 'none'; style-src 'unsafe-inline'"
			: "default-src 'none'; style-src 'unsafe-inline'; sandbox";

	return new Response(stream, {
		headers: {
			'Content-Type': mime,
			'Content-Length': String(size),
			'Content-Disposition': `inline; filename="${name}"`,
			// The type is fixed by the bytes we sniffed at upload; never let a browser guess.
			'X-Content-Type-Options': 'nosniff',
			'Content-Security-Policy': contentSecurityPolicy,
			'Cache-Control': 'private, no-cache',
		},
	});
}
