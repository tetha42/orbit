'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveEvent, useSession } from '@/core/session';
import { useShell } from '@/core/shell';
import { useSound } from '@/core/sound';
import { useJsonResource } from '@/core/data/useJsonResource';
import { FIRST_LOOK_LOOKBACK_MS, unreadCount } from '@/lib/notifications';
import { showAppNotification } from '@/lib/client/notifications';
import type { NotificationsResponse } from '@/types/notifications';

/** How often the feed is refreshed while the tab is visible. */
const POLL_MS = 60_000;

interface NotificationsContextValue {
	data: NotificationsResponse | null;
	/** True until the first answer or failure arrives. */
	isLoading: boolean;
	/** The latest refresh failed; `data`, if any, is the last good list. */
	hasError: boolean;
	/** What the bell shows: open to-dos plus anything new since the member last opened the list. */
	badge: number;
	/** Some new item is a pinned announcement — the badge turns red for it. */
	hasUrgent: boolean;
	/** When the member looked before the current visit; what the open panel measures "new" against. */
	viewSince: number;
	refresh: () => Promise<void>;
}

const NO_NOTIFICATIONS: NotificationsContextValue = {
	data: null,
	isLoading: false,
	hasError: false,
	badge: 0,
	hasUrgent: false,
	viewSince: 0,
	refresh: async () => {},
};

const NotificationsContext = createContext<NotificationsContextValue>(NO_NOTIFICATIONS);

/** Outside a provider (the phone launcher has no bell) this is an empty, inert feed. */
export function useNotifications(): NotificationsContextValue {
	return useContext(NotificationsContext);
}

const seenKey = (userId: string | null) => `beu_notif_seen:${userId ?? 'anon'}`;

function readSeenAt(userId: string | null): number {
	try {
		const stored = Number(localStorage.getItem(seenKey(userId)));
		if (Number.isFinite(stored) && stored > 0) return stored;
	} catch {
		// Storage can be blocked; the member simply sees the recent items as new.
	}
	return Date.now() - FIRST_LOOK_LOOKBACK_MS;
}

/**
 * Owns the notification feed for the signed-in member: polling, and the one piece
 * of state that turns a feed into a badge — when the member last looked.
 *
 * "Last looked" moves when the panel opens and again when it closes. It is
 * measured on the server's clock (`generatedAt`) because that is the clock `at` is
 * written in, and it lives in `localStorage` per member: it is a convenience of
 * this browser, not something the server needs to know.
 */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
	const { currentUserId } = useSession();
	const { isNotificationCenterOpen } = useShell();
	const { playSystemSound } = useSound();
	const { data, error, refetch } = useJsonResource<NotificationsResponse>('/api/notifications');

	const [seenAt, setSeenAt] = useState(() => readSeenAt(currentUserId));
	const [viewSince, setViewSince] = useState(seenAt);
	const [wasOpen, setWasOpen] = useState(isNotificationCenterOpen);
	const lastAlertedMsgAtRef = useRef<number | null>(null);

	// Opening or closing the panel is a "look". These are state adjustments made while
	// rendering — React's sanctioned way to derive state from a changed value — so the
	// badge and the panel's grouping change in the same pass as the panel itself.
	if (isNotificationCenterOpen !== wasOpen) {
		setWasOpen(isNotificationCenterOpen);
		if (isNotificationCenterOpen) setViewSince(seenAt);
		if (data) setSeenAt(data.generatedAt);
	}

	// Alert user (sound + OS/PWA notification) when a new unread message arrives in the feed,
	// even when the Chat app window is closed or minimized.
	useEffect(() => {
		if (!data) return;
		const msgItems = data.items.filter((i) => i.kind === 'message');
		const maxAt = msgItems.reduce((max, i) => Math.max(max, i.at), 0);

		if (lastAlertedMsgAtRef.current === null) {
			lastAlertedMsgAtRef.current = Math.max(data.generatedAt, maxAt);
			return;
		}

		const freshMsgs = msgItems.filter((i) => i.at > (lastAlertedMsgAtRef.current ?? 0));
		if (freshMsgs.length > 0) {
			lastAlertedMsgAtRef.current = Math.max(lastAlertedMsgAtRef.current, maxAt);
			playSystemSound();
			const newest = freshMsgs[0];
			void showAppNotification(String(newest.data.from || 'Yeni Mesaj'), {
				body: newest.data.title,
				tag: `chat-${newest.target.itemId || newest.id}`,
				data: { target: newest.target, messageId: newest.data.messageId ?? null },
			});
		}
	}, [data, playSystemSound]);

	useEffect(() => {
		try {
			localStorage.setItem(seenKey(currentUserId), String(seenAt));
		} catch {
			// see readSeenAt
		}
	}, [currentUserId, seenAt]);

	const refetchRef = useRef(refetch);
	useEffect(() => {
		refetchRef.current = refetch;
	});
	// The server says something new is there (or the role changed, which changes what the feed shows): read it now.
	useLiveEvent((event) => {
		if (event !== 'oturum-sonlandi') void refetchRef.current().catch(() => {});
	});
	useEffect(() => {
		const tick = () => {
			if (!document.hidden) void refetchRef.current().catch(() => {});
		};
		const timer = setInterval(tick, POLL_MS);
		// Coming back to the tab is the moment a stale badge is most noticeable.
		document.addEventListener('visibilitychange', tick);
		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', tick);
		};
	}, []);

	const value = useMemo<NotificationsContextValue>(
		() => ({
			data,
			isLoading: data === null && error === null,
			hasError: error !== null,
			badge: unreadCount(data, seenAt),
			hasUrgent: !!data?.items.some((item) => item.urgent && item.at > seenAt),
			viewSince,
			refresh: async () => {
				try {
					await refetchRef.current();
				} catch {
					// Keep the last good feed; the badge shows the error state.
				}
			},
		}),
		[data, error, seenAt, viewSince]
	);

	return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
