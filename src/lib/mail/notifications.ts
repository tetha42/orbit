import { sendMail, wasDelivered } from './mailer';
import { safeName, safeRecipient } from './address';
import { CONFIG } from '@/lib/server/config';

/**
 * Transactional emails triggered by account lifecycle events.
 *
 * Every function is fire-and-forget: a mail failure must never break the request
 * that triggered it, so errors are logged and swallowed.
 *
 * Safety: the recipient is re-validated at send time and every interpolated value
 * is escaped. `/api/auth/register` is unauthenticated, so without that an attacker
 * could choose the recipient list and inject markup into club-branded mail.
 */

interface Recipient {
	ad: string;
	soyad: string;
	email: string;
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
	bodyFor: (greeting: string) => string
): Promise<void> {
	const to = safeRecipient(user.email);
	if (!to) {
		// Address is missing or unsafe (multi-recipient list, CRLF, malformed).
		console.warn(`[notify] Geçersiz alıcı adresi, bildirim atlandı: ${String(user.email).slice(0, 60)}`);
		return;
	}

	const greeting = `Merhaba ${safeName(user.ad)} ${safeName(user.soyad)},`;

	try {
		const result = await sendMail({ to, subject, html: shell(bodyFor(greeting)) });

		if (!wasDelivered(result)) {
			// Distinguish "no SMTP configured" from a real send failure — the previous
			// message claimed the former for both.
			const reason = result.simulated
				? 'SMTP yapılandırılmamış'
				: `gönderim hatası: ${result.error ?? 'bilinmeyen'}`;
			console.warn(`[notify] Bildirim gönderilemedi (${reason}): ${to}`);
		}
	} catch (error) {
		console.error('[notify] sendNotification failed:', error);
	}
}

const getClubName = () => CONFIG.clubPreset.name || 'Orbit Community';

/** Sent the moment a membership application is submitted. */
export async function notifyRegistrationReceived(user: Recipient, customTemplate?: string): Promise<void> {
	await sendNotification(
		user,
		`Başvurunuz alındı — ${getClubName()}`,
		(greeting) =>
			paragraph(greeting) +
			paragraph(
				customTemplate && customTemplate.trim()
					? safeName(customTemplate)
					: 'Topluluk üyelik başvurunuz alındı. Yönetim incelemesinin ardından hesabınız aktifleştirilecek ve bu adrese bilgi verilecektir.'
			) +
			paragraph('Başvurunuz onaylanana kadar panele giriş yapamazsınız.')
	);
}

/** Sent when a user registers to verify their email address. */
export async function notifyEmailVerificationCode(user: Recipient, code: string): Promise<void> {
	await sendNotification(
		user,
		`E-posta Doğrulama Kodunuz: ${code} — ${getClubName()}`,
		(greeting) =>
			paragraph(greeting) +
			paragraph(
				'Topluluk üyelik başvurunuzu tamamlamak için lütfen aşağıdaki 6 haneli doğrulama kodunu kullanın:'
			) +
			`<div style="text-align: center; margin: 20px 0;">
				<span style="font-family: monospace; font-size: 26px; font-weight: 700; letter-spacing: 6px; color: #0a84ff; background: #f0f7ff; padding: 10px 20px; border-radius: 8px; border: 1px solid #bfdbfe; display: inline-block;">${safeName(code)}</span>
			</div>` +
			paragraph('Bu kod 15 dakika boyunca geçerlidir. Başvuru talebini siz başlatmadıysanız bu e-postayı dikkate almayınız.')
	);
}

/** Sent when a user requests a password reset code. */
export async function notifyPasswordResetCode(user: Recipient, code: string): Promise<void> {
	await sendNotification(
		user,
		`Şifre Sıfırlama Kodunuz: ${code} — ${getClubName()}`,
		(greeting) =>
			paragraph(greeting) +
			paragraph(
				'Hesap şifrenizi sıfırlamak için talepte bulundunuz. Yeni şifrenizi belirlemek için aşağıdaki 6 haneli kodu girin:'
			) +
			`<div style="text-align: center; margin: 20px 0;">
				<span style="font-family: monospace; font-size: 26px; font-weight: 700; letter-spacing: 6px; color: #ef4444; background: #fef2f2; padding: 10px 20px; border-radius: 8px; border: 1px solid #fecaca; display: inline-block;">${safeName(code)}</span>
			</div>` +
			paragraph('Bu kod 15 dakika boyunca geçerlidir. Talebi siz yapmadıysanız şifreniz değişmemiştir, güvenliğiniz için topluluk yönetimine bilgi veriniz.')
	);
}

