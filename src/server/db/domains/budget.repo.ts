import { randomBytes } from 'crypto';
import type { PoolClient } from 'pg';
import { ensurePostgresInit, getPgPool, withTransaction } from '@/db/index';
import type { BudgetRecord } from '@/db/schema';
import { AKTARIM_KATEGORISI, type BudgetCategory } from '@/types/budget';

/** Thrown when an expense — or removing an income — would take a kasa below zero. */
export class InsufficientFundsError extends Error {
	readonly netBakiyeKurus: number;

	constructor(netBakiyeKurus: number) {
		super('INSUFFICIENT_FUNDS');
		this.name = 'InsufficientFundsError';
		this.netBakiyeKurus = netBakiyeKurus;
	}
}

export interface CashTotals {
	/** `null` is the general kasa. */
	teamId: string | null;
	toplamGelirKurus: number;
	toplamGiderKurus: number;
	kayitSayisi: number;
}

/** WHERE fragment (with its parameters) that selects one kasa; `null` is the general kasa. */
function cashFilter(teamId: string | null): { sql: string; params: string[] } {
	return teamId === null
		? { sql: 'teamId IS NULL', params: [] }
		: { sql: 'teamId = $1', params: [teamId] };
}

/**
 * Serialises writers to one kasa until the transaction ends, so two expenses that
 * arrive together cannot both pass the balance check and overspend.
 */
async function lockCashRegister(client: PoolClient, teamId: string | null): Promise<void> {
	await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`kasa:${teamId ?? 'genel'}`]);
}

/** Locks several kasas in one fixed order, so two allocations in opposite directions cannot deadlock. */
async function lockCashRegisters(client: PoolClient, kasalar: (string | null)[]): Promise<void> {
	const keys = [...new Set(kasalar.map((k) => k ?? ''))].sort();
	for (const key of keys) await lockCashRegister(client, key || null);
}

async function cashNetCents(client: PoolClient, teamId: string | null): Promise<number> {
	const filter = cashFilter(teamId);
	const res = await client.query(
		`SELECT COALESCE(SUM(CASE WHEN tur = 'gelir' THEN tutarKurus ELSE -tutarKurus END), 0) AS net
		 FROM butce_kayitlari WHERE ${filter.sql}`,
		filter.params
	);
	return Number(res.rows[0].net);
}

/** Income, expense and entry count for every kasa that has at least one entry. */
export async function getCashTotals(): Promise<CashTotals[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(`
		SELECT teamId,
		       COALESCE(SUM(CASE WHEN tur = 'gelir' THEN tutarKurus ELSE 0 END), 0) AS gelir,
		       COALESCE(SUM(CASE WHEN tur = 'gider' THEN tutarKurus ELSE 0 END), 0) AS gider,
		       COUNT(*)::int AS sayi
		FROM butce_kayitlari
		GROUP BY teamId
	`);
	return res.rows.map((r) => ({
		teamId: (r.teamId as string | null) ?? null,
		toplamGelirKurus: Number(r.gelir),
		toplamGiderKurus: Number(r.gider),
		kayitSayisi: Number(r.sayi),
	}));
}

/**
 * One kasa's entries, newest first. `teamId === null` is the general kasa.
 * An allocation row also names the kasa on its other side.
 */
export async function getBudgetRecords(teamId: string | null): Promise<BudgetRecord[]> {
	await ensurePostgresInit();
	const filter = cashFilter(teamId);
	const res = await getPgPool().query(
		`
		SELECT b.*,
		       k.ad || ' ' || k.soyad as "kaydedenAdSoyad",
		       g.ad || ' ' || g.soyad as "guncelleyenAdSoyad",
		       CASE WHEN o.id IS NULL THEN NULL ELSE COALESCE(t.ad, 'Genel Kasa') END as "karsiKasaAd"
		FROM butce_kayitlari b
		LEFT JOIN kullanicilar k ON b.kaydedenId = k.id
		LEFT JOIN kullanicilar g ON b.guncelleyenId = g.id
		LEFT JOIN butce_kayitlari o ON b.aktarimId IS NOT NULL AND o.aktarimId = b.aktarimId AND o.id <> b.id
		LEFT JOIN takimlar t ON t.id = o.teamId
		WHERE b.${filter.sql}
		ORDER BY b.date DESC, b.olusturma DESC
	`,
		filter.params
	);
	return res.rows;
}

