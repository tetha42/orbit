import { NextResponse } from 'next/server';
import { isSetupLocked, validateSetupToken, getSetupToken, ensureSetupToken } from '@/lib/setup';
import { hasValidSetupSessionCookie, isDevAutoUnlockAllowed } from '@/lib/setupSession';
import { consumeRateLimit } from '@/lib/rateLimit';
import { inspectRequestPayload } from '@/lib/waf';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { isIpBanned, recordSecurityStrike, banIp } from '@/db/repositories/security.repo';
import { DEFAULT_ARCHETYPE, isOrganizationArchetype, type OrganizationArchetype } from '@/lib/archetypes';

export const BRAND_DEFAULTS = {
	studioName: 'tetha42',
	communityName: 'Orbit Community',
	domain: 'orbit.local',
	archetype: DEFAULT_ARCHETYPE,
};

export interface ParsedSetupPayload {
	firstName: string;
	lastName: string;
	email: string;
	password: string;
	dbUrl: string;
	communityName: string;
	studioName: string;
	domain: string;
	archetype: OrganizationArchetype;
	smtpHost: string;
	smtpPort: number;
	smtpUser: string;
	smtpPassword: string;
	smtpFrom: string;
}

const setupFailedAttempts = new Map<string, { count: number; resetAt: number }>();

function recordSetupFailure(ip: string): number {
	const now = Date.now();
	const entry = setupFailedAttempts.get(ip);
	if (!entry || entry.resetAt <= now) {
		setupFailedAttempts.set(ip, { count: 1, resetAt: now + 15 * 60_000 });
		return 1;
	}
	entry.count += 1;
	return entry.count;
}

async function recordInvalidSetupTokenAttempt(ip: string, routePath: string, reason: string): Promise<void> {
	const strikes = recordSetupFailure(ip);
	await recordSecurityStrike({
		ip,
		points: 20,
		reason,
		path: routePath,
	}).catch(() => {
		/* DB may be offline during initial setup */
	});
	if (strikes >= 5) {
		await banIp({
			ip,
			reason: 'Setup token brute-force attempts exceeded threshold (5 failures)',
			threatScore: 100,
		}).catch(() => {
			/* DB may be offline during initial setup */
		});
	}
}

export async function enforceSetupAccessGuards(request: Request, ip: string): Promise<NextResponse | null> {
	try {
		const ban = await isIpBanned(ip);
		if (ban.banned) {
			return NextResponse.json(
				{ error: 'Your IP address has been temporarily quarantined by the cybersecurity policy.' },
				{ status: 403 }
			);
		}
	} catch {
		// Ignore if DB not yet reachable
	}

	if (isSetupLocked()) {
		if (request.headers.has('x-orbit-setup-token')) {
			await recordInvalidSetupTokenAttempt(
				ip,
				new URL(request.url).pathname,
				'Setup token probe after lock'
			);
		}
		return NextResponse.json(
			{ error: 'Setup is locked and permanently disabled.' },
			{ status: 403 }
		);
	}

	const waf = inspectRequestPayload(request);
	if (waf.matched) {
		void logSystemEvent({
			service: 'security',
			level: 'ERROR',
			message: `[WAF] Attack signature blocked (${waf.signature}): POST /api/setup`,
			detail: { category: waf.category, signature: waf.signature },
			ip,
		});
		void recordSecurityStrike({
			ip,
			points: waf.points,
			reason: `WAF: ${waf.signature}`,
			path: '/api/setup',
		});
		return NextResponse.json(
			{ error: 'Suspicious request blocked by Web Application Firewall (WAF).' },
			{ status: 403 }
		);
	}

	const rl = consumeRateLimit(`setup:${ip}`, 10, 15 * 60_000);
	if (!rl.allowed) {
		void logSystemEvent({
			service: 'security',
			level: 'WARN',
			message: 'Setup wizard rate limit exceeded',
			ip,
		});
		return NextResponse.json(
			{ error: 'Too many attempts. Please try again later.' },
			{ status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
		);
	}

	return null;
}

export async function verifySetupTokenGate(
	request: Request,
	body: Record<string, unknown>,
	ip: string,
	options?: { path?: string }
): Promise<NextResponse | null> {
	const diskToken = getSetupToken() || ensureSetupToken({ announce: false });
	if (!diskToken) {
		return null;
	}

	if (isDevAutoUnlockAllowed(request) || hasValidSetupSessionCookie(request, diskToken)) {
		return null;
	}

	const urlObj = new URL(request.url);
	const tokenHeader = request.headers.get('x-orbit-setup-token');
	const tokenQuery = urlObj.searchParams.get('token');
	const tokenBody = typeof body.token === 'string' ? body.token : null;
	const candidateToken = tokenHeader || tokenQuery || tokenBody;

	if (!validateSetupToken(candidateToken)) {
		const routePath = options?.path || '/api/setup';
		await recordInvalidSetupTokenAttempt(ip, routePath, 'Invalid setup token attempt');
		return NextResponse.json(
			{ error: 'Invalid or missing setup token.', code: 'SETUP_TOKEN_REQUIRED' },
			{ status: 403 }
		);
	}

	return null;
}

function asString(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function parseAndValidateSetupPayload(
	body: Record<string, unknown>
): { ok: true; data: ParsedSetupPayload } | { ok: false; response: NextResponse } {
	const admin = asRecord(body.admin);
	const identity = asRecord(body.identity);
	const smtp = asRecord(body.smtp);

	const firstName = (asString(body.firstName) || asString(body.name) || asString(admin.firstName) || asString(admin.name)).trim();
	const lastName = (asString(body.lastName) || asString(body.surname) || asString(admin.lastName) || asString(admin.surname)).trim();
	const email = (asString(body.email) || asString(admin.email)).trim().toLowerCase();
	const password = body.password || admin.password;

	const dbUrl = (asString(body.dbUrl) || asString(body.databaseUrl)).trim();
	const communityName = (asString(body.communityName) || asString(identity.communityName) || 'Orbit Community').trim();
	// The studio is the product maker and is not white-label configurable,
	// not even during first-run setup.
	const studioName = 'tetha42';
	const domain = (asString(body.domain) || asString(identity.domain) || 'orbit.local').trim();
	const rawArchetype = body.archetype ?? identity.archetype ?? body.organizationArchetype;
	const archetype = isOrganizationArchetype(rawArchetype) ? rawArchetype : DEFAULT_ARCHETYPE;

	const smtpHost = (asString(smtp.host) || asString(body.smtpHost)).trim();
	const smtpPort = Number(smtp.port || body.smtpPort || 465);
	const smtpUser = (asString(smtp.user) || asString(body.smtpUser)).trim();
	const smtpPassword = asString(smtp.password) || asString(body.smtpPassword);
	const smtpFrom = (asString(smtp.from) || asString(body.smtpFrom)).trim();

	if (!firstName || !lastName || !email || !password) {
		return {
			ok: false,
			response: NextResponse.json(
				{ error: 'Please complete the administrator first name, last name, email, and password.' },
				{ status: 400 }
			),
		};
	}
	if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
		return {
			ok: false,
			response: NextResponse.json(
				{ error: 'Administrator password must be between 12 and 128 characters.' },
				{ status: 400 }
			),
		};
	}

	return {
		ok: true,
		data: {
			firstName,
			lastName,
			email,
			password,
			dbUrl,
			communityName,
			studioName,
			domain,
			archetype,
			smtpHost,
			smtpPort,
			smtpUser,
			smtpPassword,
			smtpFrom,
		},
	};
}
