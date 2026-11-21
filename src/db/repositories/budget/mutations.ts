import { randomBytes } from 'crypto';
import { withTransaction } from '@/db/index';
import type { BudgetRecord } from '@/db/schema';
import { TRANSFER_CATEGORY, type BudgetCategory } from '@/types/budget';
import { cashNetCents, InsufficientFundsError, lockCashRegister, lockCashRegisters } from './helpers';

/**
 * Moves money from one vault to another (typically the general vault funding a
 * project). Writes an expense in the source and an income in the target, linked
 * by one `transferId`, after checking the source can cover it.
 */
export async function addAllowanceTransfer(params: {
	sourceTeamId: string | null;
	targetTeamId: string | null;
	amountMinor: number;
	description: string;
	recorderId: string;
	date?: number;
}): Promise<{ transferId: string }> {
	const now = Date.now();
	const transferId = `xfer_${now}_${randomBytes(4).toString('hex')}`;
	const date = params.date || now;
	await withTransaction(async (client) => {
		await lockCashRegisters(client, [params.sourceTeamId, params.targetTeamId]);
		const net = await cashNetCents(client, params.sourceTeamId);
		if (params.amountMinor > net) throw new InsufficientFundsError(net);
		const insert = (typeValue: 'income' | 'expense', teamId: string | null, suffix: string) =>
			client.query(
				`INSERT INTO budget_records (id, date, entry_type, category, amount_minor, description, receipt_url, recorded_by, team_id, created_at, transfer_pair_id)
				 VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $8, $9, $10)`,
				[
					`bud_${now}_${suffix}_${randomBytes(3).toString('hex')}`,
					date,
					typeValue,
					TRANSFER_CATEGORY,
					params.amountMinor,
					params.description.trim(),
					params.recorderId,
					teamId,
					now,
					transferId,
				]
			);
		await insert('expense', params.sourceTeamId, 'out');
		await insert('income', params.targetTeamId, 'in');
	});
	return { transferId };
}

export async function updateBudgetRecord(
	id: string,
	changes: {
		description?: string;
		category?: BudgetCategory;
		date?: number;
		receiptUrl?: string | null;
		receiptPhotoUrl?: string | null;
	},
	updaterId: string
): Promise<'ok' | 'none' | 'transfer'> {
	const receiptUrl = changes.receiptUrl !== undefined ? changes.receiptUrl : changes.receiptPhotoUrl;
	return withTransaction(async (client) => {
		const found = await client.query('SELECT id, transfer_pair_id AS "transferId" FROM budget_records WHERE id = $1 FOR UPDATE', [id]);
		const row = found.rows[0] as { id: string; transferId: string | null } | undefined;
		if (!row) return 'none';
		if (row.transferId && (changes.category !== undefined || receiptUrl !== undefined)) return 'transfer';

		const sets: string[] = [];
		const values: unknown[] = [];
		const set = (column: string, value: unknown) => {
			values.push(value);
			sets.push(`${column} = $${values.length}`);
		};
		if (changes.description !== undefined) set('description', changes.description.trim());
		if (changes.category !== undefined) set('category', changes.category);
		if (changes.date !== undefined) set('date', changes.date);
		if (receiptUrl !== undefined) set('receipt_url', receiptUrl);
		if (sets.length === 0) return 'ok';
		set('updated_by', updaterId);
		set('updated_at', Date.now());

		values.push(row.transferId ?? row.id);
		const where = row.transferId ? `transfer_pair_id = $${values.length}` : `id = $${values.length}`;
		await client.query(`UPDATE budget_records SET ${sets.join(', ')} WHERE ${where}`, values);
		return 'ok';
	});
}

export async function createBudgetRecord(params: {
	type?: 'income' | 'expense';
	typeValue?: 'income' | 'expense';
	category: BudgetCategory;
	amountMinor: number;
	description: string;
	recorderId: string;
	/** The project whose vault this belongs to; omit for the general vault. */
	teamId?: string | null;
	date?: number;
	receiptUrl?: string;
	receiptPhotoUrl?: string;
}): Promise<BudgetRecord> {
	const teamId = params.teamId ?? null;
	const id = `bud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
	const now = Date.now();
	const entryType = params.type || params.typeValue || 'income';
	const receipt = params.receiptUrl || params.receiptPhotoUrl;
	const registration: BudgetRecord = {
		id,
		date: params.date || now,
		type: entryType,
		category: params.category,
		amountMinor: Math.round(params.amountMinor),
		description: params.description.trim(),
		receiptUrl: receipt,
		recorderId: params.recorderId,
		teamId,
		createdAt: now,
	};

	// The balance check and the insert share one transaction and one vault lock.
	await withTransaction(async (client) => {
		await lockCashRegister(client, teamId);
		if (registration.type === 'expense') {
			const net = await cashNetCents(client, teamId);
			if (registration.amountMinor > net) throw new InsufficientFundsError(net);
		}
		await client.query(
			`INSERT INTO budget_records (id, date, entry_type, category, amount_minor, description, receipt_url, recorded_by, team_id, created_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
			[
				registration.id,
				registration.date,
				registration.type,
				registration.category,
				registration.amountMinor,
				registration.description,
				registration.receiptUrl || null,
				registration.recorderId,
				teamId,
				registration.createdAt,
			]
		);
	});

	return registration;
}

export async function deleteBudgetRecord(id: string): Promise<boolean> {
	return withTransaction(async (client) => {
		const found = await client.query(
			'SELECT entry_type AS type, amount_minor AS "amountMinor", team_id AS "teamId", transfer_pair_id AS "transferId" FROM budget_records WHERE id = $1',
			[id]
		);
		const row = found.rows[0];
		if (!row) return false;

		const rows: { type: string; amountMinor: number; teamId: string | null }[] = row.transferId
			? (
					await client.query(
						'SELECT entry_type AS type, amount_minor AS "amountMinor", team_id AS "teamId" FROM budget_records WHERE transfer_pair_id = $1',
						[row.transferId]
					)
				).rows
			: [row];
		await lockCashRegisters(client, rows.map((r) => r.teamId ?? null));

		// Removing income lowers that vault's balance; refuse if expenses have already spent it.
		for (const r of rows) {
			if (r.type !== 'income') continue;
			const teamId = r.teamId ?? null;
			const net = await cashNetCents(client, teamId);
			if (net - Number(r.amountMinor) < 0) throw new InsufficientFundsError(net);
		}

		const res = row.transferId
			? await client.query('DELETE FROM budget_records WHERE transfer_pair_id = $1', [row.transferId])
			: await client.query('DELETE FROM budget_records WHERE id = $1', [id]);
		return (res.rowCount ?? 0) > 0;
	});
}
