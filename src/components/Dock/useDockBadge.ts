'use client';

import { useNotifications } from '@/components/NotificationCenter/NotificationsProvider';
import type { AppID } from '@/types/workspace';
import type { NotificationsResponse } from '@/types/notifications';

/** The number on an app's Dock icon, from the notification feed. Apps without one are absent. */
const DOCK_BADGES: Partial<Record<AppID, (counts: NotificationsResponse['counts']) => number>> = {
	chat: (counts) => counts.unreadMessages,
};

export function useDockBadge(appId: AppID): number {
	const { data } = useNotifications();
	const count = DOCK_BADGES[appId];
	return data && count ? count(data.counts) : 0;
}
