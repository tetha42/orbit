import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { getSetupStatus, testPostgresConnection } from '@/db';
import { isSetupLocked } from '@/lib/setup';
import { verifySetupTokenGate } from '../setupGuards';
import { getDetectedCandidateUrl } from '../auto-detect/dockerDetect';
import { clientAddress } from '@/lib/http';
import { consumeRateLimit } from '@/lib/rateLimit';
import { inspectRequestPayload } from '@/lib/waf';
import { isIpBanned, recordSecurityStrike } from '@/db/repositories/security.repo';

export const dynamic = 'force-dynamic';

async function handlePOST(request: Request) {
	if (isSetupLocked()) {
		return NextResponse.json({ error: 'Setup is locked and permanently disabled.' }, { status: 403 });
	}
	const ip = clientAddress(request);
	try {
		const ban = await isIpBanned(ip);
		if (ban.banned) {
			return NextResponse.json(
				{ error: 'Your IP address has been blocked by the security policy.' },
				{ status: 403 }
			);
		}
	} catch {
		// Ignore if DB is not reachable for ban check during setup
	}

	const waf = inspectRequestPayload(request);
	if (waf.matched) {
		void recordSecurityStrike({
			ip,
			points: waf.points,
			reason: `WAF: ${waf.signature}`,
			path: '/api/setup/test-db',
		});
		return NextResponse.json(
			{ error: 'Suspicious request blocked by the firewall.' },
			{ status: 403 }
		);
	}

	// 1. Check if setup is already complete
	const setupStatus = await getSetupStatus();
	if (setupStatus.ready) {
		return NextResponse.json({ error: 'Setup is already complete.' }, { status: 403 });
	}

	const rl = consumeRateLimit(`setup:test-db:${ip}`, 10, 60_000);
	if (!rl.allowed) {
		return NextResponse.json(
			{ error: 'Too many connection test attempts. Please wait a minute.' },
			{ status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
		);
	}

	try {
		const rawBody = await request.json().catch(() => {
			/* Fallback to empty payload when request body is malformed */
			return {};
		});
		const body = rawBody && typeof rawBody === 'object' ? (rawBody as Record<string, unknown>) : {};
		const tokenError = await verifySetupTokenGate(request, body, ip, { path: '/api/setup/test-db' });
		if (tokenError) return tokenError;

		let cleanUrl = typeof body.url === 'string' ? body.url.trim() : '';
		if (!cleanUrl && typeof body.candidateId === 'string' && body.candidateId.trim()) {
			cleanUrl = getDetectedCandidateUrl(body.candidateId.trim()) || '';
		}
		if (!cleanUrl && (body.useConfigured || body.type === 'env')) {
			const { CONFIG } = await import('@/server/config');
			cleanUrl = (process.env.DATABASE_URL || CONFIG.database.url || '').trim();
		}

		if (!cleanUrl) {
			return NextResponse.json({ ok: false, error: 'Please enter a valid PostgreSQL connection string.' }, { status: 400 });
		}
		const result = await testPostgresConnection(cleanUrl);
		if (!result.ok) {
			return NextResponse.json({ ok: false, error: result.error || 'Could not establish database connection.' }, { status: 400 });
		}

		return NextResponse.json({
			ok: true,
			alreadyInitialized: result.alreadyInitialized === true,
			databaseName: result.databaseName,
			message: result.alreadyInitialized
				? 'Existing Orbit workspace with an administrator account detected! Redirecting to sign in...'
				: 'PostgreSQL connection verified!',
		});
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return NextResponse.json({ ok: false, error: msg }, { status: 500 });
	}
}

export const POST = withAudit(handlePOST, { action: 'setup.test-db.create', target: 'setup.test-db' });
