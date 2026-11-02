import { sendMail, wasDelivered, type MailerResult } from './mailer';
import { safeName, safeRecipient } from './address';
import { CONFIG } from '@/server/config';

/**
 * Transactional emails triggered by account lifecycle events.
 *
 * Every function is fire-and-forget: a mail failure must never break the request
 * that triggered it, so errors are logged and swallowed.
 *
 * Automatically detects whether the recipient prefers Turkish or English,
 * and formats greetings, subjects, and email content accordingly.
 */

export interface Recipient {
	ad: string;
	soyad: string;
	email: string;
	preferredLanguage?: 'tr' | 'en';
}

type Lang = 'tr' | 'en';

function getLang(user: Recipient, override?: Lang): Lang {
	if (override === 'en' || override === 'tr') return override;
	return user.preferredLanguage === 'en' ? 'en' : 'tr';
}

function shell(bodyHtml: string): string {
	const communityName = CONFIG.clubPreset.name || 'Orbit Community';
	const domain = CONFIG.clubPreset.domain || 'orbit.local';
	return `
		<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background: #ffffff; color: #111827;">
			<h2 style="color: #0a84ff; margin: 0 0 16px 0;">${communityName}</h2>
			${bodyHtml}
			<div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 20px; font-size: 12px; color: #9ca3af; text-align: center;">
				${communityName} OS by tetha42 • ${domain}
			</div>
		</div>
	`;
}

function paragraph(text: string): string {
	return `<p style="font-size: 14px; line-height: 1.6; color: #374151; margin: 0 0 12px 0;">${text}</p>`;
}

/**
 * Shared send path: validates the recipient, escapes the name, and swallows
 * everything so callers can fire without awaiting.
 */
async function sendNotification(
	user: Recipient,
	subject: string,
	bodyFor: (greeting: string, lang: Lang) => string,
	langOverride?: Lang
): Promise<MailerResult> {
	const to = safeRecipient(user.email);
	if (!to) {
		console.warn(`[notify] Invalid recipient address, skipped: ${String(user.email).slice(0, 60)}`);
		return { success: false, error: 'Invalid recipient email address.' };
	}

	const lang = getLang(user, langOverride);
	const greeting =
		lang === 'en'
			? `Hello ${safeName(user.ad)} ${safeName(user.soyad)},`
			: `Merhaba ${safeName(user.ad)} ${safeName(user.soyad)},`;

	try {
		const result = await sendMail({ to, subject, html: shell(bodyFor(greeting, lang)) });

		if (!wasDelivered(result)) {
			const reason = result.simulated
				? 'SMTP not configured'
				: `send error: ${result.error ?? 'unknown'}`;
			console.warn(`[notify] Notification could not be delivered (${reason}): ${to}`);
		}
		return result;
	} catch (error) {
		console.error('[notify] sendNotification failed:', error);
		return { success: false, error: error instanceof Error ? error.message : 'Notification failed.' };
	}
}

const getClubName = () => CONFIG.clubPreset.name || 'Orbit Community';

/** Sent the moment a membership application is submitted. */
export async function notifyRegistrationReceived(
	user: Recipient,
	customTemplate?: string,
	langOverride?: Lang
): Promise<void> {
	const lang = getLang(user, langOverride);
	const subject =
		lang === 'en'
			? `Application received — ${getClubName()}`
			: `Başvurunuz alındı — ${getClubName()}`;

	await sendNotification(
		user,
		subject,
		(greeting, l) =>
			paragraph(greeting) +
			paragraph(
				customTemplate && customTemplate.trim()
					? safeName(customTemplate)
					: l === 'en'
						? 'Your community membership application has been received. Following review by community managers, your account will be activated and you will be informed.'
						: 'Topluluk üyelik başvurunuz alındı. Yönetim incelemesinin ardından hesabınız aktifleştirilecek ve bu adrese bilgi verilecektir.'
			) +
			paragraph(
				l === 'en'
					? 'You will not be able to sign in until your application is approved.'
					: 'Başvurunuz onaylanana kadar panele giriş yapamazsınız.'
			),
		lang
	);
}

