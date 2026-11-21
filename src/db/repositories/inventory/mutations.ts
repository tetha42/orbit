import { randomBytes } from 'crypto';
import { ensurePostgresInit, withTransaction } from '@/db/index';
import type { InventoryStatus } from '@/types/inventory';
import type { InventoryItem } from '@/db/schema';
import { addMovement, INVENTORY_SELECT_COLUMNS, InventoryCodeExistsError } from './shared';

export async function lendInventoryItem(p: {
	id: string;
	userId: string;
	dueDate?: number;
	returnDate?: number;
	actorId: string;
}): Promise<'ok' | 'none' | 'unavailable'> {
	const due = p.dueDate ?? p.returnDate ?? Date.now() + 14 * 86400000;
	return withTransaction(async (client) => {
		const res = await client.query(
			`UPDATE inventory SET status = 'on_loan', holder_user_id = $2, due_at = $3, borrowed_at = $4
			 WHERE id = $1 AND status = 'available' RETURNING id`,
			[p.id, p.userId, due, Date.now()]
		);
		if (res.rowCount === 0) {
			const exists = await client.query('SELECT 1 FROM inventory WHERE id = $1', [p.id]);
			return exists.rowCount ? 'unavailable' : 'none';
		}
		await addMovement(client, {
			inventoryId: p.id,
			typeValue: 'loan',
			actorId: p.actorId,
			userId: p.userId,
			description: `Due: ${new Date(due).toLocaleDateString('en-GB')}`,
		});
		return 'ok';
	});
}

export async function markReturned(p: {
	id: string;
	actorId: string;
	borrowerOnly?: string;
	failure?: boolean;
	note?: string;
	not?: string;
}): Promise<'ok' | 'none' | 'not_on_loan' | 'permission'> {
	return withTransaction(async (client) => {
		const found = await client.query('SELECT status, holder_user_id AS "holderUserId" FROM inventory WHERE id = $1 FOR UPDATE', [p.id]);
		const row = found.rows[0] as { status: string; holderUserId: string | null } | undefined;
		if (!row) return 'none';
		if (row.status !== 'on_loan') return 'not_on_loan';
		if (p.borrowerOnly && row.holderUserId !== p.borrowerOnly) return 'permission';
		await client.query(
			`UPDATE inventory SET status = $2, holder_user_id = NULL, due_at = NULL, borrowed_at = NULL WHERE id = $1`,
			[p.id, p.failure ? 'faulty' : 'available']
		);
		const noteText = p.note ?? p.not;
		const fullNote = [p.failure ? 'Returned damaged' : '', noteText?.trim() ?? ''].filter(Boolean).join(' — ');
		await addMovement(client, { inventoryId: p.id, typeValue: 'return', actorId: p.actorId, userId: row.holderUserId, description: fullNote || null });
		return 'ok';
	});
}

export async function extendLoan(p: {
	id: string;
	dueDate?: number;
	returnDate?: number;
	actorId: string;
	borrowerOnly?: string;
}): Promise<'ok' | 'none' | 'not_on_loan' | 'permission'> {
	const due = p.dueDate ?? p.returnDate ?? Date.now();
	return withTransaction(async (client) => {
		const found = await client.query('SELECT status, holder_user_id AS "holderUserId" FROM inventory WHERE id = $1 FOR UPDATE', [p.id]);
		const row = found.rows[0] as { status: string; holderUserId: string | null } | undefined;
		if (!row) return 'none';
		if (row.status !== 'on_loan') return 'not_on_loan';
		if (p.borrowerOnly && row.holderUserId !== p.borrowerOnly) return 'permission';
		await client.query('UPDATE inventory SET due_at = $2 WHERE id = $1', [p.id, due]);
		await addMovement(client, {
			inventoryId: p.id,
			typeValue: 'extend',
			actorId: p.actorId,
			userId: row.holderUserId,
			description: `New due date: ${new Date(due).toLocaleDateString('en-GB')}`,
		});
		return 'ok';
	});
}

export async function setInventoryStatus(p: {
	id: string;
	status: Exclude<InventoryStatus, 'on_loan'>;
	actorId: string;
	note?: string;
	not?: string;
}): Promise<'ok' | 'none' | 'on_loan'> {
	return withTransaction(async (client) => {
		const found = await client.query('SELECT status, holder_user_id AS "holderUserId" FROM inventory WHERE id = $1 FOR UPDATE', [p.id]);
		const row = found.rows[0] as { status: string; holderUserId: string | null } | undefined;
		if (!row) return 'none';
		if (row.status === p.status) return 'ok';
		if (row.status === 'on_loan' && p.status !== 'lost') return 'on_loan';
		await client.query(`UPDATE inventory SET status = $2, holder_user_id = NULL, due_at = NULL, borrowed_at = NULL WHERE id = $1`, [p.id, p.status]);
		const label: Record<string, string> = { available: 'Available', faulty: 'Faulty', lost: 'Lost' };
		const noteText = p.note ?? p.not;
		const parts = [`${label[row.status] ?? 'On Loan'} → ${label[p.status]}`, noteText?.trim() ?? ''].filter(Boolean);
		await addMovement(client, { inventoryId: p.id, typeValue: 'status', actorId: p.actorId, userId: row.holderUserId, description: parts.join(' — ') });
		return 'ok';
	});
}

