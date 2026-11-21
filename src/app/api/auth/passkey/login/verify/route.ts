import { NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import {
	consumeWebauthnChallenge,
	getUserById,
	getWebauthnCredentialById,
	updateWebauthnCounter,
} from '@/db';
import { getWebauthnConfig, toAuthenticatorDevice } from '@/lib/auth/webauthn';
import { attachSessionCookie, establishSession, sessionUserOf } from '@/lib/auth/session';
import { consumeRateLimit } from '@/lib/rateLimit';
import { clientAddress } from '@/lib/http';
import { inspectRequestPayload } from '@/lib/waf';
import { ADMIN_ROLE_ID } from '@/core/permissions';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { getLockdownState, isIpBanned, recordSecurityStrike } from '@/db/repositories/security.repo';

/**
 * Second step of a passkey sign-in: verifies the assertion and issues a session.
 *
 * A passkey assertion is already multi-factor (the device plus its biometric/PIN
 * unlock), so it completes authentication directly without a secondary TOTP
 * challenge and marks the session with `authMethod = 'passkey'`.
 */
export async function POST(request: Request) {
	const ip = clientAddress(request);
	const ban = await isIpBanned(ip);
	if (ban.banned) {
		return NextResponse.json(
			{ error: 'Your IP address has been temporarily quarantined due to security policy.' },
			{ status: 403 }
		);
	}

	const waf = inspectRequestPayload(request);
	if (waf.matched) {
		void logSystemEvent({
			service: 'security',
			level: 'ERROR',
			message: `[WAF] Attack signature blocked (${waf.signature}): POST /api/auth/passkey/login/verify`,
			detail: { category: waf.category, signature: waf.signature },
			ip,
		});
		void recordSecurityStrike({
			ip,
			points: waf.points,
			reason: `WAF: ${waf.signature}`,
			path: '/api/auth/passkey/login/verify',
		});
		return NextResponse.json(
			{ error: 'Suspicious request blocked by the Web Application Firewall (WAF).' },
			{ status: 403 }
		);
	}

	const limit = consumeRateLimit(`passkey:verify:ip:${ip}`, 20, 60_000);
	if (!limit.allowed) {
		void recordSecurityStrike({
			ip,
			points: 25,
			reason: 'Passkey verification rate limit exceeded',
			path: '/api/auth/passkey/login/verify',
		});
		return NextResponse.json(
			{ error: 'Too many requests. Please wait a moment.' },
			{ status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
		);
	}

	try {
		const body = await request.json().catch(() => ({}));
		const { challengeId, response } = body;

		if (!challengeId || !response) {
			return NextResponse.json({ error: 'Missing required parameters.' }, { status: 400 });
		}

		// Consumed before verification so a replayed response cannot be reused.
		const pending = await consumeWebauthnChallenge(String(challengeId), 'login');
		if (!pending || !pending.userId) {
			return NextResponse.json(
				{ error: 'Verification session is invalid or has expired. Please try again.' },
				{ status: 400 }
			);
		}

		const user = await getUserById(pending.userId);
		if (!user || user.status !== 'active') {
			return NextResponse.json({ error: 'Your account is not active.' }, { status: 403 });
		}

		const credentialRow = await getWebauthnCredentialById(String(response.id));
		// The credential must belong to the account the challenge was issued for.
		if (!credentialRow || credentialRow.userId !== user.id) {
			void recordSecurityStrike({
				ip,
				points: 25,
				reason: `Passkey attempt for a different account (${user.email})`,
				path: '/api/auth/passkey/login/verify',
				userId: user.id,
			});
			await logSystemEvent({
				service: 'auth',
				level: 'WARN',
				message: `Passkey verification error (key belongs to another account): ${user.email}`,
				userId: user.id,
				ip,
			});
			return NextResponse.json({ error: 'This passkey does not belong to this account.' }, { status: 401 });
		}

		const { rpID, origin } = getWebauthnConfig(request);

		const verification = await verifyAuthenticationResponse({
			response,
			expectedChallenge: pending.challenge,
			expectedOrigin: origin,
			expectedRPID: rpID,
			credential: toAuthenticatorDevice(credentialRow),
			requireUserVerification: true,
		});

		if (!verification.verified) {
			void recordSecurityStrike({
				ip,
				points: 20,
				reason: `Failed passkey signature verification (${user.email})`,
				path: '/api/auth/passkey/login/verify',
				userId: user.id,
			});
			await logSystemEvent({
				service: 'auth',
				level: 'WARN',
				message: `Failed passkey signature verification: ${user.email}`,
				userId: user.id,
				ip,
			});
			return NextResponse.json({ error: 'Passkey verification failed.' }, { status: 401 });
		}

		const { newCounter } = verification.authenticationInfo;

		// A counter that does not advance is the standard signal that the
		// authenticator has been cloned. Zero means the device does not implement
		// counters at all, which is allowed.
		const storedCounter = Number(credentialRow.counter) || 0;
		if (newCounter !== 0 && newCounter <= storedCounter) {
			console.error(
				`⚠️ Passkey counter did not advance (stored=${storedCounter}, received=${newCounter}) for credential ${credentialRow.id}`
			);
			void recordSecurityStrike({
				ip,
				points: 50,
				reason: `Suspected passkey cloning (${user.email})`,
				path: '/api/auth/passkey/login/verify',
				userId: user.id,
			});
			await logSystemEvent({
				service: 'auth',
				level: 'ERROR',
				message: `Suspected passkey cloning (counter did not advance): ${user.email}`,
				detail: { credentialId: credentialRow.id, storedCounter, newCounter },
				userId: user.id,
				ip,
			});
			return NextResponse.json(
				{ error: 'Passkey could not be verified. Contact an administrator for security review.' },
				{ status: 401 }
			);
		}

		if (newCounter !== 0) {
			await updateWebauthnCounter(credentialRow.id, newCounter);
		}

		const lockdown = await getLockdownState();
		if (lockdown.active && user.roleId !== ADMIN_ROLE_ID) {
			return NextResponse.json(
				{
					error: 'Workspace is currently in Lockdown Mode under active cyber defense. Only administrators may sign in.',
					code: 'LOCKDOWN_ACTIVE',
				},
				{ status: 503 }
			);
		}

		// A verified WebAuthn passkey is itself cryptographic multi-factor authentication;
		// issue the passkey session directly without prompting for a secondary TOTP code.
		const sessionToken = await establishSession(user, request, 'passkey');
		await logSystemEvent({
			service: 'auth',
			level: 'INFO',
			message: `User signed in with passkey: ${user.name} ${user.surname} (${user.email})`,
			userId: user.id,
			ip,
		});
		const res = NextResponse.json({ success: true, user: await sessionUserOf(user) });
		return attachSessionCookie(res, sessionToken);
	} catch (error) {
		console.error('API /api/auth/passkey/login/verify error:', error);
		return NextResponse.json({ error: 'Failed to sign in with passkey.' }, { status: 500 });
	}
}
