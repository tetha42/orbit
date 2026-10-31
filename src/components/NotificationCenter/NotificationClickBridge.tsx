'use client';

import { useEffect } from 'react';
import { useWindowActions } from '@/core/windows';
import { useSession } from '@/core/session';
import type { AppID, FocusTargetInput } from '@/types/workspace';

/**
 * Routes an OS/PWA notification click back into the window manager. The
 * service worker forwards the notification target; a notification opened while
 * the app was closed carries the same target in the boot URL. Mounted inside
 * WindowsProvider so it works on both the desktop and the mobile launcher.
 */
export function NotificationClickBridge() {
	const { openApp } = useWindowActions();
	const { isAuthenticated } = useSession();

	useEffect(() => {
		if (!isAuthenticated) return;
		const openTarget = (target: unknown) => {
			if (!target || typeof target !== 'object') return;
			const candidate = target as { appId?: string };
			if (!candidate.appId) return;
			openApp(candidate.appId as AppID, target as FocusTargetInput);
		};

		const onServiceWorkerMessage = (event: MessageEvent) => {
			if (event.data?.type !== 'ORBIT_NOTIFICATION_CLICK') return;
			openTarget(event.data.data?.target);
		};
		const onWindowEvent = (event: Event) => {
			openTarget((event as CustomEvent).detail?.target);
		};

		navigator.serviceWorker?.addEventListener('message', onServiceWorkerMessage);
		window.addEventListener('orbit:notification-click', onWindowEvent);

		const params = new URLSearchParams(window.location.search);
		const roomId = params.get('chatRoom');
		if (roomId) {
			openTarget({
				appId: 'chat',
				kind: 'thread',
				itemId: roomId,
				parentId: params.get('chatMessage') || undefined,
			});
			params.delete('chatRoom');
			params.delete('chatMessage');
			const query = params.toString();
			window.history.replaceState(
				{},
				'',
				`${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
			);
		}

		return () => {
			navigator.serviceWorker?.removeEventListener('message', onServiceWorkerMessage);
			window.removeEventListener('orbit:notification-click', onWindowEvent);
		};
	}, [openApp, isAuthenticated]);

	return null;
}
