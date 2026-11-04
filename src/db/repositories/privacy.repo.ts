import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { ensurePostgresInit, getPgPool, withTransaction } from '@/db';
import { logAuditEvent, type AuditContext } from '@/db/audit';

export interface CommunityExport {
	generatedAt: number;
	users: Record<string, unknown>[];
	teams: Record<string, unknown>[];
	teamMembers: Record<string, unknown>[];
	projects: Record<string, unknown>[];
	events: Record<string, unknown>[];
	decisions: Record<string, unknown>[];
	committeeMeetings: Record<string, unknown>[];
	membershipApplications: Record<string, unknown>[];
	legalAcceptances: Record<string, unknown>[];
}

const SAFE_USER_COLUMNS = `id, first_name AS "firstName", last_name AS "lastName", email,
	handle, department, grade, status, role_id AS "roleId", email_verified_at AS "emailVerifiedAt",
	xp, created_at AS "createdAt"`;

function parseJsonArray(raw: unknown): Record<string, unknown>[] {
	let arr: unknown = raw;
	if (typeof raw === 'string') {
		try {
			arr = JSON.parse(raw);
		} catch {
			return [];
		}
	}
	if (!Array.isArray(arr)) return [];
	return arr.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'));
}

/**
 * A portability export for administrators. Credentials, session tokens, TOTP
 * secrets, IP addresses and user-agent strings are deliberately excluded.
 */
export async function exportCommunityData(): Promise<CommunityExport> {
	await ensurePostgresInit();
	const db = getPgPool();
	const [users, userHistories, teams, teamMembers, projects, events, decisions, meetings] =
		await Promise.all([
			db.query(`SELECT ${SAFE_USER_COLUMNS} FROM users ORDER BY created_at`),
			db.query(`SELECT id, application_history AS "applicationHistory", legal_consents AS "legalConsents" FROM users ORDER BY created_at`),
			db.query('SELECT * FROM teams ORDER BY created_at'),
			db.query('SELECT * FROM team_members ORDER BY joined_at'),
			db.query('SELECT * FROM projects ORDER BY created_at'),
			db.query('SELECT * FROM events ORDER BY created_at'),
			db.query("SELECT * FROM decisions WHERE record_type <> 'meeting' ORDER BY date"),
			db.query("SELECT * FROM decisions WHERE record_type = 'meeting' ORDER BY date"),
		]);

	const membershipApplications: Record<string, unknown>[] = [];
	const legalAcceptances: Record<string, unknown>[] = [];

	for (const row of userHistories.rows) {
		const uid = String(row.id);
		const apps = parseJsonArray(row.applicationHistory ?? row.application_history);
		for (const app of apps) {
			membershipApplications.push({
				id: app.id ?? null,
				userId: app.userId ?? uid,
				source: app.source ?? 'self',
				status: app.status ?? 'pending_review',
				invitationId: app.invitationId ?? null,
				submittedAt: app.submittedAt ?? 0,
				emailVerifiedAt: app.emailVerifiedAt ?? null,
				reviewedBy: app.reviewedBy ?? null,
				reviewedAt: app.reviewedAt ?? null,
				rejectionReason: app.rejectionReason ?? null,
				reapplyOf: app.reapplyOf ?? null,
				createdAt: app.createdAt ?? 0,
			});
		}
		const consents = parseJsonArray(row.legalConsents ?? row.legal_consents);
		for (const consent of consents) {
			legalAcceptances.push({
				userId: uid,
				documentId: consent.documentId ?? null,
				documentVersion: consent.documentVersion ?? 1,
				contentHash: consent.contentHash ?? '',
				acceptedAt: consent.acceptedAt ?? 0,
				source: consent.source ?? 'registration',
			});
		}
	}

	return {
		generatedAt: Date.now(),
		users: users.rows,
		teams: teams.rows,
		teamMembers: teamMembers.rows,
		projects: projects.rows,
		events: events.rows,
		decisions: decisions.rows,
		committeeMeetings: meetings.rows,
		membershipApplications,
		legalAcceptances,
	};
}

/**
 * Replaces a member's direct identifiers while keeping IDs so historical
 * relations (team membership, decisions, acceptances) stay intact. Legal
 * acceptances lose their network metadata, not the consent evidence itself.
 */
export async function anonymizeMember(
	userId: string,
	denetim: AuditContext
): Promise<'ok' | 'yok' | 'admin'> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const target = await client.query(
			`SELECT id, first_name, last_name, email, handle, role_id, status,
			        application_history AS "applicationHistory", legal_consents AS "legalConsents"
			 FROM users WHERE id = $1 FOR UPDATE`,
			[userId]
		);
		const user = target.rows[0];
		if (!user) return 'yok';
		if (String(user.role_id ?? user.roleId ?? '') === 'rol_admin') return 'admin';

		const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
		const email = `anon_${suffix}@anonymized.invalid`;
		const handle = `anon_${suffix}`;
		const passwordHash = await bcrypt.hash(randomUUID(), 12);
		const now = Date.now();

		const scrubbedConsents = parseJsonArray(user.legalConsents ?? user.legal_consents).map((c) => ({
			...c,
			ip: null,
			userAgent: null,
		}));
		const scrubbedApps = parseJsonArray(user.applicationHistory ?? user.application_history).map((a) => ({
			...a,
			snapshot: '{}',
			status: ['submitted', 'email_verified', 'pending_review'].includes(String(a.status ?? ''))
				? 'withdrawn'
				: a.status,
		}));

		await client.query(
			`UPDATE users SET
				first_name = 'Anonim', last_name = 'Üye', email = $2, handle = $3,
				password_hash = $4, email_verified_at = NULL, avatar_url = NULL, bio = NULL,
				department = '—', grade = 1, role_id = NULL, status = 'reddedildi',
				custom_fields = '{}'::jsonb, workspace_state = '{}'::jsonb, oauth_consents = '{}'::jsonb,
				legal_consents = $5::jsonb, application_history = $6::jsonb,
				session_token = NULL, session_expires_at = NULL, last_login_at = NULL,
				last_login_ip = NULL, last_login_user_agent = NULL, last_active_ip = NULL,
				last_active_at = NULL, totp_secret = NULL, totp_enabled = 0,
				totp_recovery_codes = NULL, totp_confirmed_at = NULL, totp_last_step = NULL,
				auth_method = 'password', mail_notifications_enabled = 0
			 WHERE id = $1`,
			[userId, email, handle, passwordHash, JSON.stringify(scrubbedConsents), JSON.stringify(scrubbedApps)]
		);
		await client.query('DELETE FROM verification_tokens WHERE user_id = $1 OR target = $2', [
			userId,
			String(user.email),
		]);
		await client.query('DELETE FROM webauthn_credentials WHERE user_id = $1', [userId]);
		await client.query('UPDATE teams SET lead_id = NULL WHERE lead_id = $1', [userId]);

		await logAuditEvent(client, denetim, {
			action: 'member.anonymize',
			targetType: 'member',
			targetId: userId,
			targetName: 'Anonim üye',
			before: {
				ad: `${user.first_name ?? user.firstName ?? ''} ${user.last_name ?? user.lastName ?? ''}`.trim(),
				email: String(user.email),
				handle: user.handle ? String(user.handle) : null,
				status: String(user.status),
			},
			after: { ad: 'Anonim Üye', status: 'reddedildi', anonymizedAt: now },
		});
		return 'ok';
	});
}
