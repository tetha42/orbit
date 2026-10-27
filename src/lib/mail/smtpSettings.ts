import { getSystemSettings } from '@/db';
import { decryptSecret, encryptSecret } from '../auth/secretBox';

/**
 * Single source of truth for the SMTP configuration: key names, defaults, the
 * mask sentinel, and the coercion between stored strings and typed values.
 *
 * The panel, the settings route and the mailer all read through here so a change
 * to a key name or default cannot drift between them.
 */

export const SMTP_KEYS = {
	host: 'smtp_host',
	port: 'smtp_port',
	secure: 'smtp_secure',
	user: 'smtp_user',
	pass: 'smtp_pass',
	from: 'smtp_from',
} as const;

export const IMAP_KEYS = {
	host: 'imap_host',
	port: 'imap_port',
	secure: 'imap_secure',
} as const;

export const IMAP_DEFAULTS = {
	host: 'imap.gmail.com',
	port: 993,
	secure: true,
} as const;

export interface ImapConfig {
	host: string;
	port: number;
	secure: boolean;
	user: string;
	pass: string;
}

/**
 * Placeholder the API returns instead of the stored password.
 * Kept in one place: the panel used to compare against a hard-coded literal in
 * several files, and any mismatch silently overwrote the real credential.
 */
export const PASSWORD_MASK = '••••••••••••••••';

export const SMTP_DEFAULTS = {
	// No provider is assumed: a fresh installation has no server until one is entered.
	host: '',
	port: 465,
	secure: true,
	user: '',
	// No club-specific sender: the mailer falls back to SMTP_FROM, then to the account itself.
	from: '',
} as const;

export interface SmtpConfig {
	host: string;
	port: number;
	secure: boolean;
	user: string;
	/** Decrypted app password, or null when none is stored. */
	pass: string | null;
	from: string;
}

/**
 * Normalises the `secure` flag.
 *
 * The old code did `String(Boolean(value))`, so the string `"false"` persisted as
 * `'true'`. Accept real booleans, the strings `'true'`/`'false'`, and fall back
 * to whether the port implies implicit TLS.
 */
export function coerceSecure(value: unknown, port: number): boolean {
	if (typeof value === 'boolean') return value;
	if (value === 'true') return true;
	if (value === 'false') return false;
	if (value === undefined || value === null || value === '') return port === 465 || port === 993;
	return Boolean(value);
}

export function coercePort(value: unknown, fallback: number = SMTP_DEFAULTS.port): number {
	const port = Number(value);
	return Number.isInteger(port) && port > 0 && port <= 65535 ? port : fallback;
}

/** Reads the stored configuration, decrypting the credential. */
export async function readSmtpConfig(): Promise<SmtpConfig> {
	const settings = await getSystemSettings();
	const port = coercePort(settings[SMTP_KEYS.port]);

	return {
		host: settings[SMTP_KEYS.host] || SMTP_DEFAULTS.host,
		port,
		secure: coerceSecure(settings[SMTP_KEYS.secure], port),
		user: settings[SMTP_KEYS.user] || SMTP_DEFAULTS.user,
		pass: await decryptSecret(settings[SMTP_KEYS.pass]),
		from: settings[SMTP_KEYS.from] || SMTP_DEFAULTS.from,
	};
}

/**
 * What the mailer actually uses: stored values first, then the deployment's env vars,
 * so mail can be configured without the panel.
 */
export async function readMailAccount(): Promise<SmtpConfig & { pass: string }> {
	const config = await readSmtpConfig();
	const user = config.user || process.env.SMTP_USER || '';
	return {
		host: config.host || process.env.SMTP_HOST || '',
		port: config.port || Number(process.env.SMTP_PORT) || SMTP_DEFAULTS.port,
		secure: config.secure,
		user,
		// Google app passwords are shown in groups of four; the spaces are not part of it.
		pass: (config.pass || process.env.SMTP_PASS || '').replace(/\s+/g, ''),
		from: config.from || process.env.SMTP_FROM || user,
	};
}

/**
  * Reads the IMAP configuration for incoming mail. Reuses the credentials
  * from the SMTP account and resolves the IMAP host and port.
  */
export async function readImapAccount(): Promise<ImapConfig> {
	const mailAccount = await readMailAccount();
	const settings = await getSystemSettings();

	let defaultImapHost: string = IMAP_DEFAULTS.host;
	if (mailAccount.host && mailAccount.host.toLowerCase() !== 'smtp.gmail.com') {
		defaultImapHost = mailAccount.host.replace(/^smtp\./i, 'imap.');
	}

	const host = settings[IMAP_KEYS.host] || process.env.IMAP_HOST || (mailAccount.host ? defaultImapHost : IMAP_DEFAULTS.host);
	const port = coercePort(settings[IMAP_KEYS.port] || process.env.IMAP_PORT, IMAP_DEFAULTS.port);
	const secure = coerceSecure(settings[IMAP_KEYS.secure] ?? process.env.IMAP_SECURE, port);

	return {
		host,
		port,
		secure,
		user: mailAccount.user,
		pass: mailAccount.pass,
	};
}

/** Builds the key/value rows to persist, encrypting the password when supplied. */
export async function buildSmtpUpdates(input: {
	host?: unknown;
	port?: unknown;
	secure?: unknown;
	user?: unknown;
	from?: unknown;
	/** Omit to leave the stored password untouched; `null` clears it. */
	pass?: string | null;
}): Promise<Record<string, string>> {
	const port = coercePort(input.port);

	const updates: Record<string, string> = {
		[SMTP_KEYS.host]: String(input.host || SMTP_DEFAULTS.host),
		[SMTP_KEYS.port]: String(port),
		[SMTP_KEYS.secure]: String(coerceSecure(input.secure, port)),
		[SMTP_KEYS.user]: String(input.user ?? ''),
		[SMTP_KEYS.from]: String(input.from || SMTP_DEFAULTS.from),
	};

	if (typeof input.pass === 'string' && input.pass.length > 0) {
		updates[SMTP_KEYS.pass] = await encryptSecret(input.pass);
	} else if (input.pass === null) {
		// Explicit clear — previously impossible, so a saved password could never be removed.
		updates[SMTP_KEYS.pass] = '';
	}

	return updates;
}

/**
 * True when the submission is the mask the panel shows rather than a real change.
 * Callers should treat this the same as an omitted password.
 */
export function isUnchangedPassword(value: unknown): boolean {
	return typeof value === 'string' && value.trim() === PASSWORD_MASK;
}
