/**
 * What `GET /api/kurulum` tells an anonymous visitor. Pure — no imports — so the
 * production/development split and the cache are covered by scripts/check-pure.mjs.
 */

export interface KurulumDurumu {
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

export interface KurulumYaniti {
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

export const KURULUM_GENEL_MESAJ = 'Sunucu yöneticisi kurulumu tamamlamalı';

/** Production gets the generic message only, so no environment variable name can leak. */
export function kurulumYaniti(status: KurulumDurumu, nodeEnv: string | undefined): KurulumYaniti {
	if (status.hazir) {
		const res: KurulumYaniti = { hazir: true };
		if (status.step) res.step = status.step;
		if (status.brand) res.brand = status.brand;
		if (status.dbStatus) res.dbStatus = status.dbStatus;
		return res;
	}
	const yanit: KurulumYaniti = { hazir: false, mesaj: KURULUM_GENEL_MESAJ };
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
export function createKurulumCache(lookup: () => Promise<KurulumDurumu>, ttlMs: number, now: () => number = Date.now) {
	let entry: { at: number; result: Promise<KurulumDurumu> } | null = null;
	return () => {
		if (!entry || now() - entry.at >= ttlMs) entry = { at: now(), result: lookup() };
		return entry.result;
	};
}
