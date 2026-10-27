import type { Readable } from 'node:stream';
import { ImapFlow } from 'imapflow';
import { simpleParser, type ParsedMail } from 'mailparser';
import { readImapAccount, type ImapConfig } from './smtpSettings';
import { errorMessage } from '@/lib/errors';

export interface MailFolderInfo {
	id: string;
	role: 'inbox' | 'starred' | 'sent' | 'drafts' | 'trash' | 'spam' | 'other';
	name: string;
	unread: number;
	total: number;
}

export interface MailParticipant {
	name: string;
	address: string;
}

export interface MailMessageSummary {
	uid: number;
	id: string;
	folder: string;
	subject: string;
	from: MailParticipant;
	to: MailParticipant[];
	date: number;
	seen: boolean;
	flagged: boolean;
	hasAttachments: boolean;
	snippet: string;
}

export interface MailAttachmentMeta {
	filename: string;
	contentType: string;
	size: number;
	checksum?: string;
}

export interface MailMessageDetail extends MailMessageSummary {
	html: string;
	text: string;
	cc: MailParticipant[];
	bcc: MailParticipant[];
	attachments: MailAttachmentMeta[];
}

export interface FolderMessagesResult {
	folder: string;
	page: number;
	pageSize: number;
	total: number;
	messages: MailMessageSummary[];
}

// ============================================================================
// Warm IMAP Connection Manager (Singleton per Node process with idle timeout)
// ============================================================================

const IDLE_TIMEOUT_MS = 90_000; // Keep connection warm for 90s between admin clicks
const MAILBOX_CACHE_TTL_MS = 15_000; // Cache folder counts for 15s unless invalidated

let sharedClient: ImapFlow | null = null;
let sharedConfig: ImapConfig | null = null;
let connectPromise: Promise<{ client: ImapFlow; config: ImapConfig }> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let operationQueue: Promise<unknown> = Promise.resolve();

let mailboxCache: {
	timestamp: number;
	data: { folders: MailFolderInfo[]; user: string };
} | null = null;

export function invalidateMailboxCache() {
	mailboxCache = null;
}

function resetIdleTimer() {
	if (idleTimer) clearTimeout(idleTimer);
	idleTimer = setTimeout(() => {
		const clientToClose = sharedClient;
		sharedClient = null;
		sharedConfig = null;
		connectPromise = null;
		if (clientToClose) {
			clientToClose.logout().catch(() => {
				try {
					clientToClose.close();
				} catch {
					// ignore
				}
			});
		}
	}, IDLE_TIMEOUT_MS);
}

function discardSharedClient() {
	if (idleTimer) {
		clearTimeout(idleTimer);
		idleTimer = null;
	}
	const old = sharedClient;
	sharedClient = null;
	sharedConfig = null;
	connectPromise = null;
	if (old) {
		try {
			old.close();
		} catch {
			// ignore
		}
	}
}

/**
 * Creates a fresh ImapFlow client configured with current credentials.
 */
export async function createImapClient(): Promise<{ client: ImapFlow; config: ImapConfig }> {
	const config = await readImapAccount();
	if (!config.user || !config.pass) {
		throw new Error('E-posta hesabı yapılandırılmamış veya uygulama şifresi girilmemiş.');
	}

	const client = new ImapFlow({
		host: config.host,
		port: config.port,
		secure: config.secure,
		auth: {
			user: config.user,
			pass: config.pass,
		},
		logger: false,
		tls: {
			rejectUnauthorized: false,
		},
		connectionTimeout: 15_000,
		greetingTimeout: 15_000,
		socketTimeout: 30_000,
	});

	// Prevent unhandled error events from crashing the Node process
	client.on('error', () => {
		discardSharedClient();
	});
	client.on('close', () => {
		discardSharedClient();
	});

	return { client, config };
}

async function getConnectedClient(): Promise<{ client: ImapFlow; config: ImapConfig }> {
	if (sharedClient && sharedClient.usable && sharedConfig) {
		resetIdleTimer();
		return { client: sharedClient, config: sharedConfig };
	}

	if (connectPromise) {
		return connectPromise;
	}

	connectPromise = (async () => {
		try {
			discardSharedClient();
			const { client, config } = await createImapClient();
			await client.connect();
			sharedClient = client;
			sharedConfig = config;
			resetIdleTimer();
			return { client, config };
		} catch (err) {
			discardSharedClient();
			throw err;
		} finally {
			connectPromise = null;
		}
	})();

	return connectPromise;
}

