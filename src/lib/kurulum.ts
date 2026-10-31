/**
 * What `GET /api/kurulum` tells an anonymous visitor. Pure — no imports — so the
 * production/development split and the cache are covered by scripts/check-pure.mjs.
 */

export interface SetupStatus {
	hazir: boolean;
	firstRun?: boolean;
	/** Why setup is incomplete, naming the missing variables. Never leaves the server in production. */
	sebep?: string;
	step?: 'database' | 'identity' | 'admin' | 'ready';
	dbStatus?: { connected: boolean; configured: boolean; databaseName?: string; error?: string };
	brand?: {
		studioName: string;
		communityName: string;
		domain: string;
	};
}

export interface SetupResponse {
	hazir: boolean;
	firstRun?: boolean;
	step?: 'database' | 'identity' | 'admin' | 'ready';
	dbStatus?: { connected: boolean; configured: boolean; databaseName?: string; error?: string };
	brand?: {
		studioName: string;
		communityName: string;
		domain: string;
	};
	/** Generic and safe for everyone: set whenever setup is incomplete. */
	mesaj?: string;
	/** Development only. */
	sebep?: string;
}

export const SETUP_GENERAL_MESSAGE = 'Sunucu yöneticisi kurulumu tamamlamalı';

/** Production gets the generic message only, so no environment variable name can leak. */
export function setupResponse(status: SetupStatus, nodeEnv: string | undefined): SetupResponse {
	if (status.hazir) {
		const res: SetupResponse = { hazir: true };
		if (status.step) res.step = status.step;
		if (status.brand) res.brand = status.brand;
		if (status.dbStatus) res.dbStatus = status.dbStatus;
		return res;
	}
	const yanit: SetupResponse = { hazir: false, mesaj: SETUP_GENERAL_MESSAGE };
	if (status.firstRun) yanit.firstRun = true;
	if (status.step) yanit.step = status.step;
	if (status.brand) yanit.brand = status.brand;
	if (status.dbStatus) yanit.dbStatus = status.dbStatus;
	if (nodeEnv !== 'production' && status.sebep) yanit.sebep = status.sebep;
	return yanit;
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
