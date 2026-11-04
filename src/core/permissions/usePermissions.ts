'use client';

import { useMemo } from 'react';
import { useSession } from '@/core/session';
import { canManage, canUse, type Permissions, type PermissionLevel } from './index';

/**
 * The signed-in member's permissions, for the UI.
 *
 *   const { can, isAdmin } = usePermissions();
 *   if (can('events', 'yonet')) …
 *
 * The UI only hides what the server would refuse anyway; every API checks the
 * same table again (lib/auth/access.ts).
 */
export function usePermissions() {
	const { currentUser } = useSession();
	const permissions: Permissions = currentUser?.permissions ?? {};
	const pending2fa = !!currentUser?.mustSetup2fa;
	return useMemo(
		() => ({
			permissions,
			isAdmin: !!currentUser?.admin,
			role: currentUser?.roleInfo ?? null,
			/** False for everything while a required second factor is not enrolled yet. */
			can: (appId: string, level: PermissionLevel | 'use' | 'manage' = 'use') =>
				!pending2fa && (level === 'manage' ? canManage(permissions, appId) : canUse(permissions, appId)),
		}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[currentUser]
	);
}
