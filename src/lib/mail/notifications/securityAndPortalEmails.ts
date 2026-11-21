import type { MailerResult } from '../mailer';
import { safeName } from '../address';
import {
	formatMailText,
	getClubName,
	getLang,
	type Lang,
	paragraph,
	type Recipient,
	sendNotification,
} from './transport';

function dangerCodeHtml(code: string): string {
	const style =
		'font-family: monospace; font-size: 26px; font-weight: 700; letter-spacing: 6px; ' +
		'color: #ef4444; background: #fef2f2; padding: 10px 20px; border-radius: 8px; ' +
		'border: 1px solid #fecaca; display: inline-block;';
	return `<div style="text-align: center; margin: 20px 0;"><span style="${style}">${safeName(code)}</span></div>`;
}

function accentInlineCode(value: string, size = 15, spacing?: string): string {
	const extra = spacing ? ` letter-spacing: ${spacing};` : '';
	const style =
		`font-family: monospace; font-size: ${size}px;${extra} color: #0a84ff; ` +
		'background: #f3f4f6; padding: 3px 7px; border-radius: 4px;';
	return `<strong style="${style}">${safeName(value)}</strong>`;
}

export async function notifyPasswordResetCode(
	user: Recipient,
	code: string,
	langOverride?: Lang
): Promise<MailerResult> {
	const lang = getLang(user, langOverride);
	const subject = formatMailText(lang, 'mailPwResetCodeSubject', {
		code,
		clubName: getClubName(),
	});

	return sendNotification(
		user,
		subject,
		(greeting, l) =>
			paragraph(greeting) +
			paragraph(formatMailText(l, 'mailPwResetCodeBody')) +
			dangerCodeHtml(code) +
			paragraph(formatMailText(l, 'mailPwResetCodeExpiry')),
		lang
	);
}

export async function notifyPortalMessage(
	user: Recipient,
	fromName: string,
	messageSubject: string,
	langOverride?: Lang
): Promise<void> {
	const lang = getLang(user, langOverride);
	const cleanSubj = messageSubject.replace(/[\r\n]+/g, ' ').slice(0, 80);
	const subject = formatMailText(lang, 'mailPortalMessageSubject', {
		subject: cleanSubj,
		clubName: getClubName(),
	});

	await sendNotification(
		user,
		subject,
		(greeting, l) =>
			paragraph(greeting) +
			paragraph(
				formatMailText(l, 'mailPortalMessageBody', {
					fromName: safeName(fromName),
					subject: safeName(messageSubject),
				})
			) +
			paragraph(formatMailText(l, 'mailPortalMessageHint')),
		lang
	);
}

export async function notifyPasswordReset(
	user: Recipient,
	temporaryPassword?: string,
	langOverride?: Lang
): Promise<void> {
	const lang = getLang(user, langOverride);
	const subject = formatMailText(lang, 'mailPwResetTempSubject', { clubName: getClubName() });

	await sendNotification(
		user,
		subject,
		(greeting, l) => {
			const body = temporaryPassword
				? formatMailText(l, 'mailPwResetTempBody', {
						passHtml: accentInlineCode(temporaryPassword, 15),
				  })
				: formatMailText(l, 'mailPwResetDoneBody');
			const advice = formatMailText(l, 'mailPwResetAdvice');
			return paragraph(greeting) + paragraph(body) + paragraph(advice);
		},
		lang
	);
}

export async function notifyTwoFactorCode(
	user: Recipient,
	code: string,
	langOverride?: Lang
): Promise<void> {
	const lang = getLang(user, langOverride);
	const subject = formatMailText(lang, 'mail2faCodeSubject', {
		code,
		clubName: getClubName(),
	});
	const codeHtml = accentInlineCode(code, 18, '2px');

	await sendNotification(
		user,
		subject,
		(greeting, l) =>
			paragraph(greeting) +
			paragraph(formatMailText(l, 'mail2faCodeBody', { codeHtml })) +
			paragraph(formatMailText(l, 'mail2faCodeExpiry')),
		lang
	);
}