/** Sent when a user registers to verify their email address. */
export async function notifyEmailVerificationCode(
	user: Recipient,
	code: string,
	langOverride?: Lang
): Promise<MailerResult> {
	const lang = getLang(user, langOverride);
	const subject =
		lang === 'en'
			? `Your Email Verification Code: ${code} — ${getClubName()}`
			: `E-posta Doğrulama Kodunuz: ${code} — ${getClubName()}`;

	return sendNotification(
		user,
		subject,
		(greeting, l) =>
			paragraph(greeting) +
			paragraph(
				l === 'en'
					? 'Please enter the 6-digit verification code below to complete your community membership registration:'
					: 'Topluluk üyelik başvurunuzu tamamlamak için lütfen aşağıdaki 6 haneli doğrulama kodunu kullanın:'
			) +
			`<div style="text-align: center; margin: 20px 0;">
				<span style="font-family: monospace; font-size: 26px; font-weight: 700; letter-spacing: 6px; color: #0a84ff; background: #f0f7ff; padding: 10px 20px; border-radius: 8px; border: 1px solid #bfdbfe; display: inline-block;">${safeName(code)}</span>
			</div>` +
			paragraph(
				l === 'en'
					? 'This code is valid for 15 minutes. If you did not initiate this request, you can safely ignore this email.'
					: 'Bu kod 15 dakika boyunca geçerlidir. Başvuru talebini siz başlatmadıysanız bu e-postayı dikkate almayınız.'
			),
		lang
	);
}

/** Sent to the new address when a member asks to change their e-mail. */
export async function notifyEmailChangeCode(
	user: Recipient,
	code: string,
	langOverride?: Lang
): Promise<void> {
	const lang = getLang(user, langOverride);
	const subject =
		lang === 'en'
			? `Email Change Verification Code: ${code} — ${getClubName()}`
			: `E-posta Değişikliği Doğrulama Kodunuz: ${code} — ${getClubName()}`;

	await sendNotification(
		user,
		subject,
		(greeting, l) =>
			paragraph(greeting) +
			paragraph(
				l === 'en'
					? 'Enter the 6-digit code below to move your account email to this address:'
					: 'Hesabınızın e-posta adresini bu adrese taşımak için aşağıdaki 6 haneli kodu kullanın:'
			) +
			`<div style="text-align: center; margin: 20px 0;">
				<span style="font-family: monospace; font-size: 26px; font-weight: 700; letter-spacing: 6px; color: #0a84ff; background: #f0f7ff; padding: 10px 20px; border-radius: 8px; border: 1px solid #bfdbfe; display: inline-block;">${safeName(code)}</span>
			</div>` +
			paragraph(
				l === 'en'
					? 'This code is valid for 15 minutes. If you did not initiate this change, ignore this email.'
					: 'Bu kod 15 dakika boyunca geçerlidir. Talebi siz başlatmadıysanız bu e-postayı dikkate almayınız.'
			),
		lang
	);
}

/** Sent to the previous address after the change is completed. */
export async function notifyEmailChanged(
	user: Recipient,
	newEmail: string,
	langOverride?: Lang
): Promise<void> {
	const lang = getLang(user, langOverride);
	const subject =
		lang === 'en'
			? `Your email address has been changed — ${getClubName()}`
			: `E-posta adresiniz değişti — ${getClubName()}`;

	await sendNotification(
		user,
		subject,
		(greeting, l) =>
			paragraph(greeting) +
			paragraph(
				l === 'en'
					? `Your account email address has been updated to <strong>${safeName(newEmail)}</strong>. If you did not perform this change, contact community management immediately.`
					: `Hesabınızın e-posta adresi <strong>${safeName(newEmail)}</strong> olarak güncellendi. Bu değişikliği siz yapmadıysanız derhal topluluk yönetimine başvurun.`
			),
		lang
	);
}

