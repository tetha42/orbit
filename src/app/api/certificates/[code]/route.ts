import { NextResponse } from 'next/server';
import { getCertificateByCode } from '@/db';
import { clientAddress } from '@/lib/http';
import { consumeRateLimit } from '@/lib/rateLimit';
import { inspectRequestPayload } from '@/lib/waf';
import { isIpBanned, recordSecurityStrike } from '@/db/repositories/security.repo';

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ code?: string;}> }
) {
	const ip = clientAddress(request);
	const ban = await isIpBanned(ip);
	if (ban.banned) {
		return NextResponse.json(
			{ isValid: false, error: 'IP adresiniz siber güvenlik politikası gereği karantinaya alınmıştır.' },
			{ status: 403 }
		);
	}

	const waf = inspectRequestPayload(request);
	if (waf.matched) {
		void recordSecurityStrike({
			ip,
			points: waf.points,
			reason: `WAF: ${waf.signature}`,
			path: '/api/sertifikalar/[code]',
		});
		return NextResponse.json(
			{ isValid: false, error: 'Güvenlik duvarı (WAF) tarafından şüpheli istek engellendi.' },
			{ status: 403 }
		);
	}

	const rl = consumeRateLimit(`cert_verify:${ip}`, 30, 60_000);
	if (!rl.allowed) {
		return NextResponse.json(
			{ isValid: false, error: 'Çok fazla sorgu yaptınız. Lütfen biraz bekleyin.' },
			{ status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
		);
	}

	try {
		const { code } = await params;
		const cert = await getCertificateByCode(code!);

		if (!cert) {
			return NextResponse.json({ isValid: false, error: 'Certificate bulunamadı veya geçersiz.' }, { status: 404 });
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
		return NextResponse.json({ error: 'İşlem tamamlanamadı.' }, { status: 500 });
	}
}
