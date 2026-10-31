import { NextResponse } from 'next/server';
import { requireApp } from '@/lib/auth/access';
import { getSystemSettings, setSystemSettings } from '@/db';
import { auditContext } from '@/db/audit';
import { smtpFarki } from '@/lib/audit';
import { isPrivateHost } from '@/lib/mail/hosts';
import {
	PASSWORD_MASK,
	SMTP_DEFAULTS,
	SMTP_KEYS,
	buildSmtpUpdates,
	isUnchangedPassword,
	readSmtpConfig,
} from '@/lib/mail/smtpSettings';

export async function GET(request: Request) {
	const auth = await requireApp(request, 'settings', 'yonet');
	if (!auth.authorized) return auth.response;

	try {
		const settings = await getSystemSettings();
		const config = await readSmtpConfig();
		const hasPassword = Boolean(config.pass);

		return NextResponse.json({
			// Stored values only: nothing is prefilled for a fresh installation.
			smtp_host: settings.smtp_host || '',
			smtp_port: String(config.port),
			smtp_secure: config.secure,
			smtp_user: config.user,
			smtp_from: settings.smtp_from || '',
			mail_welcome_template: settings.mail_welcome_template || 'Topluluk üyelik başvurunuz alındı. Yönetim incelemesinin ardından hesabınız etkinleştirilecek ve bu adrese bilgi verilecektir.',
			hasPassword,
			// The panel never receives the credential itself, only this placeholder.
			maskedPassword: hasPassword ? PASSWORD_MASK : '',
			// Whether a test send can actually reach a server.
			emailReady: hasPassword,
			configured: Object.keys(settings).some((k) => k.startsWith('smtp_')),
		});
	} catch (error) {
		console.error('API /api/settings/smtp GET error:', error);
		return NextResponse.json({ error: 'Ayarlar okunamadı.' }, { status: 500 });
	}
}

export async function POST(request: Request) {
	const auth = await requireApp(request, 'settings', 'yonet');
	if (!auth.authorized) return auth.response;

	try {
		const body = await request.json().catch(() => ({}));
		const { smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, smtp_from, mail_welcome_template, clearPassword } = body;

		const cleanHost = String(smtp_host ?? '').replace(/[\r\n\s]+/g, '').trim();
		if (cleanHost && isPrivateHost(cleanHost) && process.env.MAIL_ALLOW_PRIVATE_HOSTS !== '1') {
			return NextResponse.json(
				{ error: 'Güvenlik nedeniyle yerel ağ veya iç sunucu adresleri SMTP sunucusu olarak kaydedilemez.' },
				{ status: 400 }
			);
		}

		// Distinguish "leave the password alone" from "remove it":
		//   - omitted / blank / the display mask -> leave untouched
		//   - clearPassword: true                -> delete it
		//   - anything else                      -> save the new value
		let passUpdate: string | null | undefined;
		if (clearPassword === true) {
			passUpdate = null;
		} else if (typeof smtp_pass === 'string' && smtp_pass.trim() && !isUnchangedPassword(smtp_pass)) {
			// Google app passwords are displayed in groups of four; strip the spaces.
			passUpdate = smtp_pass.trim().replace(/\s+/g, '');
		}

		const updates = await buildSmtpUpdates({
			host: cleanHost,
			port: smtp_port,
			secure: smtp_secure,
			user: typeof smtp_user === 'string' ? smtp_user.replace(/[\r\n]+/g, '').trim() : smtp_user,
			from: typeof smtp_from === 'string' ? smtp_from.replace(/[\r\n]+/g, '').trim() : smtp_from,
			pass: passUpdate,
		});

		if (typeof mail_welcome_template === 'string') {
			updates.mail_welcome_template = mail_welcome_template.trim();
		}

		// The record shows what changed in the account settings; the password only
		// as "changed" / "removed", never its value (smtpFarki).
		const varsayilan = {
			[SMTP_KEYS.host]: SMTP_DEFAULTS.host,
			[SMTP_KEYS.port]: String(SMTP_DEFAULTS.port),
			[SMTP_KEYS.secure]: String(SMTP_DEFAULTS.secure),
			[SMTP_KEYS.user]: SMTP_DEFAULTS.user,
			[SMTP_KEYS.from]: SMTP_DEFAULTS.from,
		};
		await setSystemSettings(updates, {
			ctx: auditContext(request, auth.user),
			registration: { islem: 'ayar.smtp', hedefTur: 'ayar', hedefId: 'smtp', hedefAd: 'E-posta hesabı (SMTP)' },
			fark: (onceki, yeni) => smtpFarki(onceki, yeni, varsayilan),
		});

		// Report the effective state so the panel can warn that mail will not send
		// yet rather than claiming success.
		const config = await readSmtpConfig();
		const hasPassword = Boolean(config.pass);

		return NextResponse.json({
			success: true,
			hasPassword,
			emailReady: hasPassword,
			message: hasPassword
				? 'E-posta hesabı ayarları kaydedildi.'
				: 'Ayarlar kaydedildi ancak uygulama şifresi girilmediği için e-posta gönderilemez.',
		});
	} catch (error) {
		console.error('API /api/settings/smtp POST error:', error);
		return NextResponse.json({ error: 'Ayarlar kaydedilemedi.' }, { status: 500 });
	}
}
