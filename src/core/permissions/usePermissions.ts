'use client';

import { useMemo } from 'react';
import { useSession } from '@/core/session';
import { canManage, canUse, type Permissions, type Seviye } from './index';

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
	const izinler: Permissions = currentUser?.izinler ?? {};
	const pending2fa = !!currentUser?.mustSetup2fa;
	return useMemo(
		() => ({
			izinler,
			isAdmin: !!currentUser?.admin,
			role: currentUser?.rolBilgi ?? null,
			/** False for everything while a required second factor is not enrolled yet. */
			can: (appId: string, seviye: Seviye = 'kullan') => !pending2fa && (seviye === 'yonet' ? canManage(izinler, appId) : canUse(izinler, appId)),
		}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[currentUser]
	);
}
