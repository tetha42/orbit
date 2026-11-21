import { NextResponse } from 'next/server';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { getLockdownState, isIpBanned, recordSecurityStrike } from '@/db/repositories/security.repo';
import { clientAddress } from '@/lib/http';
import { isValidEmail } from '@/lib/mail/address';
import { consumeRateLimit } from '@/lib/rateLimit';
import { inspectRequestPayload } from '@/lib/waf';
import { handleRequestResetCode, handleVerifyAndResetPassword } from './resetHelpers';

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
			message: `[WAF] Attack signature blocked (${waf.signature}): POST /api/auth/reset-password`,
			detail: { category: waf.category, signature: waf.signature },
			ip,
		});
		void recordSecurityStrike({
			ip,
			points: waf.points,
			reason: `WAF: ${waf.signature}`,
			path: '/api/auth/reset-password',
		});
		return NextResponse.json(
			{ error: 'Suspicious request blocked by the Web Application Firewall (WAF).' },
			{ status: 403 }
		);
	}
	const lockdown = await getLockdownState();
	if (lockdown.active) {
		return NextResponse.json(
			{ error: 'System is currently in high-security Defcon Lockdown mode. Password resets are temporarily suspended.' },
			{ status: 503 }
		);
	}
	const limit = consumeRateLimit(`pwd_reset:${ip}`, 10, 60_000);
	if (!limit.allowed) {
		return NextResponse.json(
			{ error: 'Too many requests. Please try again later.' },
			{ status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
		);
	}

	try {
		const body = await request.json().catch(() => ({}));
		const { action, email, code, newPassword } = body;
		const normalizedEmail = String(email || '').trim().toLowerCase();

		if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
			return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
		}

		if (action === 'request_code') {
			return await handleRequestResetCode(normalizedEmail, ip);
		}
		if (action === 'verify_and_reset') {
			return await handleVerifyAndResetPassword({ normalizedEmail, code, newPassword, ip });
		}

		return NextResponse.json({ error: 'Invalid action parameter.' }, { status: 400 });
	} catch (error) {
		console.error('[reset-password] error:', error);
		return NextResponse.json({ error: 'Request could not be completed.' }, { status: 500 });
	}
}
