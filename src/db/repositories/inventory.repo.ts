import { randomBytes } from 'crypto';
import type { PoolClient } from 'pg';
import { ensurePostgresInit, getPgPool, withTransaction } from '@/db/index';
import type { InventoryStatus } from '@/types/inventory';
import type { InventoryItem } from '@/db/schema';

export class InventoryCodeExistsError extends Error {
	constructor(message = 'Bu envanter kodu zaten kullanımda.') {
		super(message);
		this.name = 'EnvanterKodVarError';
	}
}

export type InventoryActivityType = 'ekle' | 'odunc' | 'iade' | 'uzat' | 'status' | 'duzenle';

export interface InventoryActivity {
	id: string;
	typeValue: InventoryActivityType;
	description: string | null;
	date: number;
	actorNameSurname: string | null;
	userNameSurname: string | null;
}

async function addMovement(
	client: PoolClient,
	h: { inventoryId: string; typeValue: InventoryActivityType; actorId: string; userId?: string | null; description?: string | null }
): Promise<void> {
	const entry = {
		id: `eh_${Date.now()}_${randomBytes(4).toString('hex')}`,
		typeValue: h.typeValue,
		actorId: h.actorId,
		userId: h.userId ?? null,
		description: h.description ?? null,
		date: Date.now(),
	};
	await client.query(
		`UPDATE inventory SET activities = COALESCE(activities, '[]'::jsonb) || $2::jsonb WHERE id = $1`,
		[h.inventoryId, JSON.stringify([entry])]
	);
}

const INVENTORY_SELECT_COLUMNS = `
	id, code AS kod, name AS ad, category AS kategori, status, location AS konum,
	holder_user_id AS "oduncAlanId", due_at AS "iadeTarihi",
	borrowed_at AS "oduncTarihi", description AS aciklama, serial_number AS "seriNo"
`;

/** Single inventory row, used to validate a borrow/return before writing. */
export async function getInventoryItemById(id: string): Promise<InventoryItem | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(`SELECT ${INVENTORY_SELECT_COLUMNS} FROM inventory WHERE id = $1`, [id]);
	return (res.rows[0] as InventoryItem) ?? null;
}

export async function getInventoryItems(): Promise<InventoryItem[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(`
		SELECT e.id, e.code AS code, e.name AS name, e.category AS category, e.status, e.location AS location,
		       e.holder_user_id AS "loanFieldId", e.due_at AS "returnDate",
		       e.borrowed_at AS "loanDate", e.description AS description, e.serial_number AS "seriesNo",
		       k.first_name || ' ' || k.last_name as "loanFieldNameSurname"
		FROM inventory e
		LEFT JOIN users k ON e.holder_user_id = k.id
		ORDER BY e.code ASC
	`);
	return res.rows as InventoryItem[];
}

