import { randomUUID } from 'crypto';
import { ensurePostgresInit, getPgPool, withTransaction } from '@/db';
import {
	DEFAULT_MEMBERSHIP_POLICY,
	MEMBERSHIP_POLICY_SETTINGS_KEY,
	normalizeMembershipPolicy,
	type MembershipPolicy,
} from '@/lib/membershipPolicy';

/* ==================== membership policy ==================== */

export async function getMembershipPolicy(): Promise<MembershipPolicy> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		'SELECT value FROM system_settings WHERE key = $1',
		[MEMBERSHIP_POLICY_SETTINGS_KEY]
	);
	const raw = res.rows[0]?.value;
	if (typeof raw !== 'string' || !raw.trim()) return DEFAULT_MEMBERSHIP_POLICY;
	try {
		return normalizeMembershipPolicy(JSON.parse(raw));
	} catch {
		return DEFAULT_MEMBERSHIP_POLICY;
	}
}

export async function setMembershipPolicy(input: unknown): Promise<MembershipPolicy> {
	await ensurePostgresInit();
	const policy = normalizeMembershipPolicy(input);
	await getPgPool().query(
		`INSERT INTO system_settings (key, value, updated_at)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
		[MEMBERSHIP_POLICY_SETTINGS_KEY, JSON.stringify(policy), Date.now()]
	);
	return policy;
}

/* ==================== applications ==================== */

export type ApplicationSource = 'self' | 'admin' | 'invite';
export type ApplicationStatus =
	| 'submitted'
	| 'email_verified'
	| 'pending_review'
	| 'approved'
	| 'rejected'
	| 'withdrawn';

export interface MembershipApplication {
	id: string;
	userId: string;
	source: ApplicationSource;
	status: ApplicationStatus;
	snapshot: string;
	invitationId: string | null;
	reapplyOf: string | null;
	submittedAt: number;
	emailVerifiedAt: number | null;
	reviewedBy: string | null;
	reviewedAt: number | null;
	rejectionReason: string | null;
	createdAt: number;
}

function mapApplication(row: Record<string, unknown>): MembershipApplication {
	return {
		id: String(row.id),
		userId: String(row.userId),
		source: String(row.source) as ApplicationSource,
		status: String(row.status) as ApplicationStatus,
		snapshot: String(row.snapshot ?? '{}'),
		invitationId: row.invitationId ? String(row.invitationId) : null,
		reapplyOf: row.reapplyOf ? String(row.reapplyOf) : null,
		submittedAt: Number(row.submittedAt) || 0,
		emailVerifiedAt: row.emailVerifiedAt ? Number(row.emailVerifiedAt) : null,
		reviewedBy: row.reviewedBy ? String(row.reviewedBy) : null,
		reviewedAt: row.reviewedAt ? Number(row.reviewedAt) : null,
		rejectionReason: row.rejectionReason ? String(row.rejectionReason) : null,
		createdAt: Number(row.createdAt) || 0,
	};
}

const APPLICATION_COLUMNS = `id, user_id AS "userId", source, status, snapshot,
	invitation_id AS "invitationId", reapply_of AS "reapplyOf", submitted_at AS "submittedAt",
	email_verified_at AS "emailVerifiedAt", reviewed_by AS "reviewedBy",
	reviewed_at AS "reviewedAt", rejection_reason AS "rejectionReason", created_at AS "createdAt"`;

export async function createMembershipApplication(input: {
	userId: string;
	source: ApplicationSource;
	status?: ApplicationStatus;
	snapshot?: Record<string, unknown>;
	invitationId?: string | null;
	reapplyOf?: string | null;
	emailVerifiedAt?: number | null;
	reviewedBy?: string | null;
	reviewedAt?: number | null;
	rejectionReason?: string | null;
}): Promise<MembershipApplication> {
	await ensurePostgresInit();
	const now = Date.now();
	const status = input.status ?? 'pending_review';
	const id = `app_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
	await withTransaction(async (client) => {
		// One open application per member; a re-application replaces the open draft
		// instead of fighting the partial unique index.
		if (['submitted', 'email_verified', 'pending_review'].includes(status)) {
			await client.query(
				"DELETE FROM membership_applications WHERE user_id = $1 AND status IN ('submitted','email_verified','pending_review')",
				[input.userId]
			);
		}
		await client.query(
			`INSERT INTO membership_applications
				(id, user_id, source, status, snapshot, invitation_id, reapply_of, submitted_at,
				 email_verified_at, reviewed_by, reviewed_at, rejection_reason, created_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
			[
				id,
				input.userId,
				input.source,
				status,
				JSON.stringify(input.snapshot ?? {}),
				input.invitationId ?? null,
				input.reapplyOf ?? null,
				now,
				input.emailVerifiedAt ?? null,
				input.reviewedBy ?? null,
				input.reviewedAt ?? null,
				input.rejectionReason ?? null,
				now,
			]
		);
	});
	const res = await getPgPool().query(
		`SELECT ${APPLICATION_COLUMNS} FROM membership_applications WHERE id = $1`,
		[id]
	);
	return mapApplication(res.rows[0]);
}

export async function getLatestApplication(userId: string): Promise<MembershipApplication | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT ${APPLICATION_COLUMNS} FROM membership_applications
		 WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
		[userId]
	);
	return res.rows[0] ? mapApplication(res.rows[0]) : null;
}

export async function recordApplicationDecision(
	userId: string,
	status: 'approved' | 'rejected',
	reviewedBy: string,
	rejectionReason?: string | null
): Promise<void> {
	await ensurePostgresInit();
	await getPgPool().query(
		`UPDATE membership_applications SET
			status = $2, reviewed_by = $3, reviewed_at = $4, rejection_reason = $5
		 WHERE id = (
			SELECT id FROM membership_applications
			WHERE user_id = $1 AND status IN ('submitted','email_verified','pending_review')
			ORDER BY created_at DESC LIMIT 1
		 )`,
		[userId, status, reviewedBy, Date.now(), status === 'rejected' ? rejectionReason ?? null : null]
	);
}

/* ==================== invitations ==================== */

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
	const id = `inv_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
	const now = Date.now();
	const res = await getPgPool().query(
		`INSERT INTO invitations
			(id, token_hash, email, role_id, team_id, note, created_by, expires_at, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 RETURNING ${INVITATION_COLUMNS}`,
		[
			id,
			input.tokenHash,
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
		 WHERE token_hash = $1 AND used_at IS NULL LIMIT 1`,
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