/** Sent when a user requests a password reset code. */
export async function notifyPasswordResetCode(
	user: Recipient,
	code: string,
	langOverride?: Lang
): Promise<MailerResult> {
	const lang = getLang(user, langOverride);
	const subject =
		lang === 'en'
			? `Password Reset Code: ${code} — ${getClubName()}`
			: `Şifre Sıfırlama Kodunuz: ${code} — ${getClubName()}`;

	return sendNotification(
		user,
		subject,
		(greeting, l) =>
			paragraph(greeting) +
			paragraph(
				l === 'en'
					? 'You requested to reset your password. Enter the 6-digit code below to set a new password:'
					: 'Hesap şifrenizi sıfırlamak için talepte bulundunuz. Yeni şifrenizi belirlemek için aşağıdaki 6 haneli kodu girin:'
			) +
			`<div style="text-align: center; margin: 20px 0;">
				<span style="font-family: monospace; font-size: 26px; font-weight: 700; letter-spacing: 6px; color: #ef4444; background: #fef2f2; padding: 10px 20px; border-radius: 8px; border: 1px solid #fecaca; display: inline-block;">${safeName(code)}</span>
			</div>` +
			paragraph(
				l === 'en'
					? 'This code is valid for 15 minutes. If you did not make this request, your password remains unchanged.'
					: 'Bu kod 15 dakika boyunca geçerlidir. Talebi siz yapmadıysanız şifreniz değişmemiştir, güvenliğiniz için topluluk yönetimine bilgi veriniz.'
			),
		lang
	);
}

/** Sent when club management approves an application. */
export async function notifyMembershipApproved(
	user: Recipient,
	langOverride?: Lang
): Promise<void> {
	const lang = getLang(user, langOverride);
	const subject =
		lang === 'en'
			? `Membership approved — Welcome to ${getClubName()}`
			: `Üyeliğiniz onaylandı — ${getClubName()}`;

	await sendNotification(
		user,
		subject,
		(greeting, l) =>
			paragraph(greeting) +
			paragraph(
				l === 'en'
					? `Your community membership application has been approved! You can now sign in to your workspace using the password you set during registration.`
					: 'Topluluk üyelik başvurunuz onaylandı. Artık panelinize kayıt sırasında belirlediğiniz şifreyle giriş yapabilirsiniz.'
			) +
			paragraph(
				l === 'en'
					? 'We recommend protecting your account with two-factor authentication: Settings → Security & 2FA.'
					: 'Girişlerinizi Google Authenticator ile korumanızı öneririz: Ayarlar → Güvenlik & 2FA.'
			),
		lang
	);
}

/** Sent when an administrator manually creates a member account from the Members directory. */
export async function notifyMemberCreatedByAdmin(
	user: Recipient,
	temporaryPassword: string,
	langOverride?: Lang
): Promise<void> {
	const lang = getLang(user, langOverride);
	const subject =
		lang === 'en'
			? `Your Community Account Has Been Created — ${getClubName()}`
			: `Topluluk Hesabınız Oluşturuldu — ${getClubName()}`;

	await sendNotification(
		user,
		subject,
		(greeting, l) =>
			paragraph(greeting) +
			paragraph(
				l === 'en'
					? `Your account was created by community managers. Your temporary password to sign in is: <strong style="font-family: monospace; font-size: 15px; color: #0a84ff; background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${safeName(temporaryPassword)}</strong>`
					: `Topluluk yönetimi tarafından hesabınız oluşturuldu. Sisteme giriş yapmak için geçici şifreniz: <strong style="font-family: monospace; font-size: 15px; color: #0a84ff; background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${safeName(temporaryPassword)}</strong>`
			) +
			paragraph(
				l === 'en'
					? 'For security, please change your password and enable 2FA under Settings → Security & 2FA upon your first login.'
					: 'Güvenliğiniz için ilk girişinizin ardından Ayarlar → Güvenlik & 2FA bölümünden şifrenizi güncellemenizi ve iki adımlı doğrulamayı etkinleştirmenizi öneririz.'
			),
		lang
	);
}

/** Sent when club management declines an application. */
export async function notifyMembershipRejected(
	user: Recipient,
	langOverride?: Lang
): Promise<void> {
	const lang = getLang(user, langOverride);
	const subject =
		lang === 'en'
			? `Regarding your membership application — ${getClubName()}`
			: `Başvurunuz hakkında — ${getClubName()}`;

	await sendNotification(
		user,
		subject,
		(greeting, l) =>
			paragraph(greeting) +
			paragraph(
				l === 'en'
					? 'Your community membership application could not be approved for this term. For further inquiries, please contact community management.'
					: 'Topluluk üyelik başvurunuz bu dönem için onaylanmadı. Sorularınız için topluluk yönetimiyle iletişime geçebilirsiniz.'
			),
		lang
	);
}

