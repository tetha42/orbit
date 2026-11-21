import { NextResponse } from 'next/server';
import { withAudit } from '@/lib/audit/withAudit';
import { clientAddress } from '@/lib/http';
import { consumeRateLimit } from '@/lib/rateLimit';
import { ensureSetupToken, getSetupToken, isSetupLocked } from '@/lib/setup';
import {
	attachSetupSessionCookie,
	hasValidSetupSessionCookie,
	isDevAutoUnlockAllowed,
} from '@/lib/setupSession';
import { enforceSetupAccessGuards, verifySetupTokenGate } from '../setupGuards';

export const dynamic = 'force-dynamic';

/**
 * `GET /api/setup/unlock` — inspects whether first-run setup requires a token
 * and whether the current browser session is already unlocked.
 */
export async function GET(request: Request) {
	if (isSetupLocked()) {
		return NextResponse.json(
			{ error: 'Setup is locked and permanently disabled.' },
			{ status: 403, headers: { 'Cache-Control': 'no-store' } }
		);
	}

	const ip = clientAddress(request);
	const rl = consumeRateLimit(`setup:unlock-get:${ip}`, 30, 60_000);
	if (!rl.allowed) {
		return NextResponse.json(
			{ error: 'Too many requests.' },
			{ status: 429, headers: { 'Retry-After': String(rl.retryAfter), 'Cache-Control': 'no-store' } }
		);
	}

	const diskToken = getSetupToken() || ensureSetupToken({ announce: false });
	if (!diskToken) {
		return NextResponse.json(
			{ ok: true, tokenRequired: false, unlocked: true },
			{ headers: { 'Cache-Control': 'no-store' } }
		);
	}

	if (hasValidSetupSessionCookie(request, diskToken)) {
		return NextResponse.json(
			{ ok: true, tokenRequired: true, unlocked: true },
			{ headers: { 'Cache-Control': 'no-store' } }
		);
	}

	if (isDevAutoUnlockAllowed(request)) {
		const response = NextResponse.json(
			{ ok: true, tokenRequired: true, unlocked: true },
			{ headers: { 'Cache-Control': 'no-store' } }
		);
		return attachSetupSessionCookie(response, request, diskToken);
	}

	return NextResponse.json(
		{ ok: true, tokenRequired: true, unlocked: false },
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}

async function handlePOST(request: Request) {
	const ip = clientAddress(request);
	const guardError = await enforceSetupAccessGuards(request, ip);
	if (guardError) return guardError;

	const rawBody = await request.json().catch(() => {
		/* Treat empty or non-JSON request bodies as missing token payloads */
		return {};
	});
	const body = rawBody && typeof rawBody === 'object' ? (rawBody as Record<string, unknown>) : {};

	const tokenError = await verifySetupTokenGate(request, body, ip, { path: '/api/setup/unlock' });
	if (tokenError) return tokenError;

	const diskToken = getSetupToken() || ensureSetupToken({ announce: false });
	const response = NextResponse.json(
		{ ok: true, unlocked: true },
		{ headers: { 'Cache-Control': 'no-store' } }
	);
	if (diskToken) {
		attachSetupSessionCookie(response, request, diskToken);
	}
	return response;
}

export const POST = withAudit(handlePOST, {
	action: 'setup.unlock.create',
	target: 'setup.unlock',
	getDetails: () => ({ unlocked: true }),
});
