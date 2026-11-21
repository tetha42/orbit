import type { PoolClient } from 'pg';

/** Thrown when an expense — or removing an income — would take a vault below zero. */
export class InsufficientFundsError extends Error {
	readonly netBalanceMinor: number;

	constructor(netBalanceMinor: number) {
		super('INSUFFICIENT_FUNDS');
		this.name = 'InsufficientFundsError';
		this.netBalanceMinor = netBalanceMinor;
	}
}

export interface CashTotals {
	/** `null` is the general vault. */
	teamId: string | null;
	totalIncomeMinor: number;
	totalExpenseMinor: number;
	recordCount: number;
}

/** WHERE fragment (with its parameters) that selects one vault; `null` is the general vault. */
export function cashFilter(teamId: string | null): { sql: string; params: string[] } {
	return teamId === null
		? { sql: 'team_id IS NULL', params: [] }
		: { sql: 'team_id = $1', params: [teamId] };
}

/**
 * Serialises writers to one vault until the transaction ends, so two expenses that
 * arrive together cannot both pass the balance check and overspend.
 */
export async function lockCashRegister(client: PoolClient, teamId: string | null): Promise<void> {
	await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`vault:${teamId ?? 'general'}`]);
}

/** Locks several vaults in one fixed order, so two allocations in opposite directions cannot deadlock. */
export async function lockCashRegisters(client: PoolClient, vaults: (string | null)[]): Promise<void> {
	const keys = [...new Set(vaults.map((k) => k ?? ''))].sort();
	for (const key of keys) await lockCashRegister(client, key || null);
}

export async function cashNetCents(client: PoolClient, teamId: string | null): Promise<number> {
	const filter = cashFilter(teamId);
	const res = await client.query(
		`SELECT COALESCE(SUM(CASE WHEN entry_type = 'income' THEN amount_minor ELSE -amount_minor END), 0) AS net
		 FROM budget_records WHERE ${filter.sql}`,
		filter.params
	);
	return Number(res.rows[0].net);
}
