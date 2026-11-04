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
	tur: InventoryActivityType;
	aciklama: string | null;
	date: number;
	aktorAdSoyad: string | null;
	kullaniciAdSoyad: string | null;
}

async function addHareket(
	client: PoolClient,
	h: { envanterId: string; tur: InventoryActivityType; aktorId: string; userId?: string | null; aciklama?: string | null }
): Promise<void> {
	const entry = {
		id: `eh_${Date.now()}_${randomBytes(4).toString('hex')}`,
		tur: h.tur,
		aktorId: h.aktorId,
		userId: h.userId ?? null,
		aciklama: h.aciklama ?? null,
		date: Date.now(),
	};
	await client.query(
		`UPDATE inventory SET activities = COALESCE(activities, '[]'::jsonb) || $2::jsonb WHERE id = $1`,
		[h.envanterId, JSON.stringify([entry])]
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
		SELECT e.id, e.code AS kod, e.name AS ad, e.category AS kategori, e.status, e.location AS konum,
		       e.holder_user_id AS "oduncAlanId", e.due_at AS "iadeTarihi",
		       e.borrowed_at AS "oduncTarihi", e.description AS aciklama, e.serial_number AS "seriNo",
		       k.first_name || ' ' || k.last_name as "oduncAlanAdSoyad"
		FROM inventory e
		LEFT JOIN users k ON e.holder_user_id = k.id
		ORDER BY e.code ASC
	`);
	return res.rows as InventoryItem[];
}

/** An item's history, newest first. */
export async function getInventoryActivities(envanterId: string, limit = 50): Promise<InventoryActivity[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT elem->>'id' AS id,
		        elem->>'tur' AS tur,
		        elem->>'aciklama' AS aciklama,
		        (elem->>'date')::bigint AS date,
		        a.first_name || ' ' || a.last_name AS "aktorAdSoyad",
		        u.first_name || ' ' || u.last_name AS "kullaniciAdSoyad"
		 FROM inventory i,
		      jsonb_array_elements(COALESCE(i.activities, '[]'::jsonb)) AS elem
		 LEFT JOIN users a ON a.id = elem->>'aktorId'
		 LEFT JOIN users u ON u.id = elem->>'userId'
		 WHERE i.id = $1
		 ORDER BY (elem->>'date')::bigint DESC, elem->>'id' DESC
		 LIMIT $2`,
		[envanterId, limit]
	);
	return res.rows.map((r) => ({ ...r, date: Number(r.date) }));
}

/**
 * Lends an item that is on the shelf. The status check and the write are one
 * conditional UPDATE, so of two simultaneous requests exactly one wins.
 */
export async function lendInventoryItem(p: { id: string; userId: string; iadeTarihi: number; aktorId: string }): Promise<'ok' | 'yok' | 'musait-degil'> {
	return withTransaction(async (client) => {
		const res = await client.query(
			`UPDATE inventory SET status = 'oduncte', holder_user_id = $2, due_at = $3, borrowed_at = $4
			 WHERE id = $1 AND status = 'saglam' RETURNING id`,
			[p.id, p.userId, p.iadeTarihi, Date.now()]
		);
		if (res.rowCount === 0) {
			const exists = await client.query('SELECT 1 FROM inventory WHERE id = $1', [p.id]);
			return exists.rowCount ? 'musait-degil' : 'yok';
		}
		await addHareket(client, { envanterId: p.id, tur: 'odunc', aktorId: p.aktorId, userId: p.userId, aciklama: `İade: ${new Date(p.iadeTarihi).toLocaleDateString('tr-TR')}` });
		return 'ok';
	});
}

/** Takes an item back. */
export async function markReturned(p: { id: string; aktorId: string; borrowerOnly?: string; ariza?: boolean; not?: string }): Promise<'ok' | 'yok' | 'oduncte-degil' | 'permission'> {
	return withTransaction(async (client) => {
		const found = await client.query('SELECT status, holder_user_id AS "oduncAlanId" FROM inventory WHERE id = $1 FOR UPDATE', [p.id]);
		const row = found.rows[0] as { status: string; oduncAlanId: string | null } | undefined;
		if (!row) return 'yok';
		if (row.status !== 'oduncte') return 'oduncte-degil';
		if (p.borrowerOnly && row.oduncAlanId !== p.borrowerOnly) return 'permission';
		await client.query(
			`UPDATE inventory SET status = $2, holder_user_id = NULL, due_at = NULL, borrowed_at = NULL WHERE id = $1`,
			[p.id, p.ariza ? 'arizali' : 'saglam']
		);
		const not = [p.ariza ? 'Arızalı olarak iade edildi' : '', p.not?.trim() ?? ''].filter(Boolean).join(' — ');
		await addHareket(client, { envanterId: p.id, tur: 'iade', aktorId: p.aktorId, userId: row.oduncAlanId, aciklama: not || null });
		return 'ok';
	});
}

