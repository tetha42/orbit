import { randomBytes } from 'crypto';
import type { PoolClient } from 'pg';
import { ensurePostgresInit, getPgPool, withTransaction } from '@/db/index';
import type { EnvanterDurum } from '@/types/inventory';
import type { InventoryItem } from '@/db/schema';

export class EnvanterKodVarError extends Error {
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
	await client.query(
		`INSERT INTO envanter_hareketleri (id, envanterId, tur, aktorId, userId, aciklama, date) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		[`eh_${Date.now()}_${randomBytes(4).toString('hex')}`, h.envanterId, h.tur, h.aktorId, h.userId ?? null, h.aciklama ?? null, Date.now()]
	);
}

/** Single inventory row, used to validate a borrow/return before writing. */
export async function getInventoryItemById(id: string): Promise<InventoryItem | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query('SELECT * FROM envanter WHERE id = $1', [id]);
	return (res.rows[0] as InventoryItem) ?? null;
}

export async function getInventoryItems(): Promise<InventoryItem[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(`
		SELECT e.*,
		       k.ad || ' ' || k.soyad as "oduncAlanAdSoyad"
		FROM envanter e
		LEFT JOIN kullanicilar k ON e.oduncAlanId = k.id
		ORDER BY e.kod ASC
	`);
	return res.rows as InventoryItem[];
}

/** An item's history, newest first. */
export async function getInventoryActivities(envanterId: string, limit = 50): Promise<InventoryActivity[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT h.id, h.tur, h.aciklama, h.date,
		        a.ad || ' ' || a.soyad AS "aktorAdSoyad",
		        u.ad || ' ' || u.soyad AS "kullaniciAdSoyad"
		 FROM envanter_hareketleri h
		 LEFT JOIN kullanicilar a ON a.id = h.aktorId
		 LEFT JOIN kullanicilar u ON u.id = h.userId
		 WHERE h.envanterId = $1
		 ORDER BY h.date DESC, h.id DESC
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
			`UPDATE envanter SET status = 'oduncte', oduncAlanId = $2, iadeTarihi = $3, oduncTarihi = $4
			 WHERE id = $1 AND status = 'saglam' RETURNING id`,
			[p.id, p.userId, p.iadeTarihi, Date.now()]
		);
		if (res.rowCount === 0) {
			const exists = await client.query('SELECT 1 FROM envanter WHERE id = $1', [p.id]);
			return exists.rowCount ? 'musait-degil' : 'yok';
		}
		await addHareket(client, { envanterId: p.id, tur: 'odunc', aktorId: p.aktorId, userId: p.userId, aciklama: `İade: ${new Date(p.iadeTarihi).toLocaleDateString('tr-TR')}` });
		return 'ok';
	});
}

/** Takes an item back. */
export async function iadeAl(p: { id: string; aktorId: string; borrowerOnly?: string; ariza?: boolean; not?: string }): Promise<'ok' | 'yok' | 'oduncte-degil' | 'permission'> {
	return withTransaction(async (client) => {
		const found = await client.query('SELECT status, oduncAlanId FROM envanter WHERE id = $1 FOR UPDATE', [p.id]);
		const row = found.rows[0] as { status: string; oduncAlanId: string | null } | undefined;
		if (!row) return 'yok';
		if (row.status !== 'oduncte') return 'oduncte-degil';
		if (p.borrowerOnly && row.oduncAlanId !== p.borrowerOnly) return 'permission';
		await client.query(
			`UPDATE envanter SET status = $2, oduncAlanId = NULL, iadeTarihi = NULL, oduncTarihi = NULL WHERE id = $1`,
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
		const found = await client.query('SELECT status, oduncAlanId FROM envanter WHERE id = $1 FOR UPDATE', [p.id]);
		const row = found.rows[0] as { status: string; oduncAlanId: string | null } | undefined;
		if (!row) return 'yok';
		if (row.status !== 'oduncte') return 'oduncte-degil';
		if (p.borrowerOnly && row.oduncAlanId !== p.borrowerOnly) return 'permission';
		await client.query('UPDATE envanter SET iadeTarihi = $2 WHERE id = $1', [p.id, p.iadeTarihi]);
		await addHareket(client, { envanterId: p.id, tur: 'uzat', aktorId: p.aktorId, userId: row.oduncAlanId, aciklama: `Yeni iade: ${new Date(p.iadeTarihi).toLocaleDateString('tr-TR')}` });
		return 'ok';
	});
}

/** Management's status change: in service, broken or lost. */
export async function setInventoryStatus(p: { id: string; status: Exclude<EnvanterDurum, 'oduncte'>; aktorId: string; not?: string }): Promise<'ok' | 'yok' | 'oduncte'> {
	return withTransaction(async (client) => {
		const found = await client.query('SELECT status, oduncAlanId FROM envanter WHERE id = $1 FOR UPDATE', [p.id]);
		const row = found.rows[0] as { status: string; oduncAlanId: string | null } | undefined;
		if (!row) return 'yok';
		if (row.status === p.status) return 'ok';
		if (row.status === 'oduncte' && p.status !== 'kayip') return 'oduncte';
		await client.query(`UPDATE envanter SET status = $2, oduncAlanId = NULL, iadeTarihi = NULL, oduncTarihi = NULL WHERE id = $1`, [p.id, p.status]);
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
			const found = await client.query('SELECT * FROM envanter WHERE id = $1 FOR UPDATE', [id]);
			const current = found.rows[0] as Record<string, unknown> | undefined;
			if (!current) return 'yok';
			const fields = Object.entries(changes).filter(([k, v]) => v !== undefined && (current[k] ?? null) !== (v ?? null));
			if (fields.length === 0) return 'ok';
			const sets = fields.map(([k], i) => `${k} = $${i + 2}`);
			await client.query(`UPDATE envanter SET ${sets.join(', ')} WHERE id = $1`, [id, ...fields.map(([, v]) => v)]);
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
	status?: EnvanterDurum;
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
				`INSERT INTO envanter (id, kod, ad, kategori, konum, status, aciklama, seriNo)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
				[item.id, item.kod, item.ad, item.kategori, item.konum, item.status, item.aciklama, item.seriNo]
			);
			if (params.aktorId) await addHareket(client, { envanterId: id, tur: 'ekle', aktorId: params.aktorId, aciklama: `Konum: ${item.konum}` });
		});
	} catch (err) {
		if ((err as { code?: string }).code === '23505') throw new EnvanterKodVarError();
		throw err;
	}
	return item;
}

/** Deletes an item that is not out on loan. */
export async function deleteInventoryItem(id: string): Promise<'ok' | 'yok' | 'oduncte'> {
	return withTransaction(async (client) => {
		const found = await client.query('SELECT status FROM envanter WHERE id = $1 FOR UPDATE', [id]);
		if (!found.rows[0]) return 'yok';
		if (found.rows[0].status === 'oduncte') return 'oduncte';
		await client.query('DELETE FROM envanter WHERE id = $1', [id]);
		return 'ok';
	});
}
