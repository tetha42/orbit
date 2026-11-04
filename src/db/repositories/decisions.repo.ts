import { randomUUID } from 'crypto';
import { ensurePostgresInit, getPgPool, withTransaction } from '@/db/index';
import type { Decision } from '@/db/schema';

const DECISION_SELECT_COLUMNS = `
	id, reference_no AS "kararNo", record_type AS "belgeTuru", title AS "baslik", date,
	agenda AS "gundem", content AS "icerik", is_public AS "kamuyaAcikMi", is_locked AS "kilitliMi",
	created_by AS "olusturanId", created_at AS "olusturma",
	body_id, body_id AS "bodyId",
	decision_type, decision_type AS "decisionType",
	quorum_met, quorum_met AS "quorumMet",
	votes_for, votes_for AS "votesFor",
	votes_against, votes_against AS "votesAgainst",
	votes_abstain, votes_abstain AS "votesAbstain",
	published_at, published_at AS "publishedAt"
`;

export async function getDecisions(): Promise<Decision[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(`
		SELECT t.id, t.reference_no AS "kararNo", t.record_type AS "belgeTuru", t.title AS "baslik", t.date,
		       t.agenda AS "gundem", t.content AS "icerik", t.is_public AS "kamuyaAcikMi", t.is_locked AS "kilitliMi",
		       t.created_by AS "olusturanId", t.created_at AS "olusturma",
		       t.body_id, t.body_id AS "bodyId",
		       t.decision_type, t.decision_type AS "decisionType",
		       t.quorum_met, t.quorum_met AS "quorumMet",
		       t.votes_for, t.votes_for AS "votesFor",
		       t.votes_against, t.votes_against AS "votesAgainst",
		       t.votes_abstain, t.votes_abstain AS "votesAbstain",
		       t.published_at, t.published_at AS "publishedAt",
		       k.first_name || ' ' || k.last_name as "olusturanAdSoyad",
		       b.name AS "bodyAd"
		FROM decisions t
		LEFT JOIN users k ON t.created_by = k.id
		LEFT JOIN teams b ON b.id = t.body_id
		WHERE t.record_type <> 'meeting'
		ORDER BY t.reference_no DESC NULLS LAST, t.date DESC
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
	bodyId?: string | null;
	decisionType?: string;
	quorumMet?: boolean;
	votesFor?: number;
	votesAgainst?: number;
	votesAbstain?: number;
	publishedAt?: number | null;
}): Promise<Decision> {
	await ensurePostgresInit();
	const now = Date.now();
	const date = params.date || now;
	return withTransaction(async (client) => {
		// Numbers run per year (2026001, 2026002, …). The lock serialises two
		// documents created at the same moment; MAX()+1 alone gave both the same
		// number and the second insert failed on the UNIQUE constraint.
		await client.query("SELECT pg_advisory_xact_lock(hashtext('decisions.reference_no'))");
		const year = new Date(date).getFullYear();
		const maxRow = await client.query(
			'SELECT COALESCE(MAX(reference_no), $1) AS "maxNo" FROM decisions WHERE reference_no BETWEEN $1 AND $2',
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
			bodyId: params.bodyId ?? null,
			decisionType: params.decisionType || 'resolution',
			quorumMet: params.quorumMet ? 1 : 0,
			votesFor: Number(params.votesFor) || 0,
			votesAgainst: Number(params.votesAgainst) || 0,
			votesAbstain: Number(params.votesAbstain) || 0,
			publishedAt: params.publishedAt ?? null,
		};
		await client.query(
			`INSERT INTO decisions
				(id, reference_no, record_type, title, date, agenda, content, is_public, is_locked, created_by, created_at, updated_at,
				 body_id, decision_type, quorum_met, votes_for, votes_against, votes_abstain, published_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, $10, $11, $12, $13, $14, $15, $16, $17)`,
			[
				decision.id,
				decision.kararNo,
				decision.belgeTuru,
				decision.baslik,
				decision.date,
				decision.gundem,
				decision.icerik,
				decision.kamuyaAcikMi,
				decision.olusturanId,
				now,
				decision.bodyId,
				decision.decisionType,
				decision.quorumMet,
				decision.votesFor,
				decision.votesAgainst,
				decision.votesAbstain,
				decision.publishedAt,
			]
		);
		return decision;
	});
}

export async function getDecisionById(id: string): Promise<Decision | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(`SELECT ${DECISION_SELECT_COLUMNS} FROM decisions WHERE id = $1`, [id]);
	const r = res.rows[0];
	return r ? { ...r, kamuyaAcikMi: Number(r.kamuyaAcikMi), kilitliMi: Number(r.kilitliMi) } : null;
}

export async function getDecisionByNumber(kararNo: number): Promise<Decision | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(`SELECT ${DECISION_SELECT_COLUMNS} FROM decisions WHERE reference_no = $1`, [kararNo]);
	const r = res.rows[0];
	return r ? { ...r, kamuyaAcikMi: Number(r.kamuyaAcikMi), kilitliMi: Number(r.kilitliMi) } : null;
}

/**
 * Edits an unlocked document. The lock is checked in the same statement, so a
 * document locked a moment ago cannot be changed by a request already in flight.
 */
export async function updateDecision(
	id: string,
	patch: {
		baslik?: string;
		gundem?: string;
		icerik?: string;
		belgeTuru?: string;
		kamuyaAcikMi?: boolean;
		bodyId?: string | null;
		decisionType?: string;
		quorumMet?: boolean;
		votesFor?: number;
		votesAgainst?: number;
		votesAbstain?: number;
		publishedAt?: number | null;
	}
): Promise<'ok' | 'kilitli' | 'yok'> {
	await ensurePostgresInit();
	const sets: string[] = [];
	const values: unknown[] = [];
	const set = (column: string, value: unknown) => {
		values.push(value);
		sets.push(`${column} = $${values.length}`);
	};
	if (patch.baslik !== undefined) set('title', patch.baslik);
	if (patch.gundem !== undefined) set('agenda', patch.gundem);
	if (patch.icerik !== undefined) set('content', patch.icerik);
	if (patch.belgeTuru !== undefined) set('record_type', patch.belgeTuru);
	if (patch.kamuyaAcikMi !== undefined) set('is_public', patch.kamuyaAcikMi ? 1 : 0);
	if (patch.bodyId !== undefined) set('body_id', patch.bodyId);
	if (patch.decisionType !== undefined) set('decision_type', patch.decisionType);
	if (patch.quorumMet !== undefined) set('quorum_met', patch.quorumMet ? 1 : 0);
	if (patch.votesFor !== undefined) set('votes_for', Math.max(0, Math.trunc(patch.votesFor)));
	if (patch.votesAgainst !== undefined) set('votes_against', Math.max(0, Math.trunc(patch.votesAgainst)));
	if (patch.votesAbstain !== undefined) set('votes_abstain', Math.max(0, Math.trunc(patch.votesAbstain)));
	if (patch.publishedAt !== undefined) set('published_at', patch.publishedAt);
	if (!sets.length) return 'ok';
	set('updated_at', Date.now());
	values.push(id);
	const res = await getPgPool().query(
		`UPDATE decisions SET ${sets.join(', ')} WHERE id = $${values.length} AND is_locked = 0`,
		values
	);
	if (res.rowCount) return 'ok';
	return (await getDecisionById(id)) ? 'kilitli' : 'yok';
}

export async function setDecisionLock(id: string, kilitli: boolean): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query('UPDATE decisions SET is_locked = $1, updated_at = $2 WHERE id = $3', [kilitli ? 1 : 0, Date.now(), id]);
	return (res.rowCount ?? 0) > 0;
}

export async function deleteDecision(id: string): Promise<'ok' | 'kilitli' | 'yok'> {
	await ensurePostgresInit();
	const res = await getPgPool().query('DELETE FROM decisions WHERE id = $1 AND is_locked = 0', [id]);
	if (res.rowCount) return 'ok';
	return (await getDecisionById(id)) ? 'kilitli' : 'yok';
}
