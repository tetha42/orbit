import { escapeHtml } from '@/core/text/escape';

/**
 * Input hardening for anything that ends up in an email.
 *
 * Two separate problems are handled here:
 *
 *  1. **Recipient injection.** nodemailer parses `to` as an address list, so a
 *     value containing a comma, semicolon or CRLF becomes *multiple* envelope
 *     recipients (or injects extra headers). `/api/auth/register` is
 *     unauthenticated, so without this check anyone could make the club's SMTP
 *     account send to an arbitrary list.
 *
 *  2. **HTML injection.** Names are interpolated into the notification
 *     templates, so unescaped markup renders in the recipient's mail client.
 */

/** Practical local-part/domain check. Deliberately strict — no spaces, no lists. */
const EMAIL_PATTERN = /^[^\s@,;:<>"'\\[\]]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

/** Header-injection vectors and list separators. */
const UNSAFE_ADDRESS_CHARS = /[\r\n,;]/;

const MAX_EMAIL_LENGTH = 254;
const MAX_NAME_LENGTH = 80;

/**
 * True when `value` is a single, deliverable-looking email address.
 *
 * Rejects multi-recipient lists and header injection, which is the part that
 * matters for safety — deliverability is not this function's concern.
 */
export function isValidEmail(value: unknown): value is string {
	if (typeof value !== 'string') return false;

	const email = value.trim();
	if (!email || email.length > MAX_EMAIL_LENGTH) return false;
	if (UNSAFE_ADDRESS_CHARS.test(email)) return false;

	return EMAIL_PATTERN.test(email);
}

/**
 * Returns the address if it is safe to send to, otherwise `null`.
 * Use this at the point of sending rather than trusting stored values — a row
 * created before validation existed may still hold an unsafe address.
 */
export function safeRecipient(value: unknown): string | null {
	return isValidEmail(value) ? value.trim() : null;
}

// One escaping function for the whole code base (browser, server, mail).
export { escapeHtml };

/**
 * Clamps and escapes a display name for use in an email body.
 * Length is capped so a hostile registration cannot produce an enormous message.
 */
export function safeName(value: unknown): string {
	return escapeHtml(String(value ?? '').slice(0, MAX_NAME_LENGTH));
}

/**
 * Checks whether an email address is intended for testing, simulation, or documentation.
 *
 * Implements RFC 2606 and RFC 6761 reserved test domains (.test, .example, .invalid, .localhost),
 * common dummy testing domains (example.com, example.net, example.org), and automated E2E prefixes
 * (e.g. e2e-, dummy-, stale-, test-, killswitch-).
 *
 * Messages addressed to these destinations MUST NEVER be dispatched through live SMTP gateways
 * (such as Google SMTP) to prevent quota exhaustion and hard-bounce reputation damage.
 */
export function isTestEmailAddress(value: unknown): boolean {
	if (typeof value !== 'string') return false;
	const email = value.trim().toLowerCase();
	const atIndex = email.lastIndexOf('@');
	if (atIndex === -1) return false;

	const localPart = email.slice(0, atIndex);
	const domain = email.slice(atIndex + 1);

	// RFC 2606 / RFC 6761 Reserved Test Domains & TLDs
	if (
		domain === 'test' ||
		domain.endsWith('.test') ||
		domain === 'example' ||
		domain.endsWith('.example') ||
		domain === 'invalid' ||
		domain.endsWith('.invalid') ||
		domain === 'localhost' ||
		domain.endsWith('.localhost') ||
		domain === 'example.com' ||
		domain === 'example.net' ||
		domain === 'example.org'
	) {
		return true;
	}

	// Automated test fixtures and E2E simulation prefixes
	if (
		localPart.startsWith('e2e_') ||
		localPart.startsWith('e2e-') ||
		localPart.startsWith('dummy_') ||
		localPart.startsWith('dummy-') ||
		localPart.startsWith('stale_') ||
		localPart.startsWith('stale-') ||
		localPart.startsWith('killswitch_') ||
		localPart.startsWith('guvenlik-test') ||
		localPart.startsWith('test_') ||
		localPart.startsWith('test-')
	) {
		return true;
	}

	return false;
}

