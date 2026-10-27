import type { MailFolderInfo } from './types';

/**
 * Formats a timestamp for email list cards and detail headers according to active locale.
 */
export function formatMailDate(ts: number, locale: string, yesterdayLabel = 'Yesterday'): string {
	const now = new Date();
	const date = new Date(ts);

	const isToday =
		now.getDate() === date.getDate() &&
		now.getMonth() === date.getMonth() &&
		now.getFullYear() === date.getFullYear();

	if (isToday) {
		return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
	}

	const yesterday = new Date(now);
	yesterday.setDate(yesterday.getDate() - 1);
	const isYesterday =
		yesterday.getDate() === date.getDate() &&
		yesterday.getMonth() === date.getMonth() &&
		yesterday.getFullYear() === date.getFullYear();

	if (isYesterday) {
		return yesterdayLabel;
	}

	if (now.getFullYear() === date.getFullYear()) {
		return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
	}

	return date.toLocaleDateString(locale, { day: 'numeric', month: 'numeric', year: '2-digit' });
}

/**
 * Human-readable byte formatting.
 */
export function formatMailBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Maps standard IMAP mailbox roles to localized UI strings.
 */
export function getFolderDisplayName(
	folder: { id?: string; name: string; role?: MailFolderInfo['role'] },
	t: (k: string) => string
): string {
	switch (folder.role) {
		case 'inbox':
			return t('mailFolderInbox');
		case 'starred':
			return t('mailFolderStarred');
		case 'sent':
			return t('mailFolderSent');
		case 'drafts':
			return t('mailFolderDrafts');
		case 'trash':
			return t('mailFolderTrash');
		case 'spam':
			return t('mailFolderSpam');
		default:
			// If folder.id is INBOX or trash-like fallback
			if (folder.id?.toUpperCase() === 'INBOX') return t('mailFolderInbox');
			return folder.name;
	}
}
