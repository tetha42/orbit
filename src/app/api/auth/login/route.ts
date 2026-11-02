import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserByEmail, updateUserPassword } from '@/db';
import { attachSessionCookie, establishSession, sessionUserOf } from '@/lib/auth/session';
import { createLoginChallenge } from '@/lib/auth/authToken';
import { clearRateLimit, consumeRateLimit, isRateLimited, recordFailure } from '@/lib/rateLimit';
import { clientAddress } from '@/lib/http';
import { inspectRequestPayload } from '@/lib/waf';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { ADMIN_ROLE_ID } from '@/core/permissions';
import { getEmergencyKillSwitches, getLockdownState, isIpBanned, recordSecurityStrike } from '@/db/repositories/security.repo';

const MAX_ACCOUNT_ATTEMPTS = 5;
const MAX_IP_ATTEMPTS = 50;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const BURST_WINDOW_MS = 60 * 1000;
const MAX_IP_BURST_PER_MIN = 30;
const MAX_ACCOUNT_BURST_PER_MIN = 10;

const DUMMY_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

export async function POST(request: Request) {
	try {
		const ip = clientAddress(request);
		const ban = await isIpBanned(ip);
		if (ban.banned) {
			return NextResponse.json(
				{ error: 'Your IP address has been temporarily quarantined due to security policy.' },
				{ status: 403 }
			);
		}

		const emergency = await getEmergencyKillSwitches();
		if (emergency.passkeyOnly) {
			return NextResponse.json(
				{ error: 'Password authentication is disabled under emergency security protocol (Kill-Switch). Please sign in using your Passkey.' },
				{ status: 403 }
			);
		}

		const waf = inspectRequestPayload(request);
		if (waf.matched) {
			void logSystemEvent({
				servis: 'security',
				seviye: 'ERROR',
				mesaj: `[WAF] Attack signature blocked (${waf.signature}): POST /api/auth/login`,
				detay: { category: waf.category, signature: waf.signature },
				ip,
			});
			void recordSecurityStrike({
				ip,
				points: waf.points,
				reason: `WAF: ${waf.signature}`,
				path: '/api/auth/login',
			});
			return NextResponse.json(
				{ error: 'Suspicious request blocked by the Web Application Firewall (WAF).' },
				{ status: 403 }
			);
		}

		const lockdown = await getLockdownState();
		const burstLimit = lockdown.active ? Math.max(5, Math.floor(MAX_IP_BURST_PER_MIN / 3)) : MAX_IP_BURST_PER_MIN;
		const ipBurst = consumeRateLimit(`login:burst:ip:${ip}`, burstLimit, BURST_WINDOW_MS);
		if (!ipBurst.allowed) {
			void recordSecurityStrike({
				ip,
				points: 25,
				reason: 'Login endpoint rate burst exceeded',
				path: '/api/auth/login',
			});
			return NextResponse.json(
				{ error: 'Too many sign-in requests. Please wait a moment.' },
				{ status: 429, headers: { 'Retry-After': String(ipBurst.retryAfter) } }
			);
		}

		const body = await request.json().catch(() => null);
		if (!body || typeof body !== 'object') {
			return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
		}
		const email = (body as Record<string, unknown>).email ?? (body as Record<string, unknown>).eposta;
		const password = (body as Record<string, unknown>).password ?? (body as Record<string, unknown>).sifre;

		if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
			return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
		}

		const normalizedEmail = email.trim().slice(0, 254).toLowerCase();
		const accountKey = `login:account:${normalizedEmail}`;
		const ipKey = `login:ip:${ip}`;

		const accountBurst = consumeRateLimit(
			`login:burst:acct:${normalizedEmail}`,
			lockdown.active ? 4 : MAX_ACCOUNT_BURST_PER_MIN,
			BURST_WINDOW_MS
		);
		if (!accountBurst.allowed) {
			return NextResponse.json(
				{ error: 'Too many sign-in attempts for this account. Please wait 1 minute.' },
				{ status: 429, headers: { 'Retry-After': String(accountBurst.retryAfter) } }
			);
		}

		const gates: Array<[string, number]> = [
			[accountKey, lockdown.active ? 3 : MAX_ACCOUNT_ATTEMPTS],
			[ipKey, lockdown.active ? 15 : MAX_IP_ATTEMPTS],
		];
		for (const [key, limit] of gates) {
			const gate = isRateLimited(key, limit);
			if (!gate.allowed) {
				await logSystemEvent({
					servis: 'auth',
					seviye: 'WARN',
					mesaj: `Login rate limit exceeded (${normalizedEmail})`,
					detay: { email: normalizedEmail, kilitAnahtari: key, kalanSaniye: gate.retryAfter },
					ip,
				});
				void recordSecurityStrike({
					ip,
					points: 30,
					reason: `Brute-force lockout exceeded (${normalizedEmail})`,
					path: '/api/auth/login',
				});
				return NextResponse.json(
					{
						error: `Too many failed sign-in attempts. Please try again in ${Math.ceil(gate.retryAfter / 60)} minute(s).`,
					},
					{ status: 429, headers: { 'Retry-After': String(gate.retryAfter) } }
				);
			}
		}

		const fail = (reason: string) => {
			recordFailure(accountKey, ATTEMPT_WINDOW_MS);
			recordFailure(ipKey, ATTEMPT_WINDOW_MS);
			void recordSecurityStrike({
				ip,
				points: 15,
				reason,
				path: '/api/auth/login',
			});
		};

		if (email.length > 254 || password.length > 128) {
			fail('Oversized login credentials');
			return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
		}

		const user = await getUserByEmail(normalizedEmail);
		const INVALID_CREDENTIALS = 'Invalid email or password.';

		if (!user) {
			await bcrypt.compare(password, DUMMY_HASH);
			fail(`Unregistered account login attempt (${normalizedEmail})`);
			await logSystemEvent({
				servis: 'auth',
				seviye: 'WARN',
				mesaj: `Failed login attempt (unregistered email): ${normalizedEmail}`,
				detay: { email: normalizedEmail },
				ip,
			});
			return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
		}

		let isValidPassword = false;
		if (user.passwordHash.startsWith('$2a$') || user.passwordHash.startsWith('$2b$')) {
			isValidPassword = await bcrypt.compare(password, user.passwordHash);
		} else {
			isValidPassword = user.passwordHash === password;
			if (isValidPassword) {
				const upgradedHash = await bcrypt.hash(password, 10);
				await updateUserPassword(user.id, upgradedHash);
			}
		}

		if (!isValidPassword) {
			fail(`Invalid password (${user.email})`);
			await logSystemEvent({
				servis: 'auth',
				seviye: 'WARN',
				mesaj: `Failed login attempt (invalid password): ${user.email}`,
				detay: { email: user.email },
				userId: user.id,
				ip,
			});
			return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
		}

		if (user.status === 'beklemede') {
			return NextResponse.json(
				{
					error: 'Your membership application is awaiting administrator approval.',
					status: 'beklemede',
				},
				{ status: 403 }
			);
		}

		if (user.status === 'reddedildi') {
			return NextResponse.json(
				{
					error: 'Your membership application was not approved by community administration.',
					status: 'reddedildi',
				},
				{ status: 403 }
			);
		}

		if (lockdown.active && user.roleId !== ADMIN_ROLE_ID) {
			return NextResponse.json(
				{
					error: 'The system is currently in Shield Mode (Defcon Lockdown). Only administrators can sign in.',
					code: 'LOCKDOWN_ACTIVE',
				},
				{ status: 503 }
			);
		}

		clearRateLimit(accountKey);

		if (Number(user.totpEnabled) === 1) {
			return NextResponse.json({
				success: false,
				require2fa: true,
				challengeToken: await createLoginChallenge(user.id),
			});
		}

		const sessionToken = await establishSession(user, request, 'password');

		await logSystemEvent({
			servis: 'auth',
			seviye: 'INFO',
			mesaj: `User signed in: ${user.ad} ${user.soyad} (${user.email})`,
			userId: user.id,
			ip,
		});

		const response = NextResponse.json({
			success: true,
			user: await sessionUserOf(user),
		});

		return attachSessionCookie(response, sessionToken);
	} catch (error) {
		console.error('API error:', error);
		return NextResponse.json({ error: 'Request could not be completed.' }, { status: 500 });
	}
}
