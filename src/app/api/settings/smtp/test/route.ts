import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { requireApp } from '@/lib/auth/access';
import { createSmtpTransport } from '@/lib/mail/mailer';
import { isPrivateHost } from '@/lib/mail/hosts';
import { readSmtpConfig } from '@/lib/mail/smtpSettings';
import { isTestEmailAddress } from '@/lib/mail/address';
import { consumeRateLimit, pruneRateLimits } from '@/lib/rateLimit';

/** Tests are expensive (a real SMTP handshake) and admin-triggered only. */
const RATE_LIMIT = { max: 5, windowMs: 10 * 60 * 1000 };

async function handlePOST(request: Request) {
	const auth = await requireApp(request, 'settings', 'yonet');
	if (!auth.authorized) return auth.response;

	pruneRateLimits();
	const limit = consumeRateLimit(`smtp-test:${auth.user.id}`, RATE_LIMIT.max, RATE_LIMIT.windowMs);
	if (!limit.allowed) {
		return NextResponse.json(
			{ error: `Çok fazla test denemesi. ${limit.retryAfter} saniye sonra tekrar deneyin.` },
			{ status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
		);
	}

	try {
		const body = await request.json().catch(() => ({}));

		// Default to the caller's own address. Restricting the recipient keeps this
		// from being usable as an open relay; an admin who needs to verify delivery
		// elsewhere can add that mailbox as their own account first.
		const targetEmail = String(body.testEmail || auth.user.email || '').trim();
		if (!targetEmail) {
			return NextResponse.json(
				{ error: 'Test alıcı adresi belirlenemedi.' },
				{ status: 400 }
			);
		}

		if (isTestEmailAddress(targetEmail)) {
			return NextResponse.json(
				{ error: 'Test gönderimi için gerçek bir e-posta adresi belirtilmelidir (sahte/.test alan adlarına canlı SMTP iletimi engellenmiştir).' },
				{ status: 400 }
			);
		}

		// Always exercise what is currently stored and displayed. The previous version
		// silently fell back to the saved config, so a test could report success for a
		// configuration that was not the one on screen.
		const stored = await readSmtpConfig();

		const host = String(body.smtp_host || stored.host).trim();
		if (isPrivateHost(host) && process.env.MAIL_ALLOW_PRIVATE_HOSTS !== '1') {
			return NextResponse.json(
				{ error: 'Yerel ağ adreslerine test bağlantısı kurulamaz.' },
				{ status: 400 }
			);
		}

		// A masked or blank password means "use the stored credential".
		const submittedPass =
			typeof body.smtp_pass === 'string' && body.smtp_pass.trim() && !body.smtp_pass.includes('•')
				? body.smtp_pass.trim().replace(/\s+/g, '')
				: null;

		const config = {
			host,
			port: Number(body.smtp_port) || stored.port,
			secure:
				typeof body.smtp_secure === 'boolean' ? body.smtp_secure : stored.secure,
			user: String(body.smtp_user || stored.user).trim(),
			pass: submittedPass ?? stored.pass,
			from: String(body.smtp_from || stored.from || body.smtp_user || stored.user).trim(),
		};

		if (!config.pass) {
			return NextResponse.json(
				{
					success: false,
					error: 'Uygulama şifresi girilmemiş. Test yapabilmek için önce şifreyi kaydedin.',
				},
				{ status: 400 }
			);
		}

		const transporter = createSmtpTransport(config);

		await transporter.verify();

		const info = await transporter.sendMail({
			from: config.from,
			to: targetEmail,
			subject: '✓ [TEST] Orbit Community OS — SMTP Verification',
			html: `
				<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #27272a; border-radius: 12px; background: #09090b; color: #fafafa;">
					<h2 style="color: #fafafa; margin: 0 0 12px 0;">Orbit Community OS</h2>
					<div style="background: #18181b; border: 1px solid #27272a; padding: 14px; border-radius: 8px; margin-bottom: 16px;">
						<strong style="color: #22c55e;">✓ SMTP Connection Successful</strong>
						<p style="color: #a1a1aa; font-size: 13px; margin: 4px 0 0 0;">Outbound email dispatch is operational with these settings.</p>
					</div>
					<p style="font-size: 13px; color: #71717a;">Server: ${config.host}:${config.port} · Timestamp: ${new Date().toISOString()}</p>
				</div>
			`,
		});

		return NextResponse.json({
			success: true,
			message: `${targetEmail} adresine test e-postası gönderildi.`,
			messageId: info.messageId,
		});
	} catch (error) {
		console.error('API /api/settings/smtp/test error:', error);
		// 400: the submitted settings are wrong. 500 is reserved for faults on our side,
		// so the panel can tell "fix your password" from "the server broke".
		const isConfigError = /auth|credential|535|534|530|invalid login/i.test(String(error?.message));
		return NextResponse.json(
			{
				success: false,
				error: isConfigError
					? 'SMTP kimlik doğrulaması başarısız. 16 haneli uygulama şifresini kontrol edin.'
					: `SMTP bağlantı hatası: ${error?.message || 'bilinmeyen hata'}`,
			},
			{ status: isConfigError ? 400 : 502 }
		);
	}
}

export const POST = withAudit(handlePOST, { action: 'settings.smtp.test.create', target: 'settings.smtp.test' });
