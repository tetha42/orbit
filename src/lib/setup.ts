import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

/**
 * What `GET /api/setup` tells an anonymous visitor.
 */

export interface SetupStatus {
	ready: boolean;
	firstRun?: boolean;
	/** Why setup is incomplete, naming the missing variables. Never leaves the server in production. */
	reason?: string;
	step?: 'database' | 'identity' | 'admin' | 'ready';
	dbStatus?: { connected: boolean; configured: boolean; databaseName?: string; error?: string };
	brand?: {
		studioName: string;
		communityName: string;
		domain: string;
	};
}

export interface SetupResponse {
	ready: boolean;
	firstRun?: boolean;
	step?: 'database' | 'identity' | 'admin' | 'ready';
	dbStatus?: { connected: boolean; configured: boolean; databaseName?: string; error?: string };
	brand?: {
		studioName: string;
		communityName: string;
		domain: string;
	};
	/** Generic and safe for everyone: set whenever setup is incomplete. */
	message?: string;
	/** Development only. */
	reason?: string;
}

export const SETUP_GENERAL_MESSAGE = 'The server administrator has to finish the setup.';

/** Production gets the generic message only, so no environment variable name can leak. */
export function setupResponse(status: SetupStatus, nodeEnv: string | undefined): SetupResponse {
	if (status.ready) {
		const res: SetupResponse = { ready: true };
		if (status.step) res.step = status.step;
		if (status.brand) res.brand = status.brand;
		if (status.dbStatus) res.dbStatus = status.dbStatus;
		return res;
	}
	const response: SetupResponse = { ready: false, message: SETUP_GENERAL_MESSAGE };
	if (status.firstRun) response.firstRun = true;
	if (status.step) response.step = status.step;
	if (status.brand) response.brand = status.brand;
	if (status.dbStatus) response.dbStatus = status.dbStatus;
	if (nodeEnv !== 'production' && status.reason) response.reason = status.reason;
	return response;
}

/**
 * The endpoint needs no session, so anyone can call it as often as they like:
 * the answer (or the failure) is shared for `ttlMs`, and concurrent callers
 * share one lookup, so the database sees at most one query per window.
 */
export function createSetupCache(lookup: () => Promise<SetupStatus>, ttlMs: number, now: () => number = Date.now) {
	let entry: { at: number; result: Promise<SetupStatus> } | null = null;
	return () => {
		if (!entry || now() - entry.at >= ttlMs) entry = { at: now(), result: lookup() };
		return entry.result;
	};
}

let setupLockedInMemory = false;

function setupDataPath(...segments: string[]): string {
	const base = path.resolve(/*turbopackIgnore: true*/ process.cwd(), 'data');
	return segments.length ? path.join(/*turbopackIgnore: true*/ base, ...segments) : base;
}

/**
 * Checks whether setup is permanently locked via disk marker (data/setup.lock)
 * or in-memory state.
 */
export function isSetupLocked(): boolean {
	if (setupLockedInMemory) return true;
	try {
		const lockPath = setupDataPath('setup.lock');
		if (fs.existsSync(/*turbopackIgnore: true*/ lockPath)) {
			setupLockedInMemory = true;
			return true;
		}
	} catch {
		// Ignore read error
	}
	return false;
}

/**
 * Permanently locks setup by creating data/setup.lock and wiping data/orbit.setup.token.
 */
export function markSetupLocked(): void {
	setupLockedInMemory = true;
	try {
		const dataDir = setupDataPath();
		if (!fs.existsSync(/*turbopackIgnore: true*/ dataDir)) {
			fs.mkdirSync(/*turbopackIgnore: true*/ dataDir, { recursive: true });
		}
		const lockPath = setupDataPath('setup.lock');
		fs.writeFileSync(/*turbopackIgnore: true*/ lockPath, `locked_at=${Date.now()}\n`, {
			encoding: 'utf8',
			mode: 0o600,
		});
	} catch (err) {
		console.error('[Orbit Setup] Could not write setup.lock:', err);
	}

	try {
		const tokenPath = setupDataPath('orbit.setup.token');
		if (fs.existsSync(/*turbopackIgnore: true*/ tokenPath)) {
			fs.unlinkSync(/*turbopackIgnore: true*/ tokenPath);
		}
	} catch {
		// Ignore unlink error
	}
}

