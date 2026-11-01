import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { getSetupStatus, reconfigurePgPool, testPostgresConnection } from '@/db';
import { resetSetupCache } from '../route';
import { clientAddress } from '@/lib/http';
import { consumeRateLimit } from '@/lib/rateLimit';
import { inspectRequestPayload } from '@/lib/waf';
import { isIpBanned, recordSecurityStrike } from '@/server/db/domains/security.repo';

export const dynamic = 'force-dynamic';

async function handlePOST(request: Request) {
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

	const rl = consumeRateLimit(`setup:test-db:${ip}`, 10, 60_000);
	if (!rl.allowed) {
		return NextResponse.json(
			{ error: 'Too many connection test attempts. Please wait a minute.' },
			{ status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
		);
	}

	try {
		const body = await request.json().catch(() => ({}));
		const { url } = body;
		if (!url || typeof url !== 'string' || !url.trim()) {
			return NextResponse.json({ ok: false, error: 'Please enter a valid PostgreSQL connection string.' }, { status: 400 });
		}

		const cleanUrl = url.trim();
		const result = await testPostgresConnection(cleanUrl);
		if (!result.ok) {
			return NextResponse.json({ ok: false, error: result.error || 'Could not establish database connection.' }, { status: 400 });
		}

		await reconfigurePgPool(cleanUrl);
		resetSetupCache();
		const status = await getSetupStatus();

		return NextResponse.json({
			ok: true,
			alreadyInitialized: status.hazir === true,
			databaseName: status.dbStatus?.databaseName,
			message: status.hazir
				? 'Existing Orbit workspace with an administrator account detected! Redirecting to sign in...'
				: 'PostgreSQL connection verified!',
		});
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return NextResponse.json({ ok: false, error: msg }, { status: 500 });
	}
}

export const POST = withAudit(handlePOST, { action: 'setup.test-db.create', target: 'setup.test-db' });
