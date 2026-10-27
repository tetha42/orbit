import { randomUUID } from 'crypto';
import { ensurePostgresInit, getPgPool, withTransaction } from '@/db/index';
import type { Decision } from '@/db/schema';

export async function getDecisions(): Promise<Decision[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(`
		SELECT t.*,
		       k.ad || ' ' || k.soyad as "olusturanAdSoyad"
		FROM tutanaklar_kararlar t
		LEFT JOIN kullanicilar k ON t.olusturanId = k.id
		ORDER BY t.kararNo DESC
	`);
	return res.rows.map((r) => ({
		...r,
		kamuyaAcikMi: Number(r.kamuyaAcikMi),
		kilitliMi: Number(r.kilitliMi),
	}));
}

export async function createDecision(params: {
	baslik: string;
	gundem: string;
	icerik: string;
	olusturanId: string;
	belgeTuru?: string;
	date?: number;
	kamuyaAcikMi?: boolean;
}): Promise<Decision> {
	await ensurePostgresInit();
	const now = Date.now();
	const date = params.date || now;
	return withTransaction(async (client) => {
		// Numbers run per year (2026001, 2026002, …). The lock serialises two
		// documents created at the same moment; MAX()+1 alone gave both the same
		// number and the second insert failed on the UNIQUE constraint.
		await client.query("SELECT pg_advisory_xact_lock(hashtext('tutanaklar_kararlar.kararNo'))");
		const year = new Date(date).getFullYear();
		const maxRow = await client.query(
			'SELECT COALESCE(MAX(kararNo), $1) AS "maxNo" FROM tutanaklar_kararlar WHERE kararNo BETWEEN $1 AND $2',
			[year * 1000, year * 1000 + 999]
		);
		const decision: Decision = {
			id: randomUUID(),
			kararNo: Number(maxRow.rows[0].maxNo) + 1,
			belgeTuru: params.belgeTuru || 'karar',
			baslik: params.baslik.trim(),
			date,
			gundem: params.gundem.trim(),
			icerik: params.icerik.trim(),
			kamuyaAcikMi: params.kamuyaAcikMi !== false ? 1 : 0,
			kilitliMi: 0,
			olusturanId: params.olusturanId,
			olusturma: now,
		};
		await client.query(
			`INSERT INTO tutanaklar_kararlar (id, kararNo, belgeTuru, baslik, date, gundem, icerik, kamuyaAcikMi, kilitliMi, olusturanId, olusturma)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10)`,
			[decision.id, decision.kararNo, decision.belgeTuru, decision.baslik, decision.date, decision.gundem, decision.icerik, decision.kamuyaAcikMi, decision.olusturanId, now]
		);
		return decision;
	});
}

export async function getDecisionById(id: string): Promise<Decision | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query('SELECT * FROM tutanaklar_kararlar WHERE id = $1', [id]);
	const r = res.rows[0];
	return r ? { ...r, kamuyaAcikMi: Number(r.kamuyaAcikMi), kilitliMi: Number(r.kilitliMi) } : null;
}

export async function getDecisionByNumber(kararNo: number): Promise<Decision | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query('SELECT * FROM tutanaklar_kararlar WHERE kararNo = $1', [kararNo]);
	const r = res.rows[0];
	return r ? { ...r, kamuyaAcikMi: Number(r.kamuyaAcikMi), kilitliMi: Number(r.kilitliMi) } : null;
}

/**
 * Edits an unlocked document. The lock is checked in the same statement, so a
 * document locked a moment ago cannot be changed by a request already in flight.
 */
export async function updateDecision(
	id: string,
	patch: { baslik?: string; gundem?: string; icerik?: string; belgeTuru?: string; kamuyaAcikMi?: boolean }
): Promise<'ok' | 'kilitli' | 'yok'> {
	await ensurePostgresInit();
	const sets: string[] = [];
	const values: unknown[] = [];
	const set = (column: string, value: unknown) => {
		values.push(value);
		sets.push(`${column} = $${values.length}`);
	};
	if (patch.baslik !== undefined) set('baslik', patch.baslik);
	if (patch.gundem !== undefined) set('gundem', patch.gundem);
	if (patch.icerik !== undefined) set('icerik', patch.icerik);
	if (patch.belgeTuru !== undefined) set('belgeTuru', patch.belgeTuru);
	if (patch.kamuyaAcikMi !== undefined) set('kamuyaAcikMi', patch.kamuyaAcikMi ? 1 : 0);
	if (!sets.length) return 'ok';
	values.push(id);
	const res = await getPgPool().query(
		`UPDATE tutanaklar_kararlar SET ${sets.join(', ')} WHERE id = $${values.length} AND kilitliMi = 0`,
		values
	);
	if (res.rowCount) return 'ok';
	return (await getDecisionById(id)) ? 'kilitli' : 'yok';
}

export async function setDecisionLock(id: string, kilitli: boolean): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query('UPDATE tutanaklar_kararlar SET kilitliMi = $1 WHERE id = $2', [kilitli ? 1 : 0, id]);
	return (res.rowCount ?? 0) > 0;
}

export async function deleteDecision(id: string): Promise<'ok' | 'kilitli' | 'yok'> {
	await ensurePostgresInit();
	const res = await getPgPool().query('DELETE FROM tutanaklar_kararlar WHERE id = $1 AND kilitliMi = 0', [id]);
	if (res.rowCount) return 'ok';
	return (await getDecisionById(id)) ? 'kilitli' : 'yok';
}
