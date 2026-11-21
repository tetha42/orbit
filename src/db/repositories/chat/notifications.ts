import { getPgPool } from '@/db';
import { notificationEvents, publishEventQuiet } from '@/db/events';
import { getChatAudience } from '@/server/chat/chatAudience';

/**
 * Emits a `notification` event on the global `orbit_events` SSE bus for all members
 * of `roomId` (except `excludeUserId`), so their TopBar Notification Center,
 * Dock badge, and background PWA/OS notifications update even when the Chat window is closed.
 */
export async function notifyChatRoomParticipants(roomId: string, excludeUserId?: string): Promise<void> {
	const p = getPgPool();
	try {
		const audience = await getChatAudience(roomId);
		if (!audience) return;

		if (audience.all) {
			await publishEventQuiet(p, { k: 'notification' });
			return;
		}

		const targetIds = [...audience.memberIds].filter((id) => id !== excludeUserId);
		if (targetIds.length > 0) {
			await publishEventQuiet(p, notificationEvents(targetIds));
		}
	} catch (err) {
		console.warn('[Chat notify warning]:', err);
	}
}
