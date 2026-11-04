import { randomBytes } from 'crypto';
import type { PoolClient } from 'pg';
import { ensurePostgresInit, getPgPool, withTransaction } from '@/db/index';
import type { BudgetRecord } from '@/db/schema';
import { TRANSFER_CATEGORY, type BudgetCategory } from '@/types/budget';

/** Thrown when an expense — or removing an income — would take a kasa below zero. */
export class InsufficientFundsError extends Error {
	readonly netBalanceMinor: number;

	constructor(netBalanceMinor: number) {
		super('INSUFFICIENT_FUNDS');
		this.name = 'InsufficientFundsError';
		this.netBalanceMinor = netBalanceMinor;
	}
}

export interface CashTotals {
	/** `null` is the general kasa. */
	teamId: string | null;
	totalIncomeMinor: number;
	totalExpenseMinor: number;
	kayitSayisi: number;
}

/** WHERE fragment (with its parameters) that selects one kasa; `null` is the general kasa. */
function cashFilter(teamId: string | null): { sql: string; params: string[] } {
	return teamId === null
		? { sql: 'team_id IS NULL', params: [] }
		: { sql: 'team_id = $1', params: [teamId] };
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
		`SELECT COALESCE(SUM(CASE WHEN entry_type = 'gelir' THEN amount_minor ELSE -amount_minor END), 0) AS net
		 FROM budget_records WHERE ${filter.sql}`,
		filter.params
	);
	return Number(res.rows[0].net);
}

