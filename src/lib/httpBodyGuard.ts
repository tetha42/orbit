const sharedDecoder = new TextDecoder();

export class PayloadTooLargeError extends Error {
	readonly limitBytes: number;

	constructor(limitBytes: number) {
		super(`Payload exceeds maximum allowed limit (${limitBytes} bytes).`);
		this.name = 'PayloadTooLargeError';
		this.limitBytes = limitBytes;
	}
}

export class InvalidBodyError extends Error {
	constructor(message = 'Invalid request payload.') {
		super(message);
		this.name = 'InvalidBodyError';
	}
}

export function checkDeclaredContentLength(
	request: Request,
	maxBytes: number,
): boolean {
	const rawLen = request.headers.get('content-length');
	if (!rawLen) return true;
	const declared = Number(rawLen);
	if (!Number.isFinite(declared) || declared < 0) return false;
	return declared <= maxBytes;
}

export async function readBoundedBytes(
	request: Request,
	maxBytes: number,
): Promise<ArrayBuffer> {
	if (!checkDeclaredContentLength(request, maxBytes)) {
		throw new PayloadTooLargeError(maxBytes);
	}

	if (!request.body) {
		const ab = await request.arrayBuffer();
		if (ab.byteLength > maxBytes) {
			throw new PayloadTooLargeError(maxBytes);
		}
		return ab;
	}

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let totalBytes = 0;

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (!value || value.byteLength === 0) continue;

			totalBytes += value.byteLength;
			if (totalBytes > maxBytes) {
				await reader.cancel().catch(() => {});
				throw new PayloadTooLargeError(maxBytes);
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}

	if (chunks.length === 0) {
		return new ArrayBuffer(0);
	}
	if (chunks.length === 1) {
		const single = chunks[0];
		if (
			single.byteOffset === 0 &&
			single.byteLength === single.buffer.byteLength &&
			single.buffer instanceof ArrayBuffer
		) {
			return single.buffer;
		}
		return single.slice().buffer;
	}

	const out = new ArrayBuffer(totalBytes);
	const view = new Uint8Array(out);
	let offset = 0;
	for (const chunk of chunks) {
		view.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return out;
}

export async function readBoundedJson<T = unknown>(
	request: Request,
	maxBytes: number,
): Promise<T> {
	const ab = await readBoundedBytes(request, maxBytes);
	const text = sharedDecoder.decode(ab);
	if (!text.trim()) {
		throw new InvalidBodyError('Empty JSON payload.');
	}
	try {
		return JSON.parse(text) as T;
	} catch {
		throw new InvalidBodyError('Malformed JSON payload.');
	}
}

export async function readBoundedFormData(
	request: Request,
	maxBytes: number,
): Promise<FormData> {
	const ab = await readBoundedBytes(request, maxBytes);
	const headers = new Headers(request.headers);
	headers.delete('content-length');
	headers.delete('transfer-encoding');

	const boundedRequest = new Request(request.url, {
		method: request.method,
		headers,
		body: ab,
	});
	try {
		return await boundedRequest.formData();
	} catch {
		throw new InvalidBodyError('Malformed multipart form payload.');
	}
}
