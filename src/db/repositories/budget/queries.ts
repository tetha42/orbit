import { ensurePostgresInit, getPgPool } from '@/db/index';
import type { BudgetRecord } from '@/db/schema';
import { cashFilter, type CashTotals } from './helpers';

/** Income, expense and entry count for every vault that has at least one entry. */
export async function getCashTotals(): Promise<CashTotals[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(`
		SELECT team_id AS "teamId",
		       COALESCE(SUM(CASE WHEN entry_type = 'income' THEN amount_minor ELSE 0 END), 0) AS income,
		       COALESCE(SUM(CASE WHEN entry_type = 'expense' THEN amount_minor ELSE 0 END), 0) AS expense,
		       COUNT(*)::int AS count
		FROM budget_records
		GROUP BY team_id
	`);
	return res.rows.map((r) => ({
		teamId: (r.teamId as string | null) ?? null,
		totalIncomeMinor: Number(r.income),
		totalExpenseMinor: Number(r.expense),
		recordCount: Number(r.count),
	}));
}

/**
 * One vault's entries, newest first. `teamId === null` is the general vault.
 * An allocation row also names the vault on its other side.
 */
export async function getBudgetRecords(teamId: string | null): Promise<BudgetRecord[]> {
	await ensurePostgresInit();
	const filter = cashFilter(teamId);
	const res = await getPgPool().query(
		`
		SELECT b.id, b.date, b.entry_type AS "type", b.category AS "category",
		       b.amount_minor AS "amountMinor", b.description AS "description", b.receipt_url AS "receiptUrl",
		       b.recorded_by AS "recorderId", b.team_id AS "teamId", b.created_at AS "createdAt",
		       b.transfer_pair_id AS "transferId", b.updated_by AS "updaterId", b.updated_at AS "updatedAt",
		       k.first_name || ' ' || k.last_name AS "recorderName",
		       g.first_name || ' ' || g.last_name AS "updaterName",
		       CASE WHEN o.id IS NULL THEN NULL ELSE COALESCE(t.name, 'General Vault') END AS "counterpartVaultName"
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
		`SELECT id, date, entry_type AS "type", category AS "category", amount_minor AS "amountMinor",
		        description AS "description", receipt_url AS "receiptUrl", recorded_by AS "recorderId",
		        team_id AS "teamId", created_at AS "createdAt", transfer_pair_id AS "transferId",
		        updated_by AS "updaterId", updated_at AS "updatedAt"
		 FROM budget_records WHERE id = $1`,
		[id]
	);
	return (res.rows[0] as BudgetRecord | undefined) ?? null;
}

/** Which vaults reference this receipt file (usually one). `null` is the general vault. */
export async function getBudgetTeamIdsByReceipt(url: string): Promise<(string | null)[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query('SELECT team_id AS "teamId" FROM budget_records WHERE receipt_url = $1', [url]);
	return res.rows.map((r) => (r.teamId as string | null) ?? null);
}
