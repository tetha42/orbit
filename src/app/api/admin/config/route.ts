import { NextResponse } from 'next/server';
import { clientAddress } from '@/lib/http';
import { logSystemEvent } from '@/server/db/domains/logs.repo';
import { recordSecurityStrike } from '@/server/db/domains/security.repo';

export const dynamic = 'force-dynamic';

/**
 * AI Cyber-Attack & Automated Scanner Honeypot (Canary Endpoint).
 *
 * Legitimate users and the application UI never request `/api/admin/config`.
 * Any automated exploit bot, directory fuzzer, or offensive AI agent probing
 * this endpoint immediately receives a 100-point threat strike and is
 * automatically quarantined in `guvenlik_engelleri`.
 */
async function handleHoneypot(request: Request) {
	const ip = clientAddress(request);
	const ua = request.headers.get('user-agent') || 'unknown';
	const isProbe = !!request.headers.get('x-appsec-probe');

	const origPath = request.headers.get('x-canary-original-path') || '/api/admin/config';
	const signature = request.headers.get('x-canary-signature') || 'Honeypot canary endpoint';

	if (!isProbe) {
		await logSystemEvent({
			servis: 'security',
			seviye: 'ERROR',
			mesaj: `🍯 [HONEYPOT TRAP] Automated scanner / attacker detected: ${request.method} ${origPath}`,
			detay: {
				method: request.method,
				userAgent: ua.slice(0, 200),
				tuzak: origPath,
				signature,
			},
			ip,
		});

		await recordSecurityStrike({
			ip,
			points: 100,
			reason: `Honeypot Triggered: ${origPath} (${signature})`,
			path: origPath,
		});
	}

	return NextResponse.json(
		{ error: 'Access denied. Your IP address has been flagged for security review.' },
		{ status: 403, headers: { 'Cache-Control': 'no-store' } }
	);
}

export async function GET(request: Request) {
	return handleHoneypot(request);
}

export async function POST(request: Request) {
	return handleHoneypot(request);
}

export async function PUT(request: Request) {
	return handleHoneypot(request);
}

export async function DELETE(request: Request) {
	return handleHoneypot(request);
}
