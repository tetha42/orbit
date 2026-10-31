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

/**
 * A portability export for administrators. Credentials, session tokens, TOTP
 * secrets, IP addresses and user-agent strings are deliberately excluded.
 */
export async function exportCommunityData(): Promise<CommunityExport> {
	await ensurePostgresInit();
	const db = getPgPool();
	const [users, teams, teamMembers, projects, events, decisions, meetings, applications, acceptances] =
		await Promise.all([
			db.query(`SELECT ${SAFE_USER_COLUMNS} FROM users ORDER BY created_at`),
			db.query('SELECT * FROM teams ORDER BY olusturma'),
			db.query('SELECT * FROM team_members ORDER BY katilimTarihi'),
			db.query('SELECT * FROM projects ORDER BY olusturma'),
			db.query('SELECT * FROM events ORDER BY olusturma'),
			db.query('SELECT * FROM decisions ORDER BY date'),
			db.query('SELECT * FROM committee_meetings ORDER BY date'),
			db.query(
				`SELECT id, user_id AS "userId", source, status, invitation_id AS "invitationId",
				        submitted_at AS "submittedAt", email_verified_at AS "emailVerifiedAt",
				        reviewed_by AS "reviewedBy", reviewed_at AS "reviewedAt",
				        rejection_reason AS "rejectionReason", reapply_of AS "reapplyOf", created_at AS "createdAt"
				 FROM membership_applications ORDER BY created_at`
			),
			db.query(
				`SELECT user_id AS "userId", document_id AS "documentId",
				        document_version AS "documentVersion", content_hash AS "contentHash",
				        accepted_at AS "acceptedAt", source
				 FROM legal_acceptances ORDER BY accepted_at`
			),
		]);
	return {
		generatedAt: Date.now(),
		users: users.rows,
		teams: teams.rows,
		teamMembers: teamMembers.rows,
		projects: projects.rows,
		events: events.rows,
		decisions: decisions.rows,
		committeeMeetings: meetings.rows,
		membershipApplications: applications.rows,
		legalAcceptances: acceptances.rows,
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
			`SELECT id, first_name, last_name, email, handle, role_id, status
			 FROM users WHERE id = $1 FOR UPDATE`,
			[userId]
		);
		const user = target.rows[0];
		if (!user) return 'yok';
		if (String(user.role_id ?? '') === 'rol_admin') return 'admin';

		const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
		const email = `anon_${suffix}@anonymized.invalid`;
		const handle = `anon_${suffix}`;
		const passwordHash = await bcrypt.hash(randomUUID(), 12);
		const now = Date.now();

		await client.query(
			`UPDATE users SET
				first_name = 'Anonim', last_name = 'Üye', email = $2, handle = $3,
				password_hash = $4, email_verified_at = NULL, avatar_url = NULL, bio = NULL,
				department = '—', grade = 1, role_id = NULL, status = 'reddedildi',
				session_token = NULL, session_expires_at = NULL, last_login_at = NULL,
				last_login_ip = NULL, last_login_user_agent = NULL, last_active_ip = NULL,
				last_active_at = NULL, totp_secret = NULL, totp_enabled = 0,
				totp_recovery_codes = NULL, totp_confirmed_at = NULL, totp_last_step = NULL,
				auth_method = 'password', mail_notifications_enabled = 0
			 WHERE id = $1`,
			[userId, email, handle, passwordHash]
		);
		await client.query('DELETE FROM email_change_requests WHERE user_id = $1', [userId]);
		await client.query('DELETE FROM email_verifications WHERE email = $1', [user.email]);
		await client.query('DELETE FROM webauthn_credentials WHERE userId = $1', [userId]);
		await client.query('DELETE FROM webauthn_challenges WHERE userId = $1', [userId]);
		await client.query('UPDATE legal_acceptances SET ip = NULL, user_agent = NULL WHERE user_id = $1', [userId]);
		await client.query("UPDATE membership_applications SET snapshot = '{}' WHERE user_id = $1", [userId]);
		await client.query("UPDATE teams SET liderId = NULL WHERE liderId = $1", [userId]);
		await client.query(
			"UPDATE membership_applications SET status = 'withdrawn' WHERE user_id = $1 AND status IN ('submitted','email_verified','pending_review')",
			[userId]
		);

		await logAuditEvent(client, denetim, {
			islem: 'uye.anonimlestir',
			hedefTur: 'uye',
			hedefId: userId,
			hedefAd: 'Anonim üye',
			onceki: {
				ad: `${user.first_name} ${user.last_name}`.trim(),
				email: String(user.email),
				handle: user.handle ? String(user.handle) : null,
				status: String(user.status),
			},
			sonraki: { ad: 'Anonim Üye', status: 'reddedildi', anonymizedAt: now },
		});
		return 'ok';
	});
}
