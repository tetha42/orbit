import { withTransaction, updateUserStatus } from '../index';
import { logAuditEvent, type AuditContext } from '../audit';
import { publishEvent } from '../events';
import { fieldDiff, statusAction, memberTargetName } from '@/lib/audit';
import { ADMIN_ROLE_ID, ALUMNI_ROLE_ID, MEMBER_ROLE_ID, isAlumniRole } from '@/core/permissions';
import { DEFAULT_ROLE_KEY } from './types';
import { dropRoleCache, roleName } from './queries';

/**
 * Gives a member a role (or none). Locks the admins while checking, so two
 * admins demoting each other at the same moment cannot leave the club without one.
 */
export async function setUserRole(
	userId: string,
	roleId: string | null,
	ctx: AuditContext
): Promise<'ok' | 'none' | 'no_role' | 'last_admin'> {
	return withTransaction(async (client) => {
		await client.query("SELECT pg_advisory_xact_lock(hashtext('roles.admin'))");
		const u = await client.query(
			'SELECT first_name AS name, last_name AS surname, email, role_id AS "roleId", status FROM users WHERE id = $1 FOR UPDATE',
			[userId]
		);
		if (!u.rows[0]) return 'none';
		let targetRole: { id: string; name: string } | null = null;
		if (roleId) {
			const r = await client.query('SELECT id, name FROM roles WHERE id = $1', [roleId]);
			if (!r.rowCount) return 'no_role';
			targetRole = { id: String(r.rows[0].id), name: String(r.rows[0].name) };
		}
		if (u.rows[0].roleId === ADMIN_ROLE_ID && roleId !== ADMIN_ROLE_ID) {
			const admins = await client.query(
				`SELECT COUNT(*)::int AS n FROM users WHERE role_id = $1 AND status = 'active'`,
				[ADMIN_ROLE_ID]
			);
			if (Number(admins.rows[0].n) <= 1) return 'last_admin';
		}

		const previous: string | null = u.rows[0].roleId ?? null;
		const previousStatus = (u.rows[0].status as 'active' | 'pending' | 'rejected' | 'alumni') || 'active';
		const targetAlumni = isAlumniRole(targetRole);
		const newStatus: 'active' | 'pending' | 'rejected' | 'alumni' = targetAlumni
			? 'alumni'
			: previousStatus === 'alumni'
				? 'active'
				: previousStatus;

		await client.query('UPDATE users SET role_id = $2 WHERE id = $1', [userId, roleId]);
		if (newStatus !== previousStatus) {
			await updateUserStatus(userId, newStatus, client);
		}

		if (previous !== roleId || newStatus !== previousStatus) {
			await logAuditEvent(client, ctx, {
				action: roleId ? 'member.role_grant' : 'member.role_revoke',
				targetType: 'member',
				targetId: userId,
				targetName: memberTargetName(u.rows[0]),
				before: {
					roleId: previous,
					roleName: await roleName(client, previous),
					...(newStatus !== previousStatus ? { status: previousStatus } : {}),
				},
				after: {
					roleId,
					roleName: await roleName(client, roleId),
					...(newStatus !== previousStatus ? { status: newStatus } : {}),
				},
			});
			await publishEvent(client, { k: 'permission', userId });
		}
		return 'ok';
	});
}

export async function setMemberStatus(
	userId: string,
	status: 'active' | 'pending' | 'rejected' | 'alumni',
	ctx: AuditContext
): Promise<'ok' | 'none'> {
	return withTransaction(async (client) => {
		const u = await client.query(
			'SELECT first_name AS name, last_name AS surname, email, status, role_id AS "roleId" FROM users WHERE id = $1 FOR UPDATE',
			[userId]
		);
		const row = u.rows[0];
		if (!row) return 'none';
		let roleId: string | null = row.roleId ?? null;
		const currentRoleName = await roleName(client, roleId);

		if (status === 'alumni') {
			const alumniRole = await client.query(
				`SELECT id FROM roles WHERE id = $1 OR lower(name) = 'alumni' ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END LIMIT 1`,
				[ALUMNI_ROLE_ID]
			);
			if (alumniRole.rows[0]?.id) {
				roleId = String(alumniRole.rows[0].id);
				await client.query('UPDATE users SET role_id = $2 WHERE id = $1', [userId, roleId]);
			}
		} else if (
			status === 'active' &&
			((row.status === 'pending' && !roleId) ||
				(row.status === 'alumni' && (!roleId || isAlumniRole({ id: roleId, name: currentRoleName }))))
		) {
			const def = await client.query(
				`SELECT r.id FROM system_settings s JOIN roles r ON r.id = s.value WHERE s.key = $1
				 UNION ALL
				 SELECT id FROM roles WHERE id = $2 OR name = 'member'
				 LIMIT 1`,
				[DEFAULT_ROLE_KEY, MEMBER_ROLE_ID]
			);
			if (def.rows[0]) {
				roleId = def.rows[0].id as string;
				await client.query('UPDATE users SET role_id = $2 WHERE id = $1', [userId, roleId]);
			} else if (isAlumniRole({ id: roleId, name: currentRoleName })) {
				roleId = null;
				await client.query('UPDATE users SET role_id = NULL WHERE id = $1', [userId]);
			}
		}

		await updateUserStatus(userId, status, client);
		if (roleId !== (row.roleId ?? null)) await publishEvent(client, { k: 'permission', userId });
		const action = statusAction(row.status, status);
		if (!action) return 'ok';
		const oldRole: string | null = row.roleId ?? null;
		const diff = fieldDiff(
			{ status: row.status, roleId: oldRole, roleName: currentRoleName },
			{ status, roleId, roleName: await roleName(client, roleId) }
		);
		if (diff) {
			await logAuditEvent(client, ctx, {
				action,
				targetType: 'member',
				targetId: userId,
				targetName: memberTargetName(row),
				before: diff.before,
				after: diff.after,
			});
		}
		return 'ok';
	});
}

export async function setDefaultRoleId(
	roleId: string | null,
	ctx: AuditContext
): Promise<'ok' | 'none' | 'system'> {
	const out = await withTransaction(async (client): Promise<'ok' | 'none' | 'system'> => {
		if (roleId) {
			const r = await client.query('SELECT id, name, is_system AS "isSystem" FROM roles WHERE id = $1', [roleId]);
			if (!r.rows[0]) return 'none';
			const row = r.rows[0];
			if (
				Number(row.isSystem ?? row.is_system ?? 0) === 1 ||
				isAlumniRole({ id: String(row.id), name: String(row.name ?? '') })
			)
				return 'system';
		}
		const cur = await client.query('SELECT value AS value FROM system_settings WHERE key = $1 FOR UPDATE', [
			DEFAULT_ROLE_KEY,
		]);
		const previous: string | null = cur.rows[0]?.value || null;
		await client.query(
			`INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, $3)
			 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
			[DEFAULT_ROLE_KEY, roleId ?? '', Date.now()]
		);
		if (previous !== roleId) {
			await logAuditEvent(client, ctx, {
				action: 'role.default',
				targetType: 'setting',
				targetId: DEFAULT_ROLE_KEY,
				targetName: 'Default role',
				before: { roleId: previous, roleName: await roleName(client, previous) },
				after: { roleId, roleName: await roleName(client, roleId) },
			});
			await publishEvent(client, [{ k: 'permission' }, { k: 'settings_updated', key: DEFAULT_ROLE_KEY }]);
		}
		return 'ok';
	});
	if (out === 'ok') dropRoleCache();
	return out;
}