/** Moves a loan's return date. */
export async function extendLoan(p: { id: string; iadeTarihi: number; aktorId: string; borrowerOnly?: string }): Promise<'ok' | 'yok' | 'oduncte-degil' | 'permission'> {
	return withTransaction(async (client) => {
		const found = await client.query('SELECT status, holder_user_id AS "oduncAlanId" FROM inventory WHERE id = $1 FOR UPDATE', [p.id]);
		const row = found.rows[0] as { status: string; oduncAlanId: string | null } | undefined;
		if (!row) return 'yok';
		if (row.status !== 'oduncte') return 'oduncte-degil';
		if (p.borrowerOnly && row.oduncAlanId !== p.borrowerOnly) return 'permission';
		await client.query('UPDATE inventory SET due_at = $2 WHERE id = $1', [p.id, p.iadeTarihi]);
		await addHareket(client, { envanterId: p.id, tur: 'uzat', aktorId: p.aktorId, userId: row.oduncAlanId, aciklama: `Yeni iade: ${new Date(p.iadeTarihi).toLocaleDateString('tr-TR')}` });
		return 'ok';
	});
}

/** Management's status change: in service, broken or lost. */
export async function setInventoryStatus(p: { id: string; status: Exclude<InventoryStatus, 'oduncte'>; aktorId: string; not?: string }): Promise<'ok' | 'yok' | 'oduncte'> {
	return withTransaction(async (client) => {
		const found = await client.query('SELECT status, holder_user_id AS "oduncAlanId" FROM inventory WHERE id = $1 FOR UPDATE', [p.id]);
		const row = found.rows[0] as { status: string; oduncAlanId: string | null } | undefined;
		if (!row) return 'yok';
		if (row.status === p.status) return 'ok';
		if (row.status === 'oduncte' && p.status !== 'kayip') return 'oduncte';
		await client.query(`UPDATE inventory SET status = $2, holder_user_id = NULL, due_at = NULL, borrowed_at = NULL WHERE id = $1`, [p.id, p.status]);
		const label: Record<string, string> = { saglam: 'Müsait', arizali: 'Arızalı', kayip: 'Kayıp' };
		const parts = [`${label[row.status] ?? 'Ödünçte'} → ${label[p.status]}`, p.not?.trim() ?? ''].filter(Boolean);
		await addHareket(client, { envanterId: p.id, tur: 'status', aktorId: p.aktorId, userId: row.oduncAlanId, aciklama: parts.join(' — ') });
		return 'ok';
	});
}

/** Edits an item's descriptive fields. */
export async function updateInventoryItem(
	id: string,
	changes: { kod?: string; ad?: string; kategori?: string; konum?: string; aciklama?: string | null; seriNo?: string | null },
	aktorId: string
): Promise<'ok' | 'yok' | 'kod-var'> {
	try {
		return await withTransaction(async (client) => {
			const found = await client.query(`SELECT ${INVENTORY_SELECT_COLUMNS} FROM inventory WHERE id = $1 FOR UPDATE`, [id]);
			const current = found.rows[0] as Record<string, unknown> | undefined;
			if (!current) return 'yok';
			const fields = Object.entries(changes).filter(([k, v]) => v !== undefined && (current[k] ?? null) !== (v ?? null));
			if (fields.length === 0) return 'ok';
			const colMap: Record<string, string> = {
				kod: 'code',
				ad: 'name',
				kategori: 'category',
				konum: 'location',
				aciklama: 'description',
				seriNo: 'serial_number',
			};
			const sets = fields.map(([k], i) => `${colMap[k] ?? k} = $${i + 2}`);
			await client.query(`UPDATE inventory SET ${sets.join(', ')} WHERE id = $1`, [id, ...fields.map(([, v]) => v)]);
			const names: Record<string, string> = { kod: 'kod', ad: 'ad', kategori: 'kategori', konum: 'konum', aciklama: 'açıklama', seriNo: 'seri no' };
			await addHareket(client, { envanterId: id, tur: 'duzenle', aktorId, aciklama: `Değişen: ${fields.map(([k]) => names[k] ?? k).join(', ')}` });
			return 'ok';
		});
	} catch (err) {
		if ((err as { code?: string }).code === '23505') return 'kod-var';
		throw err;
	}
}

export async function createInventoryItem(params: {
	kod: string;
	ad: string;
	kategori: string;
	konum: string;
	status?: InventoryStatus;
	aciklama?: string | null;
	seriNo?: string | null;
	aktorId?: string;
}): Promise<InventoryItem> {
	await ensurePostgresInit();
	const id = `env_${Date.now()}_${randomBytes(3).toString('hex')}`;
	const item: InventoryItem = {
		id,
		kod: params.kod.trim().toUpperCase(),
		ad: params.ad.trim(),
		kategori: params.kategori.trim(),
		konum: params.konum.trim(),
		status: params.status || 'saglam',
		aciklama: params.aciklama?.trim() || null,
		seriNo: params.seriNo?.trim() || null,
		oduncAlanId: null,
		iadeTarihi: null,
		oduncTarihi: null,
	};
	try {
		await withTransaction(async (client) => {
			await client.query(
				`INSERT INTO inventory (id, code, name, category, location, status, description, serial_number, activities)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '[]'::jsonb)`,
				[item.id, item.kod, item.ad, item.kategori, item.konum, item.status, item.aciklama, item.seriNo]
			);
			if (params.aktorId) await addHareket(client, { envanterId: id, tur: 'ekle', aktorId: params.aktorId, aciklama: `Konum: ${item.konum}` });
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
