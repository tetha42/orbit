import { randomUUID } from 'crypto';
import { ensurePostgresInit, getPgPool } from '@/db';

export interface Invitation {
	id: string;
	email: string | null;
	roleId: string | null;
	teamId: string | null;
	note: string | null;
	createdBy: string | null;
	expiresAt: number;
	usedAt: number | null;
	usedBy: string | null;
	createdAt: number;
}

const INVITATION_COLUMNS = `id, email, role_id AS "roleId", team_id AS "teamId", note,
	created_by AS "createdBy", expires_at AS "expiresAt", used_at AS "usedAt",
	used_by AS "usedBy", created_at AS "createdAt"`;

function mapInvitation(row: Record<string, unknown>): Invitation {
	return {
		id: String(row.id),
		email: row.email ? String(row.email) : null,
		roleId: row.roleId ? String(row.roleId) : null,
		teamId: row.teamId ? String(row.teamId) : null,
		note: row.note ? String(row.note) : null,
		createdBy: row.createdBy ? String(row.createdBy) : null,
		expiresAt: Number(row.expiresAt) || 0,
		usedAt: row.usedAt ? Number(row.usedAt) : null,
		usedBy: row.usedBy ? String(row.usedBy) : null,
		createdAt: Number(row.createdAt) || 0,
	};
}

export async function createInvitation(input: {
	tokenHash: string;
	email?: string | null;
	roleId?: string | null;
	teamId?: string | null;
	note?: string | null;
	createdBy: string;
	expiresAt: number;
}): Promise<Invitation> {
	await ensurePostgresInit();
	const id = input.tokenHash || `inv_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
	const now = Date.now();
	const res = await getPgPool().query(
		`INSERT INTO invitations
			(id, email, role_id, team_id, note, created_by, expires_at, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 RETURNING ${INVITATION_COLUMNS}`,
		[
			id,
			input.email?.trim().toLowerCase() || null,
			input.roleId || null,
			input.teamId || null,
			input.note?.trim() || null,
			input.createdBy,
			input.expiresAt,
			now,
		]
	);
	return mapInvitation(res.rows[0]);
}

export async function listInvitations(): Promise<Invitation[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT ${INVITATION_COLUMNS} FROM invitations
		 WHERE used_at IS NULL ORDER BY created_at DESC`
	);
	return res.rows.map(mapInvitation);
}

export async function findInvitationByTokenHash(tokenHash: string): Promise<Invitation | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT ${INVITATION_COLUMNS} FROM invitations
		 WHERE id = $1 AND used_at IS NULL LIMIT 1`,
		[tokenHash]
	);
	return res.rows[0] ? mapInvitation(res.rows[0]) : null;
}

export async function consumeInvitation(id: string, userId: string): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		'UPDATE invitations SET used_at = $2, used_by = $3 WHERE id = $1 AND used_at IS NULL',
		[id, Date.now(), userId]
	);
	return (res.rowCount ?? 0) > 0;
}

export async function deleteInvitation(id: string): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query('DELETE FROM invitations WHERE id = $1', [id]);
	return (res.rowCount ?? 0) > 0;
}