export async function updateInventoryItem(
	id: string,
	changes: {
		code?: string;
		name?: string;
		category?: string;
		location?: string;
		description?: string | null;
		serialNo?: string | null;
		seriesNo?: string | null;
	},
	actorId: string
): Promise<'ok' | 'none' | 'code_exists'> {
	const normalized: Record<string, string | null | undefined> = {
		code: changes.code,
		name: changes.name,
		category: changes.category,
		location: changes.location,
		description: changes.description,
		serialNo: changes.serialNo !== undefined ? changes.serialNo : changes.seriesNo,
	};
	try {
		return await withTransaction(async (client) => {
			const found = await client.query(`SELECT ${INVENTORY_SELECT_COLUMNS} FROM inventory WHERE id = $1 FOR UPDATE`, [id]);
			const current = found.rows[0] as Record<string, unknown> | undefined;
			if (!current) return 'none';
			const fields = Object.entries(normalized).filter(([k, v]) => v !== undefined && (current[k] ?? null) !== (v ?? null));
			if (fields.length === 0) return 'ok';
			const colMap: Record<string, string> = {
				code: 'code',
				name: 'name',
				category: 'category',
				location: 'location',
				description: 'description',
				serialNo: 'serial_number',
			};
			const validFields = fields.filter(([k]) => Boolean(colMap[k]));
			if (validFields.length === 0) return 'ok';
			const sets = validFields.map(([k], i) => `${colMap[k]} = $${i + 2}`);
			await client.query(`UPDATE inventory SET ${sets.join(', ')} WHERE id = $1`, [id, ...validFields.map(([, v]) => v)]);
			const names: Record<string, string> = { code: 'code', name: 'name', category: 'category', location: 'location', description: 'description', serialNo: 'serial_number' };
			await addMovement(client, { inventoryId: id, typeValue: 'edit', actorId, description: `Changed: ${validFields.map(([k]) => names[k] ?? k).join(', ')}` });
			return 'ok';
		});
	} catch (err) {
		if ((err as { code?: string }).code === '23505') return 'code_exists';
		throw err;
	}
}

export async function createInventoryItem(params: {
	code: string;
	name: string;
	category: string;
	location: string;
	status?: InventoryStatus;
	description?: string | null;
	serialNo?: string | null;
	seriesNo?: string | null;
	actorId?: string;
}): Promise<InventoryItem> {
	await ensurePostgresInit();
	const id = `inv_${Date.now()}_${randomBytes(3).toString('hex')}`;
	const rawSerial = params.serialNo !== undefined ? params.serialNo : params.seriesNo;
	const item: InventoryItem = {
		id,
		code: params.code.trim().toUpperCase(),
		name: params.name.trim(),
		category: params.category.trim(),
		location: params.location.trim(),
		status: params.status || 'available',
		description: params.description?.trim() || null,
		serialNo: rawSerial?.trim() || null,
		loanDate: undefined,
	};
	try {
		await withTransaction(async (client) => {
			await client.query(
				`INSERT INTO inventory (id, code, name, category, location, status, description, serial_number, activities)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '[]'::jsonb)`,
				[item.id, item.code, item.name, item.category, item.location, item.status, item.description, item.serialNo]
			);
			if (params.actorId) await addMovement(client, { inventoryId: id, typeValue: 'add', actorId: params.actorId, description: `Location: ${item.location}` });
		});
	} catch (err) {
		if ((err as { code?: string }).code === '23505') throw new InventoryCodeExistsError();
		throw err;
	}
	return item;
}

export async function deleteInventoryItem(id: string): Promise<'ok' | 'none' | 'on_loan'> {
	return withTransaction(async (client) => {
		const found = await client.query('SELECT status FROM inventory WHERE id = $1 FOR UPDATE', [id]);
		if (!found.rows[0]) return 'none';
		if (found.rows[0].status === 'on_loan') return 'on_loan';
		await client.query('DELETE FROM inventory WHERE id = $1', [id]);
		return 'ok';
	});
}
