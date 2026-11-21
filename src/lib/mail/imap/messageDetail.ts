import type { Readable } from 'node:stream';
import type { ImapFlow } from 'imapflow';
import { simpleParser, type ParsedMail } from 'mailparser';
import type { MailAttachmentMeta, MailMessageDetail, MailParticipant } from './types';
import { invalidateMailboxCache, withImapClient } from './connection';

async function fetchRawMessageInLockedMailbox(
	client: ImapFlow,
	uid: number
): Promise<{ source: Buffer | Readable; flags: string[] } | null> {
	try {
		const fetched = await client.fetchOne(
			String(uid),
			{ uid: true, flags: true, source: true },
			{ uid: true }
		);
		if (fetched && fetched.source) {
			const flags = fetched.flags ? Array.from(fetched.flags) : [];
			return { source: fetched.source, flags };
		}
	} catch {
		// Fall through to client.download
	}

	try {
		const download = await client.download(String(uid), undefined, { uid: true });
		if (download && download.content) {
			return { source: download.content, flags: ['\\Seen'] };
		}
	} catch {
		// Not found in this mailbox
	}

	return null;
}

/** Fetches full message detail for a specific UID in a folder. */
export async function getMessageDetail(
	folderPath: string,
	uid: number
): Promise<MailMessageDetail> {
	return withImapClient(async (client) => {
		let targetFolder = folderPath;
		let rawResult: { source: Buffer | Readable; flags: string[] } | null = null;

		const lock = await client.getMailboxLock(folderPath);
		try {
			rawResult = await fetchRawMessageInLockedMailbox(client, uid);
			if (rawResult && !rawResult.flags.includes('\\Seen')) {
				await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true }).catch(() => {});
				rawResult.flags.push('\\Seen');
				invalidateMailboxCache();
			}
		} finally {
			lock.release();
		}

		if (!rawResult) {
			const fallbackFolders = ['[Gmail]/Trash', 'INBOX', '[Gmail]/All Mail'].filter(
				(f) => f !== folderPath
			);
			for (const candidate of fallbackFolders) {
				try {
					const fallbackLock = await client.getMailboxLock(candidate);
					try {
						const found = await fetchRawMessageInLockedMailbox(client, uid);
						if (found) {
							rawResult = found;
							targetFolder = candidate;
							break;
						}
					} finally {
						fallbackLock.release();
					}
				} catch {
					// Ignore if fallback mailbox doesn't exist
				}
			}
		}

		if (!rawResult) {
			throw new Error('Message not found in this folder (it may have been moved or deleted).');
		}

		const parsed: ParsedMail = await simpleParser(rawResult.source);

		const fromItem = parsed.from?.value?.[0];
		const from: MailParticipant = {
			name: fromItem?.name || fromItem?.address || 'Unknown',
			address: fromItem?.address || '',
		};

		const toList = (addr: ParsedMail['to']): MailParticipant[] => {
			const arr = Array.isArray(addr) ? addr : addr ? [addr] : [];
			return arr.flatMap((entry) =>
				(entry.value || []).map((item) => ({
					name: item.name || item.address || '',
					address: item.address || '',
				}))
			);
		};

		const attachments: MailAttachmentMeta[] = (parsed.attachments || []).map((att) => ({
			filename: att.filename || 'attachment',
			contentType: att.contentType || 'application/octet-stream',
			size: att.size || (att.content ? att.content.length : 0),
			checksum: att.checksum,
		}));

		const html =
			parsed.html ||
			(parsed.textAsHtml
				? parsed.textAsHtml
				: parsed.text
					? `<pre style="white-space:pre-wrap;font-family:inherit;">${parsed.text}</pre>`
					: '');
		const text = parsed.text || '';
		const snippet = text.slice(0, 140).replace(/\s+/g, ' ').trim() || parsed.subject || '';

		return {
			uid,
			id: `${targetFolder}:${uid}`,
			folder: targetFolder,
			subject: parsed.subject || '(No Subject)',
			from,
			to: toList(parsed.to),
			cc: toList(parsed.cc),
			bcc: toList(parsed.bcc),
			date: parsed.date ? new Date(parsed.date).getTime() : Date.now(),
			seen: true,
			flagged: rawResult.flags.includes('\\Flagged'),
			hasAttachments: attachments.length > 0,
			attachments,
			snippet,
			html,
			text,
		};
	});
}
