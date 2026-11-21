import { errorMessage } from '@/lib/errors';
import { invalidateMailboxCache, withImapClient } from './connection';

/** Performs an action on an email (read, unread, star, unstar, trash, restore, delete). */
export async function performMailAction(
	folderPath: string,
	uid: number | number[],
	action: 'read' | 'unread' | 'star' | 'unstar' | 'trash' | 'restore' | 'delete'
): Promise<{ success: boolean; message?: string }> {
	try {
		const uids = Array.isArray(uid) ? uid : [uid];
		if (uids.length === 0) return { success: true };

		return await withImapClient(async (client) => {
			const lock = await client.getMailboxLock(folderPath);
			try {
				const seq = uids.join(',');
				const folderLower = folderPath.toLowerCase();
				const isAlreadyInTrash =
					folderLower.includes('trash') ||
					folderLower.includes('\u00e7\u00f6p') ||
					folderLower.includes('bin');

				if (action === 'read') {
					await client.messageFlagsAdd(seq, ['\\Seen'], { uid: true });
				} else if (action === 'unread') {
					await client.messageFlagsRemove(seq, ['\\Seen'], { uid: true });
				} else if (action === 'star') {
					await client.messageFlagsAdd(seq, ['\\Flagged'], { uid: true });
				} else if (action === 'unstar') {
					await client.messageFlagsRemove(seq, ['\\Flagged'], { uid: true });
				} else if (action === 'restore') {
					await client.messageMove(seq, 'INBOX', { uid: true });
				} else if (action === 'delete' || (action === 'trash' && isAlreadyInTrash)) {
					await client.messageDelete(seq, { uid: true });
				} else if (action === 'trash') {
					try {
						await client.messageMove(seq, '[Gmail]/Trash', { uid: true });
					} catch {
						try {
							await client.messageMove(seq, 'Trash', { uid: true });
						} catch {
							await client.messageDelete(seq, { uid: true });
						}
					}
				}
				invalidateMailboxCache();
				return { success: true };
			} finally {
				lock.release();
			}
		});
	} catch (err) {
		return { success: false, message: errorMessage(err) };
	}
}

/** Empties a folder (typically Trash), permanently deleting all messages inside. */
export async function emptyTrashFolder(
	folderPath: string
): Promise<{ success: boolean; message?: string }> {
	try {
		return await withImapClient(async (client) => {
			const lock = await client.getMailboxLock(folderPath);
			try {
				const mailbox = client.mailbox;
				const count = mailbox && typeof mailbox.exists === 'number' ? mailbox.exists : 0;
				if (count > 0) {
					await client.messageDelete('1:*', { uid: false });
				}
				invalidateMailboxCache();
				return { success: true };
			} finally {
				lock.release();
			}
		});
	} catch (err) {
		return { success: false, message: errorMessage(err) };
	}
}