/**
 * Sent to a member who asked to be told by e-mail when a portal message arrives.
 */
export async function notifyPortalMessage(
	user: Recipient,
	fromName: string,
	messageSubject: string,
	langOverride?: Lang
): Promise<void> {
	const lang = getLang(user, langOverride);
	const subject =
		lang === 'en'
			? `New message: ${messageSubject.replace(/[\r\n]+/g, ' ').slice(0, 80)} — ${getClubName()}`
			: `Yeni mesaj: ${messageSubject.replace(/[\r\n]+/g, ' ').slice(0, 80)} — ${getClubName()}`;

	await sendNotification(
		user,
		subject,
		(greeting, l) =>
			paragraph(greeting) +
			paragraph(
				l === 'en'
					? `${safeName(fromName)} sent you a message on the portal: <strong>${safeName(messageSubject)}</strong>`
					: `${safeName(fromName)} size portalda bir mesaj gönderdi: <strong>${safeName(messageSubject)}</strong>`
			) +
			paragraph(
				l === 'en'
					? 'Open the Mail app in the workspace to read and reply.'
					: 'Mesajı okumak ve yanıtlamak için portaldaki Posta uygulamasını açın.'
			),
		lang
	);
}

/** Sent when an admin resets a member's password or a self-service reset is triggered. */
export async function notifyPasswordReset(
	user: Recipient,
	temporaryPassword?: string,
	langOverride?: Lang
): Promise<void> {
	const lang = getLang(user, langOverride);
	const subject =
		lang === 'en'
			? `Your Password Has Been Reset — ${getClubName()}`
			: `Hesap Şifreniz Sıfırlandı — ${getClubName()}`;

	await sendNotification(
		user,
		subject,
		(greeting, l) =>
			paragraph(greeting) +
			paragraph(
				temporaryPassword
					? l === 'en'
						? `Your account password was reset by community managers. Your new temporary password: <strong style="font-family: monospace; font-size: 15px; color: #0a84ff; background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${safeName(temporaryPassword)}</strong>`
						: `Hesap şifreniz topluluk yönetimi tarafından sıfırlandı. Yeni geçici şifreniz: <strong style="font-family: monospace; font-size: 15px; color: #0a84ff; background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${safeName(temporaryPassword)}</strong>`
					: l === 'en'
						? 'A password reset was performed for your account.'
						: 'Hesabınız için şifre sıfırlama işlemi gerçekleştirildi.'
			) +
			paragraph(
				l === 'en'
					? 'For security, please update your password after logging in from the Settings panel.'
					: 'Güvenliğiniz için sisteme giriş yaptıktan sonra Ayarlar panelinden şifrenizi güncellemenizi rica ederiz.'
			),
		lang
	);
}

/** Sent when a 2FA verification email or one-time code is dispatched. */
export async function notifyTwoFactorCode(
	user: Recipient,
	code: string,
	langOverride?: Lang
): Promise<void> {
	const lang = getLang(user, langOverride);
	const subject =
		lang === 'en'
			? `Your Two-Factor Authentication (2FA) Code: ${code} — ${getClubName()}`
			: `İki Aşamalı Doğrulama (2FA) Kodunuz: ${code} — ${getClubName()}`;

	await sendNotification(
		user,
		subject,
		(greeting, l) =>
			paragraph(greeting) +
			paragraph(
				l === 'en'
					? `Your login verification code: <strong style="font-family: monospace; font-size: 18px; letter-spacing: 2px; color: #0a84ff; background: #f3f4f6; padding: 4px 8px; border-radius: 4px;">${safeName(code)}</strong>`
					: `Giriş doğrulama kodunuz: <strong style="font-family: monospace; font-size: 18px; letter-spacing: 2px; color: #0a84ff; background: #f3f4f6; padding: 4px 8px; border-radius: 4px;">${safeName(code)}</strong>`
			) +
			paragraph(
				l === 'en'
					? 'This code is valid for 10 minutes. If you did not attempt to sign in, ignore this email.'
					: 'Bu kod 10 dakika boyunca geçerlidir. Giriş talebinde siz bulunmadıysanız bu e-postayı dikkate almayınız.'
			),
		lang
	);
}
