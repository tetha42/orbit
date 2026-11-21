import { NextResponse } from 'next/server';
import { getCertificateByCode } from '@/db';
import { clientAddress } from '@/lib/http';
import { consumeRateLimit } from '@/lib/rateLimit';
import { inspectRequestPayload } from '@/lib/waf';
import { inspectWafWithGuard } from '@/server/security/securityGuardClient';
import { verifyCertificateFormatWasm } from '@/lib/wasm/securityEngine';
import { isIpBanned, recordSecurityStrike } from '@/db/repositories/security.repo';
import certificatesContract from '@/apps/certificates/certificates.contract.json';
import { contractErrorResponse } from '@/contracts/helpers';

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ code?: string;}> }
) {
	const ip = clientAddress(request);
	const ban = await isIpBanned(ip);
	if (ban.banned) {
		return NextResponse.json(
			{ isValid: false, error: 'Your IP address has been quarantined due to security policy.' },
			{ status: 403 }
		);
	}

	// Try Go security-guard microservice first, fallback to pure TypeScript WAF
	const reqUrl = new URL(request.url);
	const guardWaf = await inspectWafWithGuard({
		pathname: reqUrl.pathname,
		search: reqUrl.search,
		userAgent: request.headers.get('user-agent'),
		referer: request.headers.get('referer'),
	});
	const waf = guardWaf ?? inspectRequestPayload(request);
	if (waf.matched) {
		void recordSecurityStrike({
			ip,
			points: waf.points,
			reason: `WAF: ${waf.signature}`,
			path: reqUrl.pathname,
		});
		return NextResponse.json(
			{ isValid: false, error: 'Suspicious request blocked by the Web Application Firewall (WAF).' },
			{ status: 403 }
		);
	}

	const rl = consumeRateLimit(`cert_verify:${ip}`, 30, 60_000);
	if (!rl.allowed) {
		return NextResponse.json(
			{ isValid: false, error: 'Too many requests. Please wait a moment.' },
			{ status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
		);
	}

	try {
		const { code } = await params;
		if (!code || code.length > certificatesContract.limits.maxVerificationCodeLength || !verifyCertificateFormatWasm(code).valid) {
			return contractErrorResponse(certificatesContract, 'INVALID_VERIFICATION_CODE', undefined, { isValid: false });
		}
		const cert = await getCertificateByCode(code);

		if (!cert) {
			return contractErrorResponse(certificatesContract, 'CERTIFICATE_NOT_FOUND', 'Certificate not found or invalid.', { isValid: false });
		}

		// Strip internal user ID and 11-digit student number from public verification response
		const {
			studentNo: _StudentNo,
			userId: _UserId,
			...publicCert
		} = cert as typeof cert & { studentNo?: string };

		return NextResponse.json({
			isValid: true,
			certificate: publicCert,
		});
	} catch (error) {
		console.error('API error:', error);
		return NextResponse.json({ error: 'Request could not be completed.' }, { status: 500 });
	}
}
