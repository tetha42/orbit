import nodemailer from 'nodemailer';
import { readMailAccount } from './smtpSettings';
import { isValidEmail, isTestEmailAddress } from './address';
import { errorMessage } from '@/lib/errors';

export interface SendMailOptions {
	to: string;
	subject: string;
	html: string;
	text?: string;
}

export interface CapturedTestEmail {
	to: string;
	subject: string;
	html: string;
	text?: string;
	timestamp: number;
}

const capturedTestEmails: CapturedTestEmail[] = [];
const MAX_CAPTURED = 50;

export function recordCapturedTestEmail(mail: CapturedTestEmail): void {
	capturedTestEmails.unshift(mail);
	if (capturedTestEmails.length > MAX_CAPTURED) {
		capturedTestEmails.pop();
	}
}

export function getCapturedTestEmails(): readonly CapturedTestEmail[] {
	return capturedTestEmails;
}

export function clearCapturedTestEmails(): void {
	capturedTestEmails.length = 0;
}

export interface MailerResult {
	success: boolean;
	/**
	 * True when no credential is stored and the message was only logged.
	 * Callers must not treat this as delivery — use `success && !simulated`.
	 */
	simulated?: boolean;
	messageId?: string;
	error?: string;
}

/**
 * True only when a message actually left the server.
 *
 * `sendMail` reports `success: true` for the simulated path so that callers do
 * not throw when mail is unconfigured, which makes it easy to mistake "logged to
 * the console" for "delivered". Callers that need real delivery check this.
 */
export function wasDelivered(result: MailerResult): boolean {
	return result.success && result.simulated !== true;
}

export interface SmtpTransportConfig {
	host: string;
	port: number;
	secure: boolean;
	user: string;
	pass: string;
}

/**
 * The one place an SMTP connection is described: the mailer and the connection
 * test both come through here, so they cannot drift in timeouts or credential handling.
 */
export function createSmtpTransport(config: SmtpTransportConfig) {
	return nodemailer.createTransport({
		host: config.host,
		port: config.port,
		secure: config.secure,
		auth: {
			user: config.user,
			pass: config.pass.replace(/\s+/g, ''), // Google app passwords are shown in groups of four
		},
		// Bound the handshake so a black-holed host cannot hang the request.
		connectionTimeout: 10_000,
		greetingTimeout: 10_000,
		socketTimeout: 20_000,
	});
}

export async function getTransporter() {
	// readMailAccount decrypts the stored credential; a value that fails to decrypt
	// comes back empty and is treated as "not configured" rather than used as a password.
	const config = await readMailAccount();
	const info = { host: config.host, port: config.port, secure: config.secure, user: config.user, from: config.from };

	if (!config.pass || !config.host) return { transporter: null, isConfigured: false, config: info };
	return { transporter: createSmtpTransport(config), isConfigured: true, config: info };
}

export async function sendMail(options: SendMailOptions): Promise<MailerResult> {
	try {
		const rawTo = String(options.to ?? '').trim();
		if (!rawTo || /[\r\n]/.test(rawTo)) {
			return { success: false, error: 'Geçersiz alıcı e-posta adresi.' };
		}

		// Support either a single validated address or a comma-separated list of validated addresses
		const recipients = rawTo
			.split(',')
			.map((addr) => addr.trim())
			.filter(Boolean);
		if (recipients.length === 0 || recipients.length > 20 || !recipients.every((addr) => isValidEmail(addr))) {
			return { success: false, error: 'Geçersiz alıcı e-posta adresi formatı.' };
		}

		const safeTo = recipients.join(', ');
		const safeSubject = String(options.subject ?? '')
			.replace(/[\r\n\0]+/g, ' ')
			.trim()
			.slice(0, 250);

		// Safety shield: never dispatch emails to reserved test domains (.test, .example, e2e_*)
		// or when running in test mode via Google SMTP. This completely protects the 500 email/day
		// quota and eliminates hard bounce spam reputation risks.
		const hasTestRecipient = recipients.some((r) => isTestEmailAddress(r));
		const isMockMode =
			process.env.MOCK_MAIL === 'true' ||
			process.env.MOCK_MAIL === '1' ||
			process.env.NODE_ENV === 'test';

		if (hasTestRecipient || isMockMode) {
			const reason = hasTestRecipient
				? `Test alan adı veya simülasyon adresi tespit edildi (${safeTo})`
				: `MOCK_MAIL test ortamı aktif`;

			console.log(`\n================== [SMTP GÜVENLİK SİMÜLASYONU] ==================`);
			console.log(`[ALICI]: ${safeTo}`);
			console.log(`[KONU]: ${safeSubject}`);
			console.log(`[BİLGİ]: ${reason}. Canlı Google SMTP'ye gönderim engellendi, kota ve spam itibarı korundu.`);
			console.log(`=================================================================\n`);

			recordCapturedTestEmail({
				to: safeTo,
				subject: safeSubject,
				html: options.html,
				text: options.text,
				timestamp: Date.now(),
			});

			return {
				success: true,
				simulated: true,
				messageId: `mock_test_${Date.now()}`,
			};
		}

		const { transporter, isConfigured, config } = await getTransporter();

		if (!isConfigured || !transporter) {
			console.log(`\n================== [SMTP SİMÜLASYONU] ==================`);
			console.log(`[ALICI]: ${safeTo}`);
			console.log(`[KONU]: ${safeSubject}`);
			console.log(`[BİLGİ]: SMTP şifresi panelden girilene kadar e-postalar konsola simüle edilir.`);
			console.log(`========================================================\n`);

			return {
				success: true,
				simulated: true,
				messageId: `sim_${Date.now()}`,
			};
		}

		const safeFrom = String(config.from || config.user).replace(/[\r\n\0]+/g, ' ').trim();

		const info = await transporter.sendMail({
			from: safeFrom,
			to: safeTo,
			subject: safeSubject,
			text: options.text || options.html.replace(/<[^>]*>?/gm, ''),
			html: options.html,
		});

		return {
			success: true,
			simulated: false,
			messageId: info.messageId,
		};
	} catch (error) {
		console.error('[SMTP Hatası]:', error);
		return {
			success: false,
			error: errorMessage(error) || 'E-posta gönderilirken bir hata oluştu',
		};
	}
}