/** Income, expense and entry count for every kasa that has at least one entry. */
export async function getCashTotals(): Promise<CashTotals[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(`
		SELECT team_id AS "teamId",
		       COALESCE(SUM(CASE WHEN entry_type = 'gelir' THEN amount_minor ELSE 0 END), 0) AS gelir,
		       COALESCE(SUM(CASE WHEN entry_type = 'gider' THEN amount_minor ELSE 0 END), 0) AS gider,
		       COUNT(*)::int AS sayi
		FROM budget_records
		GROUP BY team_id
	`);
	return res.rows.map((r) => ({
		teamId: (r.teamId as string | null) ?? null,
		totalIncomeMinor: Number(r.gelir),
		totalExpenseMinor: Number(r.gider),
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
		SELECT b.id, b.date, b.entry_type AS "tur", b.category AS "kategori",
		       b.amount_minor AS "amountMinor", b.description AS "aciklama", b.receipt_url AS "fisFotoUrl",
		       b.recorded_by AS "kaydedenId", b.team_id AS "teamId", b.created_at AS "olusturma",
		       b.transfer_pair_id AS "aktarimId", b.updated_by AS "guncelleyenId", b.updated_at AS "guncellenme",
		       k.first_name || ' ' || k.last_name as "kaydedenAdSoyad",
		       g.first_name || ' ' || g.last_name as "guncelleyenAdSoyad",
		       CASE WHEN o.id IS NULL THEN NULL ELSE COALESCE(t.name, 'Genel Kasa') END as "karsiKasaAd"
		FROM budget_records b
		LEFT JOIN users k ON b.recorded_by = k.id
		LEFT JOIN users g ON b.updated_by = g.id
		LEFT JOIN budget_records o ON b.transfer_pair_id IS NOT NULL AND o.transfer_pair_id = b.transfer_pair_id AND o.id <> b.id
		LEFT JOIN teams t ON t.id = o.team_id
		WHERE b.${filter.sql}
		ORDER BY b.date DESC, b.created_at DESC
	`,
		filter.params
	);
	return res.rows;
}

export async function getBudgetRecordById(id: string): Promise<BudgetRecord | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT id, date, entry_type AS "tur", category AS "kategori", amount_minor AS "amountMinor",
		        description AS "aciklama", receipt_url AS "fisFotoUrl", recorded_by AS "kaydedenId",
		        team_id AS "teamId", created_at AS "olusturma", transfer_pair_id AS "aktarimId",
		        updated_by AS "guncelleyenId", updated_at AS "guncellenme"
		 FROM budget_records WHERE id = $1`,
		[id]
	);
	return (res.rows[0] as BudgetRecord | undefined) ?? null;
}

/** Which kasas reference this receipt file (usually one). `null` is the general kasa. */
export async function getBudgetTeamIdsByReceipt(url: string): Promise<(string | null)[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query('SELECT team_id AS "teamId" FROM budget_records WHERE receipt_url = $1', [url]);
	return res.rows.map((r) => (r.teamId as string | null) ?? null);
}

/**
 * Moves money from one kasa to another (typically the general kasa funding a
 * project). Writes an expense in the source and an income in the target, linked
 * by one `aktarimId`, after checking the source can cover it — all under both
 * kasas' locks, so the pair is never half-written and never overspends.
 */
export async function addOdenekAktarimi(params: {
	sourceTeamId: string | null;
	targetTeamId: string | null;
	amountMinor: number;
	aciklama: string;
	kaydedenId: string;
	date?: number;
}): Promise<{ aktarimId: string }> {
	const now = Date.now();
	const aktarimId = `akt_${now}_${randomBytes(4).toString('hex')}`;
	const date = params.date || now;
	await withTransaction(async (client) => {
		await lockCashRegisters(client, [params.sourceTeamId, params.targetTeamId]);
		const net = await cashNetCents(client, params.sourceTeamId);
		if (params.amountMinor > net) throw new InsufficientFundsError(net);
		const insert = (tur: 'gelir' | 'gider', teamId: string | null, suffix: string) =>
			client.query(
				`INSERT INTO budget_records (id, date, entry_type, category, amount_minor, description, receipt_url, recorded_by, team_id, created_at, transfer_pair_id)
				 VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $8, $9, $10)`,
				[`btc_${now}_${suffix}_${randomBytes(3).toString('hex')}`, date, tur, TRANSFER_CATEGORY, params.amountMinor, params.aciklama.trim(), params.kaydedenId, teamId, now, aktarimId]
			);
		await insert('gider', params.sourceTeamId, 'out');
		await insert('gelir', params.targetTeamId, 'in');
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
		const found = await client.query('SELECT id, transfer_pair_id AS "aktarimId" FROM budget_records WHERE id = $1 FOR UPDATE', [id]);
		const row = found.rows[0] as { id: string; aktarimId: string | null } | undefined;
		if (!row) return 'yok';
		if (row.aktarimId && (changes.kategori !== undefined || changes.fisFotoUrl !== undefined)) return 'aktarim';

		const sets: string[] = [];
		const values: unknown[] = [];
		const set = (column: string, value: unknown) => {
			values.push(value);
			sets.push(`${column} = $${values.length}`);
		};
		if (changes.aciklama !== undefined) set('description', changes.aciklama.trim());
		if (changes.kategori !== undefined) set('category', changes.kategori);
		if (changes.date !== undefined) set('date', changes.date);
		if (changes.fisFotoUrl !== undefined) set('receipt_url', changes.fisFotoUrl);
		if (sets.length === 0) return 'ok';
		set('updated_by', guncelleyenId);
		set('updated_at', Date.now());

		values.push(row.aktarimId ?? row.id);
		const where = row.aktarimId ? `transfer_pair_id = $${values.length}` : `id = $${values.length}`;
		await client.query(`UPDATE budget_records SET ${sets.join(', ')} WHERE ${where}`, values);
		return 'ok';
	});
}

export async function createBudgetRecord(params: {
	tur: 'gelir' | 'gider';
	kategori: BudgetCategory;
	amountMinor: number;
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
		amountMinor: Math.round(params.amountMinor),
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
			if (registration.amountMinor > net) throw new InsufficientFundsError(net);
		}
		await client.query(
			`INSERT INTO budget_records (id, date, entry_type, category, amount_minor, description, receipt_url, recorded_by, team_id, created_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
			[
				registration.id,
				registration.date,
				registration.tur,
				registration.kategori,
				registration.amountMinor,
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
		const found = await client.query('SELECT entry_type AS "tur", amount_minor AS "amountMinor", team_id AS "teamId", transfer_pair_id AS "aktarimId" FROM budget_records WHERE id = $1', [id]);
		const row = found.rows[0];
		if (!row) return false;

		const rows: { tur: string; amountMinor: number; teamId: string | null }[] = row.aktarimId
			? (await client.query('SELECT entry_type AS "tur", amount_minor AS "amountMinor", team_id AS "teamId" FROM budget_records WHERE transfer_pair_id = $1', [row.aktarimId])).rows
			: [row];
		await lockCashRegisters(client, rows.map((r) => r.teamId ?? null));

		// Removing income lowers that kasa's balance; refuse if expenses have already spent it.
		for (const r of rows) {
			if (r.tur !== 'gelir') continue;
			const teamId = r.teamId ?? null;
			const net = await cashNetCents(client, teamId);
			if (net - Number(r.amountMinor) < 0) throw new InsufficientFundsError(net);
		}

		const res = row.aktarimId
			? await client.query('DELETE FROM budget_records WHERE transfer_pair_id = $1', [row.aktarimId])
			: await client.query('DELETE FROM budget_records WHERE id = $1', [id]);
		return (res.rowCount ?? 0) > 0;
	});
}
