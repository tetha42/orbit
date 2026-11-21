import { getRolePermission } from '@/db/roles';
import type { AuthorizedUser } from '@/lib/auth/access';
import { ADMIN_ROLE_ID, PERMISSION_DESCRIPTIONS, extraPermissions } from '@/core/permissions';

/**
 * Whether `actor` may hand out or act on `roleId`: nobody may give a role, or
 * touch a member, stronger than themselves; the admin role is the admin's.
 */
export async function roleLimitProblem(
	actor: AuthorizedUser,
	roleId: string | null | undefined
): Promise<string | null> {
	if (!roleId) return null;
	if (roleId === ADMIN_ROLE_ID && !actor.permission.admin) {
		return 'Only an administrator can grant the admin role.';
	}
	const excess = extraPermissions((await getRolePermission(roleId)).permissions, actor.permission.permissions);
	return excess.length
		? `Cannot grant a role with greater permissions than your own (${excess
				.map((a) => PERMISSION_DESCRIPTIONS[a].name)
				.join(', ')}).`
		: null;
}
