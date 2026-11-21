import { randomBytes } from 'crypto';
import { withTransaction } from '../index';
import { logAuditEvent, type AuditContext } from '../audit';
import { publishEvent } from '../events';
import { roleDiff } from '@/lib/audit';
import { ALUMNI_ROLE_ID, type Permissions } from '@/core/permissions';
import {
	DEFAULT_ROLE_KEY,
	cleanPermissions,
	normalizeDesktopAuthPolicy,
	type DesktopAuthPolicy,
	type RoleResult,
} from './types';
import { insertRole } from './schema';
import { dropRoleCache, readRoleSummary, roleName } from './queries';

export interface RoleMutationInput {
	name?: string;
	color?: string;
	description?: string;
	permissions?: Permissions;
	require2fa?: boolean;
	twoStepRequired?: boolean;
	allowMobileAccess?: boolean;
	allowDesktopAccess?: boolean;
	desktopAuthPolicy?: DesktopAuthPolicy;
}

export async function createRole(r: RoleMutationInput, ctx: AuditContext): Promise<RoleResult> {
	const id = `role_${randomBytes(6).toString('hex')}`;
	const name = (r.name ?? '').trim();
	const color = r.color ?? '#0a84ff';
	const description = r.description ?? '';
	const require2fa = Boolean(r.require2fa ?? r.twoStepRequired);
	const permissions = r.permissions ?? {};
	const allowMobileAccess = r.allowMobileAccess !== false;
	const allowDesktopAccess = r.allowDesktopAccess !== false;
	const desktopAuthPolicy = normalizeDesktopAuthPolicy(r.desktopAuthPolicy);
	try {
		await withTransaction(async (client) => {
			await insertRole(client, id, name, color, description, require2fa, Date.now(), permissions);
			await client.query(
				'UPDATE roles SET allow_mobile_access = $2, allow_desktop_access = $3, desktop_auth_policy = $4 WHERE id = $1',
				[id, allowMobileAccess, allowDesktopAccess, desktopAuthPolicy]
			);
			await logAuditEvent(client, ctx, {
				action: 'role.create',
				targetType: 'role',
				targetId: id,
				targetName: name,
				before: null,
				after: await readRoleSummary(client, id),
			});
			await publishEvent(client, { k: 'permission', roleId: id });
		});
	} catch (err) {
		if ((err as { code?: string }).code === '23505') return { ok: false, error: 'name_taken' };
		throw err;
	}
	dropRoleCache();
	return { ok: true, id };
}

export async function updateRole(id: string, r: RoleMutationInput, ctx: AuditContext): Promise<RoleResult> {
	const name = (r.name ?? '').trim();
	const color = r.color ?? '#0a84ff';
	const description = r.description ?? '';
	const require2fa = Boolean(r.require2fa ?? r.twoStepRequired);
	const permissions = r.permissions ?? {};
	const allowMobileAccess = r.allowMobileAccess !== false;
	const allowDesktopAccess = r.allowDesktopAccess !== false;
	const desktopAuthPolicy = normalizeDesktopAuthPolicy(r.desktopAuthPolicy);
	try {
		const out = await withTransaction(async (client): Promise<RoleResult> => {
			const found = await client.query('SELECT is_system AS "isSystem" FROM roles WHERE id = $1 FOR UPDATE', [id]);
			if (!found.rows[0]) return { ok: false, error: 'none' };
			if (Number(found.rows[0].isSystem ?? found.rows[0].is_system ?? 0) === 1)
				return { ok: false, error: 'system' };
			const previous = await readRoleSummary(client, id);
			const perms = cleanPermissions(permissions);
			await client.query(
				`UPDATE roles
				 SET name = $2, color = $3, description = $4, permissions = $5::jsonb,
				     require_2fa = $6, allow_mobile_access = $7, allow_desktop_access = $8, desktop_auth_policy = $9
				 WHERE id = $1`,
				[
					id,
					name,
					color,
					description,
					JSON.stringify(perms),
					require2fa ? 1 : 0,
					allowMobileAccess,
					allowDesktopAccess,
					desktopAuthPolicy,
				]
			);
			const after = await readRoleSummary(client, id);
			const diff = previous && after ? roleDiff(previous, after) : null;
			const policyBefore: Record<string, unknown> = {};
			const policyAfter: Record<string, unknown> = {};
			if (previous && after) {
				for (const k of ['allowMobileAccess', 'allowDesktopAccess', 'desktopAuthPolicy'] as const) {
					if (previous[k] !== after[k]) {
						policyBefore[k] = previous[k];
						policyAfter[k] = after[k];
					}
				}
			}
			if (diff || Object.keys(policyAfter).length > 0) {
				await logAuditEvent(client, ctx, {
					action: 'role.edit',
					targetType: 'role',
					targetId: id,
					targetName: after?.name ?? name,
					before: { ...(diff?.before ?? {}), ...policyBefore },
					after: { ...(diff?.after ?? {}), ...policyAfter },
				});
				await publishEvent(client, { k: 'permission', roleId: id });
			}
			return { ok: true, id };
		});
		dropRoleCache();
		return out;
	} catch (err) {
		if ((err as { code?: string }).code === '23505') return { ok: false, error: 'name_taken' };
		throw err;
	}
}

/** Deletes a role; its members move to `move` (another role) or to no role. */
export async function deleteRole(id: string, move: string | null, ctx: AuditContext): Promise<RoleResult> {
	const out = await withTransaction(async (client): Promise<RoleResult> => {
		const found = await client.query('SELECT is_system AS "isSystem" FROM roles WHERE id = $1 FOR UPDATE', [id]);
		if (!found.rows[0]) return { ok: false, error: 'none' };
		if (Number(found.rows[0].isSystem ?? found.rows[0].is_system ?? 0) === 1 || id === ALUMNI_ROLE_ID)
			return { ok: false, error: 'system' };
		if (move) {
			const target = await client.query('SELECT 1 FROM roles WHERE id = $1 AND id <> $2', [move, id]);
			if (!target.rowCount) return { ok: false, error: 'none' };
		}
		const previous = await readRoleSummary(client, id);
		const moveName = await roleName(client, move);
		const moved = await client.query('UPDATE users SET role_id = $2 WHERE role_id = $1', [id, move]);
		await client.query('DELETE FROM roles WHERE id = $1', [id]);
		const def = await client.query(`SELECT value AS value FROM system_settings WHERE key = $1`, [DEFAULT_ROLE_KEY]);
		const wasDefault = def.rows[0]?.value === id;
		if (wasDefault) await client.query(`DELETE FROM system_settings WHERE key = $1`, [DEFAULT_ROLE_KEY]);
		await logAuditEvent(client, ctx, {
			action: 'role.delete',
			targetType: 'role',
			targetId: id,
			targetName: previous?.name ?? '',
			before: previous,
			after: {
				movedCount: moved.rowCount ?? 0,
				movedToRoleId: move,
				movedToRoleName: moveName,
				defaultRoleCleared: wasDefault,
			},
		});
		await publishEvent(
			client,
			wasDefault
				? [{ k: 'permission', roleId: id }, { k: 'settings_updated', key: DEFAULT_ROLE_KEY }]
				: { k: 'permission', roleId: id }
		);
		return { ok: true, id };
	});
	dropRoleCache();
	return out;
}