export async function getBudgetRecordById(id: string): Promise<BudgetRecord | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query('SELECT * FROM butce_kayitlari WHERE id = $1', [id]);
	return (res.rows[0] as BudgetRecord | undefined) ?? null;
}

/** Which kasas reference this receipt file (usually one). `null` is the general kasa. */
export async function getBudgetTeamIdsByReceipt(url: string): Promise<(string | null)[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query('SELECT teamId FROM butce_kayitlari WHERE fisFotoUrl = $1', [url]);
	return res.rows.map((r) => (r.teamId as string | null) ?? null);
}

/**
 * Moves money from one kasa to another (typically the general kasa funding a
 * project). Writes an expense in the source and an income in the target, linked
 * by one `aktarimId`, after checking the source can cover it — all under both
 * kasas' locks, so the pair is never half-written and never overspends.
 */
export async function addOdenekAktarimi(params: {
	kaynakTakimId: string | null;
	hedefTakimId: string | null;
	tutarKurus: number;
	aciklama: string;
	kaydedenId: string;
	date?: number;
}): Promise<{ aktarimId: string }> {
	const now = Date.now();
	const aktarimId = `akt_${now}_${randomBytes(4).toString('hex')}`;
	const date = params.date || now;
	await withTransaction(async (client) => {
		await lockCashRegisters(client, [params.kaynakTakimId, params.hedefTakimId]);
		const net = await cashNetCents(client, params.kaynakTakimId);
		if (params.tutarKurus > net) throw new InsufficientFundsError(net);
		const insert = (tur: 'gelir' | 'gider', teamId: string | null, suffix: string) =>
			client.query(
				`INSERT INTO butce_kayitlari (id, date, tur, kategori, tutarKurus, aciklama, fisFotoUrl, kaydedenId, teamId, olusturma, aktarimId)
				 VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $8, $9, $10)`,
				[`btc_${now}_${suffix}_${randomBytes(3).toString('hex')}`, date, tur, AKTARIM_KATEGORISI, params.tutarKurus, params.aciklama.trim(), params.kaydedenId, teamId, now, aktarimId]
			);
		await insert('gider', params.kaynakTakimId, 'out');
		await insert('gelir', params.hedefTakimId, 'in');
	});
	return { aktarimId };
}

/**
 * Corrects an entry's description, category, date or receipt. Type and amount
 * stay as recorded — a wrong amount is deleted and entered again, so the balance
 * checks of add/delete always apply. Both rows of an allocation keep the same
 * description and date; its category is fixed.
 */
export async function updateBudgetRecord(
	id: string,
	changes: { aciklama?: string; kategori?: BudgetCategory; date?: number; fisFotoUrl?: string | null },
	guncelleyenId: string
): Promise<'ok' | 'yok' | 'aktarim'> {
	return withTransaction(async (client) => {
		const found = await client.query('SELECT id, aktarimId FROM butce_kayitlari WHERE id = $1 FOR UPDATE', [id]);
		const row = found.rows[0] as { id: string; aktarimId: string | null } | undefined;
		if (!row) return 'yok';
		if (row.aktarimId && (changes.kategori !== undefined || changes.fisFotoUrl !== undefined)) return 'aktarim';

		const sets: string[] = [];
		const values: unknown[] = [];
		const set = (column: string, value: unknown) => {
			values.push(value);
			sets.push(`${column} = $${values.length}`);
		};
		if (changes.aciklama !== undefined) set('aciklama', changes.aciklama.trim());
		if (changes.kategori !== undefined) set('kategori', changes.kategori);
		if (changes.date !== undefined) set('date', changes.date);
		if (changes.fisFotoUrl !== undefined) set('fisFotoUrl', changes.fisFotoUrl);
		if (sets.length === 0) return 'ok';
		set('guncelleyenId', guncelleyenId);
		set('guncellenme', Date.now());

		values.push(row.aktarimId ?? row.id);
		const where = row.aktarimId ? `aktarimId = $${values.length}` : `id = $${values.length}`;
		await client.query(`UPDATE butce_kayitlari SET ${sets.join(', ')} WHERE ${where}`, values);
		return 'ok';
	});
}

