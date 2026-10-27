import { NextResponse } from 'next/server';
import { getCertificateByCode } from '@/db';
import { clientAddress } from '@/lib/http';
import { consumeRateLimit } from '@/lib/rateLimit';
import { inspectRequestPayload } from '@/lib/waf';
import { isIpBanned, recordSecurityStrike } from '@/server/db/domains/security.repo';

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ code?: string; kod?: string }> }
) {
	const ip = clientAddress(request);
	const ban = await isIpBanned(ip);
	if (ban.banned) {
		return NextResponse.json(
			{ gecerliMi: false, error: 'IP adresiniz siber güvenlik politikası gereği karantinaya alınmıştır.' },
			{ status: 403 }
		);
	}

	const waf = inspectRequestPayload(request);
	if (waf.matched) {
		void recordSecurityStrike({
			ip,
			points: waf.points,
			reason: `WAF: ${waf.signature}`,
			path: '/api/sertifikalar/[kod]',
		});
		return NextResponse.json(
			{ gecerliMi: false, error: 'Güvenlik duvarı (WAF) tarafından şüpheli istek engellendi.' },
			{ status: 403 }
		);
	}

	const rl = consumeRateLimit(`cert_verify:${ip}`, 30, 60_000);
	if (!rl.allowed) {
		return NextResponse.json(
			{ gecerliMi: false, error: 'Çok fazla sorgu yaptınız. Lütfen biraz bekleyin.' },
			{ status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
		);
	}

	try {
		const { code, kod } = await params;
		const cert = await getCertificateByCode((code || kod)!);

		if (!cert) {
			return NextResponse.json({ gecerliMi: false, error: 'Certificate bulunamadı veya geçersiz.' }, { status: 404 });
		}

		// Strip internal user ID and 11-digit student number from public verification response
		const {
			ogrenciNo: _ogrenciNo,
			userId: _kullaniciId,
			...publicCert
		} = cert as typeof cert & { ogrenciNo?: string };

		return NextResponse.json({
			gecerliMi: true,
			sertifika: publicCert,
		});
	} catch (error) {
		console.error('API error:', error);
		return NextResponse.json({ error: 'İşlem tamamlanamadı.' }, { status: 500 });
	}
}
