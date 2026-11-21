import crypto from 'node:crypto';

const RECORD_SIZE = 4096;

export function b64UrlEncode(buf: Buffer): string {
	return buf.toString('base64url');
}

export function b64UrlDecode(value: string): Buffer {
	const normalized = value.trim().replace(/-/g, '+').replace(/_/g, '/');
	const padLen = (4 - (normalized.length % 4)) % 4;
	return Buffer.from(normalized + '='.repeat(padLen), 'base64');
}

function validateUncompressedP256Point(buf: Buffer, label: string): void {
	if (buf.length !== 65 || buf[0] !== 0x04) {
		throw new Error(`Invalid ${label}: expected 65-byte uncompressed P-256 point.`);
	}
}

export function buildVapidAuthorizationHeader(
	endpoint: string,
	subject: string,
	publicKeyB64Url: string,
	privateKeyB64Url: string,
	nowSec: number = Math.floor(Date.now() / 1000)
): string {
	const url = new URL(endpoint);
	const pubBuf = b64UrlDecode(publicKeyB64Url);
	validateUncompressedP256Point(pubBuf, 'VAPID public key');

	const privBuf = b64UrlDecode(privateKeyB64Url);
	if (privBuf.length !== 32) {
		throw new Error('Invalid VAPID private key: expected 32-byte P-256 scalar.');
	}

	const headerB64 = b64UrlEncode(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' }), 'utf8'));
	const payloadB64 = b64UrlEncode(
		Buffer.from(
			JSON.stringify({
				aud: url.origin,
				exp: nowSec + 12 * 3600,
				sub: subject.trim() || 'mailto:security@orbit.local',
			}),
			'utf8'
		)
	);
	const signingInput = `${headerB64}.${payloadB64}`;

	const privateKey = crypto.createPrivateKey({
		format: 'jwk',
		key: {
			kty: 'EC',
			crv: 'P-256',
			d: b64UrlEncode(privBuf),
			x: b64UrlEncode(pubBuf.subarray(1, 33)),
			y: b64UrlEncode(pubBuf.subarray(33, 65)),
		},
	});

	const signature = crypto.sign('sha256', Buffer.from(signingInput, 'utf8'), {
		key: privateKey,
		dsaEncoding: 'ieee-p1363',
	});

	return `vapid t=${signingInput}.${b64UrlEncode(signature)}, k=${b64UrlEncode(pubBuf)}`;
}

/**
 * Encrypts a Web Push payload per RFC 8291 (`aes128gcm` content coding).
 */
export function encryptWebPushPayload(
	payload: string | Buffer,
	clientPublicKeyB64Url: string,
	authSecretB64Url: string
): Buffer {
	const uaPublic = b64UrlDecode(clientPublicKeyB64Url);
	validateUncompressedP256Point(uaPublic, 'client p256dh key');

	const authSecret = b64UrlDecode(authSecretB64Url);
	if (authSecret.length !== 16) {
		throw new Error('Invalid client auth secret: expected 16 bytes.');
	}

	const salt = crypto.randomBytes(16);
	const ecdh = crypto.createECDH('prime256v1');
	ecdh.generateKeys();
	const asPublic = ecdh.getPublicKey();
	const ecdhSecret = ecdh.computeSecret(uaPublic);

	const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0', 'utf8'), uaPublic, asPublic]);
	const ikm = Buffer.from(crypto.hkdfSync('sha256', ecdhSecret, authSecret, keyInfo, 32));

	const cek = Buffer.from(
		crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), 16)
	);
	const nonce = Buffer.from(
		crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0', 'utf8'), 12)
	);

	const payloadBuf = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : payload;
	if (payloadBuf.length > RECORD_SIZE - 17) {
		throw new Error('Web Push payload exceeds single aes128gcm record limit.');
	}

	const paddedPlaintext = Buffer.concat([payloadBuf, Buffer.from([0x02])]);
	const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
	const encrypted = Buffer.concat([cipher.update(paddedPlaintext), cipher.final()]);
	const authTag = cipher.getAuthTag();

	const header = Buffer.alloc(16 + 4 + 1 + asPublic.length);
	salt.copy(header, 0);
	header.writeUInt32BE(RECORD_SIZE, 16);
	header.writeUInt8(asPublic.length, 20);
	asPublic.copy(header, 21);

	return Buffer.concat([header, encrypted, authTag]);
}
