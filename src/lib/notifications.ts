/**
 * Pure helpers for the notification center — no imports besides types, so they run
 * under plain Node (`node scripts/check-pure.mjs`) as well as in the browser.
 */
import type { NotificationItem, NotificationsResponse } from '@/types/notifications';

const DAY = 86_400_000;

/**
 * A member who has never opened the list on this browser is treated as having last
 * looked this long ago, so their first bell shows what is recent instead of every
 * item of the last two weeks.
 */
export const FIRST_LOOK_LOOKBACK_MS = 3 * DAY;

export interface NotificationGroups {
	/** The recent announcement marked "önemli", shown above everything else. */
	pinned: NotificationItem | null;
	/** To-dos, the most pressing first. Never "read": they stay until done. */
	action: NotificationItem[];
	/** Things that appeared since the member last looked. */
	fresh: NotificationItem[];
	earlier: NotificationItem[];
}

/** Splits the feed for display. `seenAt` is when the member last looked, on the server's clock. */
export function groupNotifications(items: NotificationItem[], seenAt: number): NotificationGroups {
	const pinned = items.find((item) => item.urgent) ?? null;
	const info = items.filter((item) => item.priority === 'info' && item !== pinned);
	const newestFirst = (a: NotificationItem, b: NotificationItem) => b.at - a.at;
	return {
		pinned,
		action: items
			.filter((item) => item.priority === 'action')
			.sort((a, b) => (a.dueAt ?? a.at) - (b.dueAt ?? b.at)),
		fresh: info.filter((item) => item.at > seenAt).sort(newestFirst),
		earlier: info.filter((item) => item.at <= seenAt).sort(newestFirst),
	};
}

/** What the bell's badge shows: every open to-do plus whatever is new since the last look. */
export function unreadCount(response: NotificationsResponse | null, seenAt: number): number {
	if (!response) return 0;
	const fresh = response.items.filter((item) => item.priority === 'info' && item.at > seenAt).length;
	return response.counts.actionRequired + fresh;
}

