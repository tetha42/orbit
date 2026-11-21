import { sendMail, wasDelivered, type MailerResult } from '../mailer';
import { safeName, safeRecipient } from '../address';
import { CONFIG } from '@/server/config';
import { TRANSLATIONS } from '@/lib/i18n';
import { fill } from '@/lib/text';

export interface Recipient {
	firstName?: string;
	lastName?: string;
	name?: string;
	surname?: string;
	email: string;
	preferredLanguage?: 'tr' | 'en';
}

export type Lang = 'tr' | 'en';

const SUPPORTED_MAIL_LANGS = new Set<Lang>(['en', 'tr']);

export function getLang(user: Recipient, override?: Lang): Lang {
	const candidate = override ?? user.preferredLanguage;
	return candidate && SUPPORTED_MAIL_LANGS.has(candidate) ? candidate : 'en';
}

export function formatMailText(
	lang: Lang,
	key: string,
	vars: Record<string, string | number> = {}
): string {
	const dict = TRANSLATIONS[lang] ?? TRANSLATIONS.en;
	return fill(dict[key] || TRANSLATIONS.en[key] || key, vars);
}

export const getClubName = () => CONFIG.clubPreset.name || 'Orbit Community';

function shell(bodyHtml: string): string {
	const communityName = CONFIG.clubPreset.name || 'Orbit Community';
	const domain = CONFIG.clubPreset.domain || 'orbit.local';
	const boxStyle =
		"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; " +
		'max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; ' +
		'border-radius: 12px; background: #ffffff; color: #111827;';
	const footerStyle =
		'border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 20px; ' +
		'font-size: 12px; color: #9ca3af; text-align: center;';
	return `
		<div style="${boxStyle}">
			<h2 style="color: #0a84ff; margin: 0 0 16px 0;">${communityName}</h2>
			${bodyHtml}
			<div style="${footerStyle}">
				${communityName} OS by tetha42 • ${domain}
			</div>
		</div>
	`;
}

export function paragraph(text: string): string {
	return `<p style="font-size: 14px; line-height: 1.6; color: #374151; margin: 0 0 12px 0;">${text}</p>`;
}

export async function sendNotification(
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
	const first = user.firstName || user.name || '';
	const last = user.lastName || user.surname || '';
	const greeting = formatMailText(lang, 'mailGreeting', {
		first: safeName(first),
		last: safeName(last),
	});

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
