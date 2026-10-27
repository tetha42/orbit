import type { AuthenticatorTransport } from '@simplewebauthn/server';
import type { WebauthnCredential } from '@/db';

/**
 * Relying-party settings for WebAuthn.
 *
 * `rpID` must be the registrable domain the page is served from, and `origin`
 * must match exactly — a passkey registered on one is not usable from the other.
 * Both are derived from the incoming request so local development works without
 * configuration, and can be pinned via environment variables for a deployment
 * behind a proxy (where the request headers may show an internal host).
 *
 * Note for production: passkeys require a secure context. `localhost` is treated
 * as secure by browsers, but any other host must be served over HTTPS.
 */

export const RP_NAME = 'Orbit Community';

export interface WebauthnConfig {
	rpID: string;
	rpName: string;
	origin: string;
}

/** Strips the port and any scheme from a host header. */
function hostnameOf(host: string): string {
	return host.replace(/^https?:\/\//, '').split(':')[0];
}

export function getWebauthnConfig(request: Request): WebauthnConfig {
	if (process.env.WEBAUTHN_RP_ID && process.env.WEBAUTHN_ORIGIN) {
		return {
			rpID: process.env.WEBAUTHN_RP_ID,
			rpName: RP_NAME,
			origin: process.env.WEBAUTHN_ORIGIN,
		};
	}

	// Behind Caddy, `Host` is explicitly set via `header_up Host {host}` whereas
	// `X-Forwarded-Host` is not stripped unless configured. Only read `Host` (and
	// strip any control/whitespace characters) so a client cannot spoof rpID/origin.
	const rawHost = (request.headers.get('host') || 'localhost').replace(/[\r\n\s/\\]+/g, '');
	const host = /^[a-zA-Z0-9.-]+(?::\d{1,5})?$/.test(rawHost) ? rawHost : 'localhost';
	const rawProto = request.headers.get('x-forwarded-proto');
	const proto = rawProto === 'http' || rawProto === 'https'
		? rawProto
		: hostnameOf(host) === 'localhost' ? 'http' : 'https';

	return {
		rpID: process.env.WEBAUTHN_RP_ID || hostnameOf(host),
		rpName: RP_NAME,
		origin: process.env.WEBAUTHN_ORIGIN || `${proto}://${host}`,
	};
}

/**
 * Parses the comma-separated transport hints stored on a credential row.
 *
 * Unknown values are dropped rather than passed through: the field is populated
 * from whatever the authenticator reported, and the library only accepts a
 * fixed vocabulary.
 */
export function parseTransports(stored: string | null | undefined): AuthenticatorTransport[] | undefined {
	if (!stored) return undefined;

	const known: readonly string[] = ['usb', 'nfc', 'ble', 'internal', 'hybrid', 'smart-card'];
	const parsed = stored.split(',').filter((t): t is AuthenticatorTransport =>
		known.includes(t as AuthenticatorTransport)
	);

	return parsed.length > 0 ? parsed : undefined;
}

/** Converts a stored row into the shape @simplewebauthn/server expects. */
export function toAuthenticatorDevice(row: WebauthnCredential) {
	return {
		id: row.id,
		publicKey: Buffer.from(row.publicKey, 'base64url'),
		counter: Number(row.counter) || 0,
		transports: parseTransports(row.transports),
	};
}

/** Random, URL-safe identifier used to look a pending challenge back up. */
export function newChallengeId(): string {
	return crypto.randomUUID();
}
