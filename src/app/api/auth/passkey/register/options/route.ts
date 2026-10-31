import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { verifyAuth } from '@/lib/auth/authGuard';
import { createWebauthnChallenge, getWebauthnCredentials } from '@/db';
import { getWebauthnConfig, newChallengeId, parseTransports } from '@/lib/auth/webauthn';
import { consumeRateLimit } from '@/lib/rateLimit';

/**
 * First step of adding a passkey: returns the creation options for the browser.
 *
 * The challenge is stored server-side keyed by a random id that travels in the
 * response, so the follow-up verification can prove the credential was created
 * for *this* ceremony rather than a replayed one.
 */
async function handlePOST(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;

	const limit = consumeRateLimit(`passkey:reg:options:${auth.user.id}`, 10, 15 * 60_000);
	if (!limit.allowed) {
		return NextResponse.json(
			{ error: 'Çok fazla Passkey kayıt denemesi. Lütfen daha sonra tekrar deneyin.' },
			{ status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
		);
	}

	try {
		const { user } = auth;
		const { rpID, rpName } = getWebauthnConfig(request);

		// Authenticators already on the account, so the same device cannot be
		// enrolled twice and the UI can nudge towards a second device.
		const existing = await getWebauthnCredentials(user.id);

		const options = await generateRegistrationOptions({
			rpID,
			rpName,
			userName: user.email,
			userDisplayName: `${user.ad} ${user.soyad}`,
			userID: new TextEncoder().encode(user.id),
			attestationType: 'none',
			timeout: 120_000,
			// Browser password managers (Proton Pass, iCloud Keychain, Google) use
			// discoverable credentials, so prefer a resident key and ask for the
			// credential-properties extension when the authenticator supports it.
			extensions: { credProps: true },
			excludeCredentials: existing.map((c) => ({
				id: c.id,
				transports: parseTransports(c.transports),
			})),
			authenticatorSelection: {
				// A passkey is a second factor here, so the authenticator itself does
				// not need to verify the user — the session already did.
				residentKey: 'preferred',
				userVerification: 'preferred',
			},
		});

		const challengeId = newChallengeId();
		await createWebauthnChallenge({
			id: challengeId,
			userId: user.id,
			challenge: options.challenge,
			tur: 'registration',
		});

		return NextResponse.json({ success: true, challengeId, options });
	} catch (error) {
		console.error('API /api/auth/passkey/register/options error:', error);
		return NextResponse.json({ error: 'Passkey kaydı başlatılamadı.' }, { status: 500 });
	}
}

export const POST = withAudit(handlePOST, { action: 'auth.passkey.register.options.create', target: 'auth.passkey.register.options' });