/** Sent when club management approves an application. */
export async function notifyMembershipApproved(user: Recipient): Promise<void> {
	await sendNotification(
		user,
		`Üyeliğiniz onaylandı — ${getClubName()}`,
		(greeting) =>
			paragraph(greeting) +
			paragraph(
				'Topluluk üyelik başvurunuz onaylandı. Artık panelinize kayıt sırasında belirlediğiniz şifreyle giriş yapabilirsiniz.'
			) +
			paragraph(
				'Girişlerinizi Google Authenticator ile korumanızı öneririz: Ayarlar → Güvenlik & 2FA.'
			)
	);
}

/** Sent when an administrator manually creates a member account from the Members directory. */
export async function notifyMemberCreatedByAdmin(user: Recipient, temporaryPassword: string): Promise<void> {
	await sendNotification(
		user,
		`Topluluk Hesabınız Oluşturuldu — ${getClubName()}`,
		(greeting) =>
			paragraph(greeting) +
			paragraph(
				`Topluluk yönetimi tarafından hesabınız oluşturuldu. Sisteme giriş yapmak için geçici şifreniz: <strong style="font-family: monospace; font-size: 15px; color: #0a84ff; background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${safeName(temporaryPassword)}</strong>`
			) +
			paragraph(
				'Güvenliğiniz için ilk girişinizin ardından Ayarlar → Güvenlik & 2FA bölümünden şifrenizi güncellemenizi ve iki adımlı doğrulamayı etkinleştirmenizi öneririz.'
			)
	);
}

/** Sent when club management declines an application. */
export async function notifyMembershipRejected(user: Recipient): Promise<void> {
	await sendNotification(
		user,
		`Başvurunuz hakkında — ${getClubName()}`,
		(greeting) =>
			paragraph(greeting) +
			paragraph(
				'Topluluk üyelik başvurunuz bu dönem için onaylanmadı. Sorularınız için topluluk yönetimiyle iletişime geçebilirsiniz.'
			)
	);
}

/**
 * Sent to a member who asked to be told by e-mail when a portal message arrives
 * (Mail app → "E-postayla da haber ver"). Only the sender and the subject are in
 * it — the message itself is read in the portal.
 */
export async function notifyPortalMessage(user: Recipient, fromName: string, subject: string): Promise<void> {
	await sendNotification(
		user,
		`Yeni mesaj: ${subject.replace(/[\r\n]+/g, ' ').slice(0, 80)} — ${getClubName()}`,
		(greeting) =>
			paragraph(greeting) +
			paragraph(`${safeName(fromName)} size portalda bir mesaj gönderdi: <strong>${safeName(subject)}</strong>`) +
			paragraph('Mesajı okumak ve yanıtlamak için portaldaki Posta uygulamasını açın.')
	);
}

/** Sent when an admin resets a member's password or a self-service reset is triggered. */
export async function notifyPasswordReset(user: Recipient, temporaryPassword?: string): Promise<void> {
	await sendNotification(
		user,
		`Hesap Şifreniz Sıfırlandı — ${getClubName()}`,
		(greeting) =>
			paragraph(greeting) +
			paragraph(
				temporaryPassword
					? `Hesap şifreniz topluluk yönetimi tarafından sıfırlandı. Yeni geçici şifreniz: <strong style="font-family: monospace; font-size: 15px; color: #0a84ff; background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${safeName(temporaryPassword)}</strong>`
					: 'Hesabınız için şifre sıfırlama işlemi gerçekleştirildi.'
			) +
			paragraph('Güvenliğiniz için sisteme giriş yaptıktan sonra Ayarlar panelinden şifrenizi güncellemenizi rica ederiz.')
	);
}

/** Sent when a 2FA verification email or one-time code is dispatched. */
export async function notifyTwoFactorCode(user: Recipient, code: string): Promise<void> {
	await sendNotification(
		user,
		`İki Aşamalı Doğrulama (2FA) Kodunuz: ${code} — ${getClubName()}`,
		(greeting) =>
			paragraph(greeting) +
			paragraph(
				`Giriş doğrulama kodunuz: <strong style="font-family: monospace; font-size: 18px; letter-spacing: 2px; color: #0a84ff; background: #f3f4f6; padding: 4px 8px; border-radius: 4px;">${safeName(code)}</strong>`
			) +
			paragraph('Bu kod 10 dakika boyunca geçerlidir. Giriş talebinde siz bulunmadıysanız bu e-postayı dikkate almayınız.')
	);
}
