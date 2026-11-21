import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { verifyAuth } from '@/lib/auth/authGuard';
import { consumeWebauthnChallenge, getWebauthnCredentialById, saveWebauthnCredential } from '@/db';
import { getWebauthnConfig } from '@/lib/auth/webauthn';
import { consumeRateLimit } from '@/lib/rateLimit';

/**
 * Second step of adding a passkey: verifies the authenticator's attestation and
 * stores the credential.
 *
 * The challenge is consumed (deleted) before verification, so a replay of the
 * same response cannot succeed even if two requests race — the second DELETE
 * finds nothing and is rejected.
 */
async function handlePOST(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;

	const limit = consumeRateLimit(`passkey:reg:verify:${auth.user.id}`, 10, 15 * 60_000);
	if (!limit.allowed) {
		return NextResponse.json(
			{ error: 'Too many passkey verification attempts. Please try again later.' },
			{ status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
		);
	}

	try {
		const { user } = auth;
		const body = await request.json().catch(() => ({}));
		const { challengeId, response, nickname } = body;

		if (!challengeId || !response) {
			return NextResponse.json({ error: 'Missing required parameters.' }, { status: 400 });
		}

		const pending = await consumeWebauthnChallenge(String(challengeId), 'registration');
		if (!pending || pending.userId !== user.id) {
			return NextResponse.json(
				{ error: 'Verification session is invalid or has expired. Please try again.' },
				{ status: 400 }
			);
		}

		const { rpID, origin } = getWebauthnConfig(request);

		const verification = await verifyRegistrationResponse({
			response,
			expectedChallenge: pending.challenge,
			expectedOrigin: origin,
			expectedRPID: rpID,
			requireUserVerification: true,
		});

		if (!verification.verified || !verification.registrationInfo) {
			return NextResponse.json({ error: 'Passkey verification failed.' }, { status: 400 });
		}

		const { credential, credentialDeviceType, credentialBackedUp } =
			verification.registrationInfo;

		// Guard against a credential id that somehow already exists (another account
		// registered the same authenticator, or a retried request).
		const clash = await getWebauthnCredentialById(credential.id);
		if (clash) {
			return NextResponse.json(
				{ error: 'This passkey is already registered.' },
				{ status: 409 }
			);
		}

		await saveWebauthnCredential({
			id: credential.id,
			userId: user.id,
			publicKey: Buffer.from(credential.publicKey).toString('base64url'),
			counter: credential.counter,
			transports: credential.transports?.join(',') ?? null,
			deviceType: credentialDeviceType,
			backedUp: credentialBackedUp,
			nickname: typeof nickname === 'string' && nickname.trim() ? nickname.trim().slice(0, 60) : null,
		});

		return NextResponse.json({ success: true, message: 'Passkey added.' });
	} catch (error) {
		console.error('API /api/auth/passkey/register/verify error:', error);
		return NextResponse.json({ error: 'Failed to save passkey.' }, { status: 500 });
	}
}

export const POST = withAudit(handlePOST, { action: 'auth.passkey.register.verify.create', target: 'auth.passkey.register.verify' });
