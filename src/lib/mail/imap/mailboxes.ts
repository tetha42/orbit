import type { MailFolderInfo } from './types';
import { getCachedMailboxes, setCachedMailboxes, withImapClient } from './connection';

/** Maps folder role and default label from IMAP path and special-use flags, including common localized folder names. */
function classifyMailbox(box: { path: string; name: string; specialUse?: string }): {
	role: MailFolderInfo['role'];
	name: string;
} {
	const pathLower = box.path.toLowerCase();
	const special = (box.specialUse || '').toLowerCase();

	if (special === '\\inbox' || pathLower === 'inbox') {
		return { role: 'inbox', name: 'Inbox' };
	}
	if (special === '\\sent' || pathLower.includes('sent') || pathLower.includes('g\u00f6nderilen')) {
		return { role: 'sent', name: 'Sent' };
	}
	if (special === '\\drafts' || pathLower.includes('draft')) {
		return { role: 'drafts', name: 'Drafts' };
	}
	if (special === '\\trash' || pathLower.includes('trash') || pathLower.includes('\u00e7\u00f6p') || pathLower.includes('bin')) {
		return { role: 'trash', name: 'Trash' };
	}
	if (special === '\\junk' || pathLower.includes('spam') || pathLower.includes('junk')) {
		return { role: 'spam', name: 'Spam' };
	}
	if (special === '\\flagged' || pathLower.includes('starred') || pathLower.includes('y\u0131ld\u0131zl\u0131')) {
		return { role: 'starred', name: 'Starred' };
	}

	return { role: 'other', name: box.name || box.path };
}

/** Lists the standard mailboxes with their unread and total message counts. */
export async function getMailboxes(
	forceRefresh: boolean = false
): Promise<{ folders: MailFolderInfo[]; user: string }> {
	if (!forceRefresh) {
		const cached = getCachedMailboxes();
		if (cached) return cached;
	}

	return withImapClient(async (client, config) => {
		const list = await client.list();
		const folders: MailFolderInfo[] = [];

		const rolePriority: Record<MailFolderInfo['role'], number> = {
			inbox: 1,
			starred: 2,
			sent: 3,
			drafts: 4,
			trash: 5,
			spam: 6,
			other: 7,
		};

		for (const box of list) {
			const { role, name } = classifyMailbox(box);
			if (role === 'other') continue;

			try {
				const status = await client.status(box.path, { messages: true, unseen: true });
				const unseen =
					status && typeof status === 'object' && typeof status.unseen === 'number'
						? status.unseen
						: 0;
				const total =
					status && typeof status === 'object' && typeof status.messages === 'number'
						? status.messages
						: 0;
				folders.push({ id: box.path, role, name, unread: unseen, total });
			} catch {
				folders.push({ id: box.path, role, name, unread: 0, total: 0 });
			}
		}

		if (!folders.some((f) => f.role === 'inbox')) {
			try {
				const status = await client.status('INBOX', { messages: true, unseen: true });
				const unseen =
					status && typeof status === 'object' && typeof status.unseen === 'number'
						? status.unseen
						: 0;
				const total =
					status && typeof status === 'object' && typeof status.messages === 'number'
						? status.messages
						: 0;
				folders.unshift({ id: 'INBOX', role: 'inbox', name: 'Inbox', unread: unseen, total });
			} catch {
				folders.unshift({ id: 'INBOX', role: 'inbox', name: 'Inbox', unread: 0, total: 0 });
			}
		}

		folders.sort((a, b) => rolePriority[a.role] - rolePriority[b.role]);
		const result = { folders, user: config.user };
		setCachedMailboxes(result);
		return result;
	});
}
