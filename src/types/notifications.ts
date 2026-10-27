import type { NotificationKind } from '@/apps';
import type { AppID, FocusTargetInput } from './workspace';

/**
 * What a notification is about; the client picks the icon and the wording from this.
 * The kinds are declared by the apps' manifests (src/apps/<id>/manifest.ts → `notifications`).
 */
export type { NotificationKind };

/**
 * `action`: something the member has to do (approve an application, finish a task,
 * return a loan). It stays until it is done. `info`: something to know — it counts
 * as new only until the member has looked at the list.
 */
export type NotificationPriority = 'action' | 'info';

export interface NotificationItem {
	/** Stable across polls: `"<kind>:<record id>"`. */
	id: string;
	kind: NotificationKind;
	priority: NotificationPriority;
	/** A pinned announcement (recent news marked "önemli"). */
	urgent?: boolean;
	/** When this became relevant, on the server's clock; "new" means `at` is later than the member's last look. */
	at: number;
	/** The deadline or start time, for kinds that have one. */
	dueAt?: number;
	/**
	 * Facts about the record. The server sends no display text of its own — the
	 * wording ("Üyelik başvurusu", "Yarın") belongs to the client, in the member's language.
	 */
	data: { title: string } & Record<string, string | number | boolean | null | undefined>;
	/** Where clicking goes — passed straight to `openApp(appId, target)`. */
	target: { appId: AppID } & FocusTargetInput;
}

export interface NotificationsResponse {
	/** The server's clock when this was built; the reference for `at`. */
	generatedAt: number;
	counts: {
		/** Every open to-do, including approvals beyond the ones listed. */
		actionRequired: number;
		total: number;
		/** Inbox conversations with something unread (the Mail app's Dock badge); 0 when the role does not open Mail. */
		unreadMessages: number;
	};
	items: NotificationItem[];
	/** Pending applications that did not fit the list (management only). */
	moreApprovals?: number;
}
