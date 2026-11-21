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
export {
	notifyMembershipApproved,
	notifyMemberCreatedByAdmin,
	notifyMembershipRejected,
} from './membershipStatusEmails';

function codeBadgeHtml(code: string): string {
	const style =
		'font-family: monospace; font-size: 26px; font-weight: 700; letter-spacing: 6px; ' +
		'color: #0a84ff; background: #f0f7ff; padding: 10px 20px; border-radius: 8px; ' +
		'border: 1px solid #bfdbfe; display: inline-block;';
	return `<div style="text-align: center; margin: 20px 0;"><span style="${style}">${safeName(code)}</span></div>`;
}

export async function notifyRegistrationReceived(
	user: Recipient,
	customTemplate?: string,
	langOverride?: Lang
): Promise<void> {
	const lang = getLang(user, langOverride);
	const subject = formatMailText(lang, 'mailRegReceivedSubject', { clubName: getClubName() });

	await sendNotification(
		user,
		subject,
		(greeting, l) => {
			const fallbackBody = formatMailText(l, 'mailRegReceivedBodyFallback');
			const body = customTemplate?.trim() ? safeName(customTemplate) : fallbackBody;
			const hold = formatMailText(l, 'mailRegReceivedHold');
			return paragraph(greeting) + paragraph(body) + paragraph(hold);
		},
		lang
	);
}

export async function notifyEmailVerificationCode(
	user: Recipient,
	code: string,
	langOverride?: Lang
): Promise<MailerResult> {
	const lang = getLang(user, langOverride);
	const subject = formatMailText(lang, 'mailVerifySubject', { code, clubName: getClubName() });

	return sendNotification(
		user,
		subject,
		(greeting, l) =>
			paragraph(greeting) +
			paragraph(formatMailText(l, 'mailVerifyBody')) +
			codeBadgeHtml(code) +
			paragraph(formatMailText(l, 'mailVerifyExpiry')),
		lang
	);
}

export async function notifyEmailChangeCode(
	user: Recipient,
	code: string,
	langOverride?: Lang
): Promise<void> {
	const lang = getLang(user, langOverride);
	const subject = formatMailText(lang, 'mailEmailChangeSubject', {
		code,
		clubName: getClubName(),
	});

	await sendNotification(
		user,
		subject,
		(greeting, l) =>
			paragraph(greeting) +
			paragraph(formatMailText(l, 'mailEmailChangeBody')) +
			codeBadgeHtml(code) +
			paragraph(formatMailText(l, 'mailEmailChangeExpiry')),
		lang
	);
}

export async function notifyEmailChanged(
	user: Recipient,
	newEmail: string,
	langOverride?: Lang
): Promise<void> {
	const lang = getLang(user, langOverride);
	const subject = formatMailText(lang, 'mailEmailChangedSubject', { clubName: getClubName() });

	await sendNotification(
		user,
		subject,
		(greeting, l) =>
			paragraph(greeting) +
			paragraph(formatMailText(l, 'mailEmailChangedBody', { newEmail: safeName(newEmail) })),
		lang
	);
}
