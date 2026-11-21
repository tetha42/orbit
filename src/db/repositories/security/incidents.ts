import { ensurePostgresInit, getPgPool } from '@/db';
import { banIp } from './blocks';
import type { SocIncident, SocIncidentSeverity, SocIncidentStatus } from './types';

export async function getSocIncidents(limit = 50): Promise<SocIncident[]> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const res = await pool.query(
		`SELECT id, title, severity, status, source_ip AS "sourceIp", service, details,
		        analyst_notes AS "analystNotes", assigned_to AS "assignedTo",
		        created_at AS "createdAt", updated_at AS "updatedAt"
		 FROM soc_incidents
		 ORDER BY created_at DESC
		 LIMIT $1`,
		[limit]
	);
	return res.rows.map((row) => ({
		id: String(row.id),
		title: String(row.title),
		severity: row.severity as SocIncidentSeverity,
		status: row.status as SocIncidentStatus,
		sourceIp: row.sourceIp ? String(row.sourceIp) : null,
		service: row.service ? String(row.service) : null,
		details: (row.details as Record<string, unknown>) ?? null,
		analystNotes: row.analystNotes ? String(row.analystNotes) : null,
		assignedTo: row.assignedTo ? String(row.assignedTo) : null,
		createdAt: Number(row.createdAt),
		updatedAt: Number(row.updatedAt),
	}));
}

export async function createSocIncident(data: {
	title: string;
	severity: SocIncidentSeverity;
	sourceIp?: string | null;
	service?: string | null;
	details?: Record<string, unknown> | null;
	analystNotes?: string | null;
	assignedTo?: string | null;
	status?: SocIncidentStatus;
}): Promise<SocIncident> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const now = Date.now();
	const id = `inc_${now}_${Math.random().toString(36).substring(2, 8)}`;
	const status = data.status || 'new';

	await pool.query(
		`INSERT INTO soc_incidents (id, title, severity, status, source_ip, service, details, analyst_notes, assigned_to, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		[
			id,
			data.title,
			data.severity,
			status,
			data.sourceIp || null,
			data.service || 'security',
			data.details ? JSON.stringify(data.details) : null,
			data.analystNotes || null,
			data.assignedTo || null,
			now,
			now,
		]
	);

	return {
		id,
		title: data.title,
		severity: data.severity,
		status,
		sourceIp: data.sourceIp || null,
		service: data.service || 'security',
		details: data.details || null,
		analystNotes: data.analystNotes || null,
		assignedTo: data.assignedTo || null,
		createdAt: now,
		updatedAt: now,
	};
}

export async function updateSocIncident(
	id: string,
	updates: {
		status?: SocIncidentStatus;
		analystNotes?: string;
		assignedTo?: string;
	}
): Promise<boolean> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const sets: string[] = ['updated_at = $1'];
	const values: unknown[] = [Date.now()];
	let idx = 2;

	if (updates.status !== undefined) {
		sets.push(`status = $${idx++}`);
		values.push(updates.status);
	}
	if (updates.analystNotes !== undefined) {
		sets.push(`analyst_notes = $${idx++}`);
		values.push(updates.analystNotes);
	}
	if (updates.assignedTo !== undefined) {
		sets.push(`assigned_to = $${idx++}`);
		values.push(updates.assignedTo);
	}

	values.push(id);
	const res = await pool.query(
		`UPDATE soc_incidents SET ${sets.join(', ')} WHERE id = $${idx}`,
		values
	);

	if (updates.status === 'contained') {
		try {
			const incRes = await pool.query<{ source_ip: string | null }>(
				'SELECT source_ip FROM soc_incidents WHERE id = $1',
				[id]
			);
			const sourceIp = incRes.rows[0]?.source_ip;
			if (sourceIp) {
				await banIp({
					ip: sourceIp,
					reason: `Stateful Incident Containment [Incident #${id}]`,
					durationMs: 24 * 60 * 60 * 1000,
					threatScore: 100,
					creatorId: updates.assignedTo || null,
				});
			}
		} catch (containErr) {
			console.error('[SoC] State-backed containment trigger error:', containErr);
		}
	}

	return (res.rowCount ?? 0) > 0;
}
