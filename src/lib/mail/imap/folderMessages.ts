import type { FolderMessagesResult, MailMessageSummary, MailParticipant } from './types';
import { withImapClient } from './connection';

/** Fetches messages for a given folder with pagination and search. */
export async function getFolderMessages(
	folderPath: string = 'INBOX',
	page: number = 1,
	pageSize: number = 25,
	searchQuery?: string
): Promise<FolderMessagesResult> {
	return withImapClient(async (client) => {
		const lock = await client.getMailboxLock(folderPath);
		try {
			const mailbox = client.mailbox;
			if (!mailbox || mailbox.exists === 0) {
				return { folder: folderPath, page, pageSize, total: 0, messages: [] };
			}

			let sequenceRange = '';
			let useUidFetch = false;
			let total = mailbox.exists;

			if (searchQuery && searchQuery.trim().length > 0) {
				const query = searchQuery.trim();
				const searchResult = await client.search(
					{ or: [{ subject: query }, { from: query }, { body: query }] },
					{ uid: true }
				);

				if (!searchResult || searchResult.length === 0) {
					return { folder: folderPath, page: 1, pageSize, total: 0, messages: [] };
				}

				total = searchResult.length;
				const reversed = [...searchResult].reverse();
				const startIdx = (page - 1) * pageSize;
				const sliced = reversed.slice(startIdx, startIdx + pageSize);

				if (sliced.length === 0) {
					return { folder: folderPath, page, pageSize, total, messages: [] };
				}

				sequenceRange = sliced.join(',');
				useUidFetch = true;
			} else {
				const totalMessages = mailbox.exists;
				const endSeq = Math.max(1, totalMessages - (page - 1) * pageSize);
				const startSeq = Math.max(1, endSeq - pageSize + 1);

				if (endSeq < 1 || startSeq > totalMessages) {
					return { folder: folderPath, page, pageSize, total: totalMessages, messages: [] };
				}

				sequenceRange = `${startSeq}:${endSeq}`;
			}

			const messages: MailMessageSummary[] = [];

			for await (const msg of client.fetch(
				sequenceRange,
				{ uid: true, flags: true, envelope: true, bodyStructure: true },
				{ uid: useUidFetch }
			)) {
				const env = msg.envelope;
				const fromItem = env?.from?.[0];
				const from: MailParticipant = {
					name: fromItem?.name || fromItem?.address || 'Unknown',
					address: fromItem?.address || '',
				};

				const to: MailParticipant[] = (env?.to || []).map((t) => ({
					name: t.name || t.address || '',
					address: t.address || '',
				}));

				let hasAttachments = false;
				if (msg.bodyStructure) {
					type PartNode = { disposition?: string; childNodes?: PartNode[] };
					const checkParts = (part: PartNode) => {
						if (part.disposition?.toLowerCase() === 'attachment') {
							hasAttachments = true;
						}
						if (part.childNodes && Array.isArray(part.childNodes)) {
							for (const child of part.childNodes) checkParts(child);
						}
					};
					checkParts(msg.bodyStructure as PartNode);
				}

				const flags = msg.flags ? Array.from(msg.flags) : [];
				const seen = flags.includes('\\Seen');
				const flagged = flags.includes('\\Flagged');

				messages.push({
					uid: msg.uid,
					id: `${folderPath}:${msg.uid}`,
					folder: folderPath,
					subject: env?.subject || '(No Subject)',
					from,
					to,
					date: env?.date ? new Date(env.date).getTime() : Date.now(),
					seen,
					flagged,
					hasAttachments,
					snippet: env?.subject || '',
				});
			}

			messages.sort((a, b) => b.date - a.date || b.uid - a.uid);

			return { folder: folderPath, page, pageSize, total, messages };
		} finally {
			lock.release();
		}
	});
}