/**
 * Runs an IMAP operation serialized on the warm client, with automatic 1x reconnect retry
 * if the socket was closed by the remote server.
 */
async function withImapClient<T>(
	fn: (client: ImapFlow, config: ImapConfig) => Promise<T>
): Promise<T> {
	const run = async (): Promise<T> => {
		try {
			const { client, config } = await getConnectedClient();
			resetIdleTimer();
			return await fn(client, config);
		} catch (firstErr) {
			const msg = errorMessage(firstErr).toLowerCase();
			const isConnectionIssue =
				msg.includes('closed') ||
				msg.includes('connection') ||
				msg.includes('socket') ||
				msg.includes('timeout') ||
				msg.includes('not available') ||
				msg.includes('usable');

			if (isConnectionIssue) {
				discardSharedClient();
				const { client, config } = await getConnectedClient();
				resetIdleTimer();
				return await fn(client, config);
			}
			throw firstErr;
		}
	};

	const next = operationQueue.then(run, run);
	operationQueue = next.then(
		() => undefined,
		() => undefined
	);
	return next;
}

/**
 * Maps folder role and Turkish label from path and IMAP special-use flags.
 */
function classifyMailbox(box: { path: string; name: string; specialUse?: string }): {
	role: MailFolderInfo['role'];
	name: string;
} {
	const pathLower = box.path.toLowerCase();
	const special = (box.specialUse || '').toLowerCase();

	if (special === '\\inbox' || pathLower === 'inbox') {
		return { role: 'inbox', name: 'Gelen Kutusu' };
	}
	if (special === '\\sent' || pathLower.includes('sent') || pathLower.includes('gönderilen')) {
		return { role: 'sent', name: 'Gönderilenler' };
	}
	if (special === '\\drafts' || pathLower.includes('draft') || pathLower.includes('taslak')) {
		return { role: 'drafts', name: 'Taslaklar' };
	}
	if (special === '\\trash' || pathLower.includes('trash') || pathLower.includes('çöp') || pathLower.includes('bin')) {
		return { role: 'trash', name: 'Çöp Kutusu' };
	}
	if (special === '\\junk' || pathLower.includes('spam') || pathLower.includes('junk')) {
		return { role: 'spam', name: 'İstenmeyen (Spam)' };
	}
	if (special === '\\flagged' || pathLower.includes('starred') || pathLower.includes('yıldızlı')) {
		return { role: 'starred', name: 'Yıldızlılar' };
	}

	return { role: 'other', name: box.name || box.path };
}

/**
 * Lists the standard mailboxes with their unread and total message counts.
 */
export async function getMailboxes(
	forceRefresh: boolean = false
): Promise<{ folders: MailFolderInfo[]; user: string }> {
	if (!forceRefresh && mailboxCache && Date.now() - mailboxCache.timestamp < MAILBOX_CACHE_TTL_MS) {
		return mailboxCache.data;
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
				folders.push({
					id: box.path,
					role,
					name,
					unread: unseen,
					total: total,
				});
			} catch {
				folders.push({
					id: box.path,
					role,
					name,
					unread: 0,
					total: 0,
				});
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
				folders.unshift({
					id: 'INBOX',
					role: 'inbox',
					name: 'Gelen Kutusu',
					unread: unseen,
					total: total,
				});
			} catch {
				folders.unshift({
					id: 'INBOX',
					role: 'inbox',
					name: 'Gelen Kutusu',
					unread: 0,
					total: 0,
				});
			}
		}

		folders.sort((a, b) => rolePriority[a.role] - rolePriority[b.role]);

		const result = {
			folders,
			user: config.user,
		};
		mailboxCache = {
			timestamp: Date.now(),
			data: result,
		};
		return result;
	});
}