export async function createBudgetRecord(params: {
	tur: 'gelir' | 'gider';
	kategori: BudgetCategory;
	tutarKurus: number;
	aciklama: string;
	kaydedenId: string;
	/** The project whose kasa this belongs to; omit for the general kasa. */
	teamId?: string | null;
	date?: number;
	fisFotoUrl?: string;
}): Promise<BudgetRecord> {
	const teamId = params.teamId ?? null;
	const id = `btc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
	const now = Date.now();
	const registration: BudgetRecord = {
		id,
		date: params.date || now,
		tur: params.tur,
		kategori: params.kategori,
		tutarKurus: Math.round(params.tutarKurus),
		aciklama: params.aciklama.trim(),
		fisFotoUrl: params.fisFotoUrl,
		kaydedenId: params.kaydedenId,
		teamId,
		olusturma: now,
	};

	// The balance check and the insert share one transaction and one kasa lock:
	// checking first and inserting afterwards let concurrent expenses overspend.
	await withTransaction(async (client) => {
		await lockCashRegister(client, teamId);
		if (registration.tur === 'gider') {
			const net = await cashNetCents(client, teamId);
			if (registration.tutarKurus > net) throw new InsufficientFundsError(net);
		}
		await client.query(
			`INSERT INTO butce_kayitlari (id, date, tur, kategori, tutarKurus, aciklama, fisFotoUrl, kaydedenId, teamId, olusturma)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
			[
				registration.id,
				registration.date,
				registration.tur,
				registration.kategori,
				registration.tutarKurus,
				registration.aciklama,
				registration.fisFotoUrl || null,
				registration.kaydedenId,
				teamId,
				registration.olusturma,
			]
		);
	});

	return registration;
}

/**
 * Deletes an entry — or, for an allocation, both of its rows together, since one
 * side alone would leave money appearing from nowhere.
 */
export async function deleteBudgetRecord(id: string): Promise<boolean> {
	return withTransaction(async (client) => {
		const found = await client.query('SELECT tur, tutarKurus, teamId, aktarimId FROM butce_kayitlari WHERE id = $1', [id]);
		const row = found.rows[0];
		if (!row) return false;

		const rows: { tur: string; tutarKurus: number; teamId: string | null }[] = row.aktarimId
			? (await client.query('SELECT tur, tutarKurus, teamId FROM butce_kayitlari WHERE aktarimId = $1', [row.aktarimId])).rows
			: [row];
		await lockCashRegisters(client, rows.map((r) => r.teamId ?? null));

		// Removing income lowers that kasa's balance; refuse if expenses have already spent it.
		for (const r of rows) {
			if (r.tur !== 'gelir') continue;
			const teamId = r.teamId ?? null;
			const net = await cashNetCents(client, teamId);
			if (net - Number(r.tutarKurus) < 0) throw new InsufficientFundsError(net);
		}

		const res = row.aktarimId
			? await client.query('DELETE FROM butce_kayitlari WHERE aktarimId = $1', [row.aktarimId])
			: await client.query('DELETE FROM butce_kayitlari WHERE id = $1', [id]);
		return (res.rowCount ?? 0) > 0;
	});
}