/** An item's history, newest first. */
export async function getInventoryActivities(inventoryId: string, limit = 50): Promise<InventoryActivity[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT elem->>'id' AS id,
		        elem->>'typeValue' AS typeValue,
		        elem->>'description' AS description,
		        (elem->>'date')::bigint AS date,
		        a.first_name || ' ' || a.last_name AS "actorNameSurname",
		        u.first_name || ' ' || u.last_name AS "userNameSurname"
		 FROM inventory i,
		      jsonb_array_elements(COALESCE(i.activities, '[]'::jsonb)) AS elem
		 LEFT JOIN users a ON a.id = elem->>'actorId'
		 LEFT JOIN users u ON u.id = elem->>'userId'
		 WHERE i.id = $1
		 ORDER BY (elem->>'date')::bigint DESC, elem->>'id' DESC
		 LIMIT $2`,
		[inventoryId, limit]
	);
	return res.rows.map((r) => ({ ...r, date: Number(r.date) }));
}

/**
 * Lends an item that is on the shelf. The status check and the write are one
 * conditional UPDATE, so of two simultaneous requests exactly one wins.
 */
export async function lendInventoryItem(p: { id: string; userId: string; returnDate: number; actorId: string }): Promise<'ok' | 'yok' | 'musait-degil'> {
	return withTransaction(async (client) => {
		const res = await client.query(
			`UPDATE inventory SET status = 'oduncte', holder_user_id = $2, due_at = $3, borrowed_at = $4
			 WHERE id = $1 AND status = 'saglam' RETURNING id`,
			[p.id, p.userId, p.returnDate, Date.now()]
		);
		if (res.rowCount === 0) {
			const exists = await client.query('SELECT 1 FROM inventory WHERE id = $1', [p.id]);
			return exists.rowCount ? 'musait-degil' : 'yok';
		}
		await addMovement(client, { inventoryId: p.id, typeValue: 'odunc', actorId: p.actorId, userId: p.userId, description: `İade: ${new Date(p.returnDate).toLocaleDateString('tr-TR')}` });
		return 'ok';
	});
}

/** Takes an item back. */
export async function markReturned(p: { id: string; actorId: string; borrowerOnly?: string; failure?: boolean; not?: string }): Promise<'ok' | 'yok' | 'oduncte-degil' | 'permission'> {
	return withTransaction(async (client) => {
		const found = await client.query('SELECT status, holder_user_id AS "loanFieldId" FROM inventory WHERE id = $1 FOR UPDATE', [p.id]);
		const row = found.rows[0] as { status: string; loanFieldId: string | null } | undefined;
		if (!row) return 'yok';
		if (row.status !== 'oduncte') return 'oduncte-degil';
		if (p.borrowerOnly && row.loanFieldId !== p.borrowerOnly) return 'permission';
		await client.query(
			`UPDATE inventory SET status = $2, holder_user_id = NULL, due_at = NULL, borrowed_at = NULL WHERE id = $1`,
			[p.id, p.failure ? 'arizali' : 'saglam']
		);
		const not = [p.failure ? 'Arızalı olarak iade edildi' : '', p.not?.trim() ?? ''].filter(Boolean).join(' — ');
		await addMovement(client, { inventoryId: p.id, typeValue: 'iade', actorId: p.actorId, userId: row.loanFieldId, description: not || null });
		return 'ok';
	});
}

/** Moves a loan's return date. */
export async function extendLoan(p: { id: string; returnDate: number; actorId: string; borrowerOnly?: string }): Promise<'ok' | 'yok' | 'oduncte-degil' | 'permission'> {
	return withTransaction(async (client) => {
		const found = await client.query('SELECT status, holder_user_id AS "loanFieldId" FROM inventory WHERE id = $1 FOR UPDATE', [p.id]);
		const row = found.rows[0] as { status: string; loanFieldId: string | null } | undefined;
		if (!row) return 'yok';
		if (row.status !== 'oduncte') return 'oduncte-degil';
		if (p.borrowerOnly && row.loanFieldId !== p.borrowerOnly) return 'permission';
		await client.query('UPDATE inventory SET due_at = $2 WHERE id = $1', [p.id, p.returnDate]);
		await addMovement(client, { inventoryId: p.id, typeValue: 'uzat', actorId: p.actorId, userId: row.loanFieldId, description: `Yeni iade: ${new Date(p.returnDate).toLocaleDateString('tr-TR')}` });
		return 'ok';
	});
}

/** Management's status change: in service, broken or lost. */
export async function setInventoryStatus(p: { id: string; status: Exclude<InventoryStatus, 'oduncte'>; actorId: string; not?: string }): Promise<'ok' | 'yok' | 'oduncte'> {
	return withTransaction(async (client) => {
		const found = await client.query('SELECT status, holder_user_id AS "loanFieldId" FROM inventory WHERE id = $1 FOR UPDATE', [p.id]);
		const row = found.rows[0] as { status: string; loanFieldId: string | null } | undefined;
		if (!row) return 'yok';
		if (row.status === p.status) return 'ok';
		if (row.status === 'oduncte' && p.status !== 'kayip') return 'oduncte';
		await client.query(`UPDATE inventory SET status = $2, holder_user_id = NULL, due_at = NULL, borrowed_at = NULL WHERE id = $1`, [p.id, p.status]);
		const label: Record<string, string> = { saglam: 'Müsait', arizali: 'Arızalı', kayip: 'Kayıp' };
		const parts = [`${label[row.status] ?? 'Ödünçte'} → ${label[p.status]}`, p.not?.trim() ?? ''].filter(Boolean);
		await addMovement(client, { inventoryId: p.id, typeValue: 'status', actorId: p.actorId, userId: row.loanFieldId, description: parts.join(' — ') });
		return 'ok';
	});
}

/** Edits an item's descriptive fields. */
export async function updateInventoryItem(
	id: string,
	changes: { code?: string; name?: string; category?: string; location?: string; description?: string | null; seriesNo?: string | null },
	actorId: string
): Promise<'ok' | 'yok' | 'kod-var'> {
	try {
		return await withTransaction(async (client) => {
			const found = await client.query(`SELECT ${INVENTORY_SELECT_COLUMNS} FROM inventory WHERE id = $1 FOR UPDATE`, [id]);
			const current = found.rows[0] as Record<string, unknown> | undefined;
			if (!current) return 'yok';
			const fields = Object.entries(changes).filter(([k, v]) => v !== undefined && (current[k] ?? null) !== (v ?? null));
			if (fields.length === 0) return 'ok';
			const colMap: Record<string, string> = {
				code: 'code',
				name: 'name',
				category: 'category',
				location: 'location',
				description: 'description',
				seriesNo: 'serial_number',
			};
			const sets = fields.map(([k], i) => `${colMap[k] ?? k} = $${i + 2}`);
			await client.query(`UPDATE inventory SET ${sets.join(', ')} WHERE id = $1`, [id, ...fields.map(([, v]) => v)]);
			const names: Record<string, string> = { code: 'kod', name: 'ad', category: 'kategori', location: 'konum', description: 'açıklama', seriesNo: 'seri no' };
			await addMovement(client, { inventoryId: id, typeValue: 'duzenle', actorId, description: `Değişen: ${fields.map(([k]) => names[k] ?? k).join(', ')}` });
			return 'ok';
		});
	} catch (err) {
		if ((err as { code?: string }).code === '23505') return 'kod-var';
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
	seriesNo?: string | null;
	actorId?: string;
}): Promise<InventoryItem> {
	await ensurePostgresInit();
	const id = `env_${Date.now()}_${randomBytes(3).toString('hex')}`;
	const item: InventoryItem = {
		id,
		code: params.code.trim().toUpperCase(),
		name: params.name.trim(),
		category: params.category.trim(),
		location: params.location.trim(),
		status: params.status || 'saglam',
		description: params.description?.trim() || null,
		seriesNo: params.seriesNo?.trim() || null,
		loanFieldId: null,
		returnDate: null,
		loanDate: null,
	};
	try {
		await withTransaction(async (client) => {
			await client.query(
				`INSERT INTO inventory (id, code, name, category, location, status, description, serial_number, activities)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '[]'::jsonb)`,
				[item.id, item.code, item.name, item.category, item.location, item.status, item.description, item.seriesNo]
			);
			if (params.actorId) await addMovement(client, { inventoryId: id, typeValue: 'ekle', actorId: params.actorId, description: `Konum: ${item.location}` });
		});
	} catch (err) {
		if ((err as { code?: string }).code === '23505') throw new InventoryCodeExistsError();
		throw err;
	}
	return item;
}

/** Deletes an item that is not out on loan. */
export async function deleteInventoryItem(id: string): Promise<'ok' | 'yok' | 'oduncte'> {
	return withTransaction(async (client) => {
		const found = await client.query('SELECT status FROM inventory WHERE id = $1 FOR UPDATE', [id]);
		if (!found.rows[0]) return 'yok';
		if (found.rows[0].status === 'oduncte') return 'oduncte';
		await client.query('DELETE FROM inventory WHERE id = $1', [id]);
		return 'ok';
	});
}