/**
 * Fetches messages for a given folder with pagination and search.
 */
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
				return {
					folder: folderPath,
					page,
					pageSize,
					total: 0,
					messages: [],
				};
			}

			let sequenceRange: string = '';
			let useUidFetch = false;
			let total = mailbox.exists;

			if (searchQuery && searchQuery.trim().length > 0) {
				const query = searchQuery.trim();
				const searchResult = await client.search(
					{
						or: [{ subject: query }, { from: query }, { body: query }],
					},
					{ uid: true }
				);

				if (!searchResult || searchResult.length === 0) {
					return {
						folder: folderPath,
						page: 1,
						pageSize,
						total: 0,
						messages: [],
					};
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
					return {
						folder: folderPath,
						page,
						pageSize,
						total: totalMessages,
						messages: [],
					};
				}

				sequenceRange = `${startSeq}:${endSeq}`;
			}

			const messages: MailMessageSummary[] = [];

			for await (const msg of client.fetch(
				sequenceRange,
				{
					uid: true,
					flags: true,
					envelope: true,
					bodyStructure: true,
				},
				{ uid: useUidFetch }
			)) {
				const env = msg.envelope;
				const fromItem = env?.from?.[0];
				const from: MailParticipant = {
					name: fromItem?.name || fromItem?.address || 'Bilinmiyor',
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
					subject: env?.subject || '(Konu Yok)',
					from,
					to,
					date: env?.date ? new Date(env.date).getTime() : Date.now(),
					seen,
					flagged,
					hasAttachments,
					snippet: env?.subject || '',
				});
			}

			// Sort newest first (by date, tie-break by UID descending)
			messages.sort((a, b) => b.date - a.date || b.uid - a.uid);

			return {
				folder: folderPath,
				page,
				pageSize,
				total,
				messages,
			};
		} finally {
			lock.release();
		}
	});
}

/**
 * Helper to fetch raw message source buffer + flags from a currently locked mailbox.
 */
async function fetchRawMessageInLockedMailbox(
	client: ImapFlow,
	uid: number
): Promise<{ source: Buffer | Readable; flags: string[] } | null> {
	// Primary method: fetchOne with source: true & flags: true (single IMAP command)
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

	// Fallback method: client.download
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

/**
 * Fetches full message detail for a specific UID in a folder.
 */
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

		// If not found in the requested folder (e.g. stale folder transition), try fallback folders
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
			throw new Error('İleti bu klasörde bulunamadı (taşınmış veya silinmiş olabilir).');
		}

		const parsed: ParsedMail = await simpleParser(rawResult.source);

		const fromItem = parsed.from?.value?.[0];
		const from: MailParticipant = {
			name: fromItem?.name || fromItem?.address || 'Bilinmiyor',
			address: fromItem?.address || '',
		};

		const toArray = Array.isArray(parsed.to) ? parsed.to : parsed.to ? [parsed.to] : [];
		const to: MailParticipant[] = toArray.flatMap((entry) =>
			(entry.value || []).map((item) => ({
				name: item.name || item.address || '',
				address: item.address || '',
			}))
		);

		const ccArray = Array.isArray(parsed.cc) ? parsed.cc : parsed.cc ? [parsed.cc] : [];
		const cc: MailParticipant[] = ccArray.flatMap((entry) =>
			(entry.value || []).map((item) => ({
				name: item.name || item.address || '',
				address: item.address || '',
			}))
		);

		const bccArray = Array.isArray(parsed.bcc) ? parsed.bcc : parsed.bcc ? [parsed.bcc] : [];
		const bcc: MailParticipant[] = bccArray.flatMap((entry) =>
			(entry.value || []).map((item) => ({
				name: item.name || item.address || '',
				address: item.address || '',
			}))
		);

		const attachments: MailAttachmentMeta[] = (parsed.attachments || []).map((att) => ({
			filename: att.filename || 'ek-dosya',
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
		const flagged = rawResult.flags.includes('\\Flagged');

		return {
			uid,
			id: `${targetFolder}:${uid}`,
			folder: targetFolder,
			subject: parsed.subject || '(Konu Yok)',
			from,
			to,
			cc,
			bcc,
			date: parsed.date ? new Date(parsed.date).getTime() : Date.now(),
			seen: true,
			flagged,
			hasAttachments: attachments.length > 0,
			attachments,
			snippet,
			html,
			text,
		};
	});
}

/**
 * Performs an action on an email (read, unread, star, unstar, trash, restore, delete).
 */
export async function performMailAction(
	folderPath: string,
	uid: number | number[],
	action: 'read' | 'unread' | 'star' | 'unstar' | 'trash' | 'restore' | 'delete'
): Promise<{ success: boolean; message?: string }> {
	try {
		const uids = Array.isArray(uid) ? uid : [uid];
		if (uids.length === 0) {
			return { success: true };
		}
		return await withImapClient(async (client) => {
			const lock = await client.getMailboxLock(folderPath);
			try {
				const seq = uids.join(',');
				const folderLower = folderPath.toLowerCase();
				const isAlreadyInTrash =
					folderLower.includes('trash') ||
					folderLower.includes('çöp') ||
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

/**
 * Empties a folder (typically Trash), permanently deleting all messages inside.
 */
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
