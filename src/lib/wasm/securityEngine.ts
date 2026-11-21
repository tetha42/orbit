import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

declare global {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	var Go: any;
	var __orbit_wasm_sha256: ((data: string) => string) | undefined;
	var __orbit_wasm_verify_certificate:
		| ((code: string) => { valid: boolean; kind: 'official_doc' | 'certificate' | 'unknown' })
		| undefined;
	var __orbit_wasm_timing_safe_equal: ((a: string, b: string) => boolean) | undefined;
	var __orbit_wasm_active: boolean | undefined;
}

// Load Go WebAssembly runtime polyfill if not present
if (typeof globalThis.Go === 'undefined') {
	try {
		const wasmExecPath = path.resolve(process.cwd(), 'public/wasm/wasm_exec.js');
		if (fs.existsSync(wasmExecPath)) {
			const code = fs.readFileSync(wasmExecPath, 'utf8');
			new Function(code)();
		}
	} catch {
		// Environment without local filesystem or wasm_exec
	}
}

let isLoaded = false;
let initPromise: Promise<boolean> | null = null;

export async function initWasmEngine(): Promise<boolean> {
	if (isLoaded) return true;
	if (typeof globalThis.Go === 'undefined') return false;

	try {
		const wasmPath = path.resolve(process.cwd(), 'public/wasm/security_engine.wasm');
		if (!fs.existsSync(wasmPath)) return false;

		const bytes = fs.readFileSync(wasmPath);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const go = new (globalThis as any).Go();
		const result = await WebAssembly.instantiate(bytes, go.importObject);
		// Run Go program in background (keeps listening on channel)
		void go.run(result.instance);
		isLoaded = Boolean(globalThis.__orbit_wasm_active);
		return isLoaded;
	} catch {
		isLoaded = false;
		return false;
	}
}

// Initialise eagerly in background
initPromise = initWasmEngine().catch(() => false);
void initPromise;

export function isWasmEngineActive(): boolean {
	return Boolean(isLoaded && globalThis.__orbit_wasm_active);
}

/**
 * Computes SHA-256 fingerprint for document verification.
 * Accelerated with WASM engine when initialized, with automatic native fallback.
 */
export function computeDocumentDigestWasm(
	referenceNumber: string | number,
	title: string,
	date: string | number,
	content: string
): string {
	const raw = [referenceNumber, title, date, content].join('\u0000');
	let hex = '';

	if (isWasmEngineActive() && typeof globalThis.__orbit_wasm_sha256 === 'function') {
		try {
			hex = globalThis.__orbit_wasm_sha256(raw).toUpperCase();
		} catch {
			hex = crypto.createHash('sha256').update(raw).digest('hex').toUpperCase();
		}
	} else {
		hex = crypto.createHash('sha256').update(raw).digest('hex').toUpperCase();
	}

	return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`;
}

/**
 * High-speed verification of digital certificate codes.
 * Uses WASM pattern matcher when ready, with local regex fallback.
 */
export function verifyCertificateFormatWasm(code: string): {
	valid: boolean;
	kind: 'official_doc' | 'certificate' | 'unknown';
} {
	const cleaned = (code || '').trim().toUpperCase();

	if (isWasmEngineActive() && typeof globalThis.__orbit_wasm_verify_certificate === 'function') {
		try {
			return globalThis.__orbit_wasm_verify_certificate(cleaned);
		} catch {
			// fallback
		}
	}

	if (/^(?:BEU-EVRAK|BEU-DOC|ORBIT-DOC)-\d{5,9}$/.test(cleaned)) {
		return { valid: true, kind: 'official_doc' };
	}
	if (/^(?:(?:ORB|ORBIT|BEU)-\d{4}-[A-Z0-9]{3,4}-[A-Z0-9]{4}|[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})$/.test(cleaned)) {
		return { valid: true, kind: 'certificate' };
	}
	return { valid: false, kind: 'unknown' };
}

/**
 * Validates cryptographic checksums in constant time to prevent timing side channels.
 */
export function timingSafeEqualWasm(a: string, b: string): boolean {
	if (isWasmEngineActive() && typeof globalThis.__orbit_wasm_timing_safe_equal === 'function') {
		try {
			return globalThis.__orbit_wasm_timing_safe_equal(a, b);
		} catch {
			// fallback
		}
	}

	const bufA = Buffer.from(a, 'utf8');
	const bufB = Buffer.from(b, 'utf8');
	if (bufA.length !== bufB.length) return false;
	return crypto.timingSafeEqual(bufA, bufB);
}
