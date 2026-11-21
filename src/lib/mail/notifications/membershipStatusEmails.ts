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

function inlinePassHtml(password: string): string {
	const style =
		'font-family: monospace; font-size: 15px; color: #0a84ff; ' +
		'background: #f3f4f6; padding: 2px 6px; border-radius: 4px;';
	return `<strong style="${style}">${safeName(password)}</strong>`;
}

export async function notifyMembershipApproved(
	user: Recipient,
	langOverride?: Lang
): Promise<void> {
	const lang = getLang(user, langOverride);
	const subject = formatMailText(lang, 'mailApprovedSubject', { clubName: getClubName() });

	await sendNotification(
		user,
		subject,
		(greeting, l) =>
			paragraph(greeting) +
			paragraph(formatMailText(l, 'mailApprovedBody')) +
			paragraph(formatMailText(l, 'mailApproved2faHint')),
		lang
	);
}

export async function notifyMemberCreatedByAdmin(
	user: Recipient,
	temporaryPassword: string,
	langOverride?: Lang
): Promise<void> {
	const lang = getLang(user, langOverride);
	const subject = formatMailText(lang, 'mailAdminCreatedSubject', { clubName: getClubName() });
	const passHtml = inlinePassHtml(temporaryPassword);

	await sendNotification(
		user,
		subject,
		(greeting, l) =>
			paragraph(greeting) +
			paragraph(formatMailText(l, 'mailAdminCreatedBody', { passHtml })) +
			paragraph(formatMailText(l, 'mailAdminCreatedSecurityHint')),
		lang
	);
}

export async function notifyMembershipRejected(
	user: Recipient,
	langOverride?: Lang
): Promise<void> {
	const lang = getLang(user, langOverride);
	const subject = formatMailText(lang, 'mailRejectedSubject', { clubName: getClubName() });

	await sendNotification(
		user,
		subject,
		(greeting, l) => paragraph(greeting) + paragraph(formatMailText(l, 'mailRejectedBody')),
		lang
	);
}
