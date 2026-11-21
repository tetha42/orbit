import { ImapFlow } from 'imapflow';
import { readImapAccount, type ImapConfig } from '../smtpSettings';
import { errorMessage } from '@/lib/errors';
import type { MailFolderInfo } from './types';

const IDLE_TIMEOUT_MS = 90_000;
const MAILBOX_CACHE_TTL_MS = 15_000;

let sharedClient: ImapFlow | null = null;
let sharedConfig: ImapConfig | null = null;
let connectPromise: Promise<{ client: ImapFlow; config: ImapConfig }> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let operationQueue: Promise<unknown> = Promise.resolve();

let mailboxCache: {
	timestamp: number;
	data: { folders: MailFolderInfo[]; user: string };
} | null = null;

export function invalidateMailboxCache(): void {
	mailboxCache = null;
}

export function getCachedMailboxes(): { folders: MailFolderInfo[]; user: string } | null {
	if (mailboxCache && Date.now() - mailboxCache.timestamp < MAILBOX_CACHE_TTL_MS) {
		return mailboxCache.data;
	}
	return null;
}

export function setCachedMailboxes(data: { folders: MailFolderInfo[]; user: string }): void {
	mailboxCache = { timestamp: Date.now(), data };
}

function resetIdleTimer(): void {
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

function discardSharedClient(): void {
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

/** Creates a fresh ImapFlow client configured with current credentials. */
export async function createImapClient(): Promise<{ client: ImapFlow; config: ImapConfig }> {
	const config = await readImapAccount();
	if (!config.user || !config.pass) {
		throw new Error('Email account is not configured or app password is missing.');
	}

	const client = new ImapFlow({
		host: config.host,
		port: config.port,
		secure: config.secure,
		auth: { user: config.user, pass: config.pass },
		logger: false,
		tls: { rejectUnauthorized: false },
		connectionTimeout: 15_000,
		greetingTimeout: 15_000,
		socketTimeout: 30_000,
	});

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

	if (connectPromise) return connectPromise;

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
export async function withImapClient<T>(
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
