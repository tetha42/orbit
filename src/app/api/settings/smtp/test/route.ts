import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { requireApp } from '@/lib/auth/access';
import { createSmtpTransport } from '@/lib/mail/mailer';
import { isPrivateHost, resolveAndValidatePublicHost } from '@/lib/mail/hosts';
import { readSmtpConfig } from '@/lib/mail/smtpSettings';
import { isTestEmailAddress } from '@/lib/mail/address';
import { consumeRateLimit, pruneRateLimits } from '@/lib/rateLimit';

/** Tests are expensive (a real SMTP handshake) and admin-triggered only. */
const RATE_LIMIT = { max: 5, windowMs: 10 * 60 * 1000 };

async function handlePOST(request: Request) {
	const auth = await requireApp(request, 'settings', 'manage');
	if (!auth.authorized) return auth.response;

	pruneRateLimits();
	const limit = consumeRateLimit(`smtp-test:${auth.user.id}`, RATE_LIMIT.max, RATE_LIMIT.windowMs);
	if (!limit.allowed) {
		return NextResponse.json(
			{ error: `Too many test attempts. Try again in ${limit.retryAfter} seconds.` },
			{ status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
		);
	}

	try {
		const body = await request.json().catch(() => ({}));

		// Always send the test email strictly to the authenticated administrator's own email address
		// to prevent the test endpoint from being abused as an arbitrary mail relay.
		const targetEmail = String(auth.user.email || '').trim();
		if (!targetEmail) {
			return NextResponse.json(
				{ error: 'Test recipient address could not be determined.' },
				{ status: 400 }
			);
		}

		if (isTestEmailAddress(targetEmail)) {
			return NextResponse.json(
				{ error: 'A real email address must be specified for test delivery (live SMTP delivery to fake/.test domains is blocked).' },
				{ status: 400 }
			);
		}

		const stored = await readSmtpConfig();

		const host = String(body.smtp_host || stored.host).trim();
		if (process.env.MAIL_ALLOW_PRIVATE_HOSTS !== '1') {
			if (isPrivateHost(host)) {
				return NextResponse.json(
					{ error: 'Test connections cannot be made to local network addresses.' },
					{ status: 400 }
				);
			}
			const dnsCheck = await resolveAndValidatePublicHost(host);
			if (!dnsCheck.ok) {
				return NextResponse.json(
					{ error: dnsCheck.error || 'Test connections cannot be made to local network addresses.' },
					{ status: 400 }
				);
			}
		}

		const port = Number(body.smtp_port) || stored.port;
		const user = String(body.smtp_user || stored.user).trim();

		// A masked or blank password means "use the stored credential" ONLY when
		// host, port, and user match the stored configuration (prevents credential exfiltration to an attacker host).
		const submittedPass =
			typeof body.smtp_pass === 'string' && body.smtp_pass.trim() && !body.smtp_pass.includes('•')
				? body.smtp_pass.trim().replace(/\s+/g, '')
				: null;

		const targetMatchesStored =
			host.toLowerCase() === (stored.host || '').toLowerCase() &&
			port === stored.port &&
			user === (stored.user || '');

		if (!submittedPass && !targetMatchesStored) {
			return NextResponse.json(
				{
					success: false,
					error: 'When testing a new SMTP host, port, or username, you must enter the SMTP password explicitly.',
				},
				{ status: 400 }
			);
		}

		const config = {
			host,
			port,
			secure:
				typeof body.smtp_secure === 'boolean' ? body.smtp_secure : stored.secure,
			user,
			pass: submittedPass ?? stored.pass,
			from: String(body.smtp_from || stored.from || body.smtp_user || stored.user).trim(),
		};

		if (!config.pass) {
			return NextResponse.json(
				{
					success: false,
					error: 'App password is not set. Save the password first before testing.',
				},
				{ status: 400 }
			);
		}

		const safeHostHtml = config.host
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');

		const transporter = createSmtpTransport(config);

		await transporter.verify();

		const info = await transporter.sendMail({
			from: config.from,
			to: targetEmail,
			subject: '✓ [TEST] Orbit Community OS — SMTP Verification',
			html: `
				<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
					max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #27272a;
					border-radius: 12px; background: #09090b; color: #fafafa;">
					<h2 style="color: #fafafa; margin: 0 0 12px 0;">Orbit Community OS</h2>
					<div style="background: #18181b; border: 1px solid #27272a; padding: 14px; border-radius: 8px; margin-bottom: 16px;">
						<strong style="color: #22c55e;">✓ SMTP Connection Successful</strong>
						<p style="color: #a1a1aa; font-size: 13px; margin: 4px 0 0 0;">Outbound email dispatch is operational with these settings.</p>
					</div>
					<p style="font-size: 13px; color: #71717a;">Server: ${safeHostHtml}:${config.port} · Timestamp: ${new Date().toISOString()}</p>
				</div>
			`,
		});

		return NextResponse.json({
			success: true,
			message: `Test email sent to ${targetEmail}.`,
			messageId: info.messageId,
		});
	} catch (error) {
		console.error('API /api/settings/smtp/test error:', error);
		const err = error as Error;
		// 400: the submitted settings are wrong. 500 is reserved for faults on our side,
		// so the panel can tell "fix your password" from "the server broke".
		const isConfigError = /auth|credential|535|534|530|invalid login/i.test(String(err?.message));
		return NextResponse.json(
			{
				success: false,
				error: isConfigError
					? 'SMTP authentication failed. Please check your credentials.'
					: `SMTP connection error: ${err?.message || 'unknown error'}`,
			},
			{ status: isConfigError ? 400 : 502 }
		);
	}
}

export const POST = withAudit(handlePOST, { action: 'settings.smtp.test.create', target: 'settings.smtp.test' });