/**
 * Reads the existing setup token from disk if present.
 */
export function getSetupToken(): string | null {
	try {
		const tokenPath = setupDataPath('orbit.setup.token');
		if (fs.existsSync(/*turbopackIgnore: true*/ tokenPath)) {
			const tok = fs.readFileSync(/*turbopackIgnore: true*/ tokenPath, 'utf8').trim();
			if (tok) return tok;
		}
	} catch {
		// Ignore read error
	}
	return null;
}

/**
 * Builds the canonical first-run setup URL containing the setup token.
 */
export function resolveSetupUrl(token: string, baseUrlOverride?: string): string {
	const fallbackUrl = `http://localhost:${process.env.PORT?.trim() || '3000'}`;
	const base = (baseUrlOverride || process.env.PUBLIC_BASE_URL?.trim() || fallbackUrl).replace(/\/+$/, '');
	return `${base}/setup#token=${token}`;
}

function announceSetupTokenOnce(token: string, newlyGenerated: boolean): void {
	if (process.env.ORBIT_SILENT_SETUP_BANNER === '1') return;
	const g = globalThis as { __orbitSetupBannerPrinted?: boolean };
	if (g.__orbitSetupBannerPrinted) return;
	g.__orbitSetupBannerPrinted = true;

	const heading = newlyGenerated
		? '   ORBIT FIRST-RUN SETUP TOKEN GENERATED'
		: '   ORBIT SETUP WIZARD READY (LOCKED AFTER COMPLETION)';
	console.log('\n================================================================');
	console.log(heading);
	console.log(`   Token: ${token}`);
	console.log(`   Setup URL: ${resolveSetupUrl(token)}`);
	console.log('================================================================\n');
}

/**
 * Generates and saves a 32-hex setup token to data/orbit.setup.token (0600)
 * if setup is incomplete and BOOTSTRAP_ADMIN_PASSWORD is not provided.
 */
export function ensureSetupToken(options?: { announce?: boolean }): string | null {
	const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim();
	if (bootstrapPassword && bootstrapPassword.length >= 12) {
		return null;
	}

	if (isSetupLocked()) {
		return null;
	}

	try {
		const dataDir = setupDataPath();
		if (!fs.existsSync(/*turbopackIgnore: true*/ dataDir)) {
			fs.mkdirSync(/*turbopackIgnore: true*/ dataDir, { recursive: true });
		}
		const tokenPath = setupDataPath('orbit.setup.token');
		if (fs.existsSync(/*turbopackIgnore: true*/ tokenPath)) {
			const existing = fs.readFileSync(/*turbopackIgnore: true*/ tokenPath, 'utf8').trim();
			if (existing && existing.length === 32) {
				if (options?.announce === true) {
					announceSetupTokenOnce(existing, false);
				}
				return existing;
			}
		}

		const token = crypto.randomBytes(16).toString('hex');
		fs.writeFileSync(/*turbopackIgnore: true*/ tokenPath, token, { mode: 0o600 });
		try {
			fs.chmodSync(/*turbopackIgnore: true*/ tokenPath, 0o600);
		} catch {
			// Permission hardening is best-effort on non-POSIX filesystems
		}

		if (options?.announce !== false) {
			announceSetupTokenOnce(token, true);
		}

		return token;
	} catch (err) {
		console.error('[Orbit Setup] Could not ensure setup token:', err);
		return null;
	}
}

/**
 * Validates a candidate setup token.
 * Returns true if BOOTSTRAP_ADMIN_PASSWORD is set, or if the candidate token
 * matches data/orbit.setup.token using timingSafeEqual.
 */
export function validateSetupToken(candidateToken: string | null | undefined): boolean {
	const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim();
	if (bootstrapPassword && bootstrapPassword.length >= 12) {
		return true;
	}

	const diskToken = getSetupToken() || ensureSetupToken({ announce: false });
	if (!diskToken) {
		return false;
	}

	if (!candidateToken) {
		return false;
	}

	const cleanCandidate = candidateToken.trim();
	if (cleanCandidate.length !== diskToken.length) {
		return false;
	}

	try {
		return crypto.timingSafeEqual(Buffer.from(cleanCandidate), Buffer.from(diskToken));
	} catch {
		return false;
	}
}
