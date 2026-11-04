/**
 * The portal's internal mail: limits, folders and the shapes the API and the
 * Mail app share. Pure (no imports), so it runs on the server, in the browser
 * and under plain Node (scripts/check-pure.mjs).
 */

/** The folders of the Mail app. `gonderilen` is a view of what the member wrote, not a place to file things. */
export const MAIL_FOLDERS = ['gelen', 'gonderilen', 'arsiv', 'cop'] as const;
export type MailFolder = (typeof MAIL_FOLDERS)[number];

/** Where a member has filed a conversation (stored per member). */
export type MailStorage = 'gelen' | 'gonderilen' | 'arsiv' | 'cop';

export const MAIL_SUBJECT_MAX = 120;
export const MAIL_BODY_MAX = 10_000;
export const MAIL_RECIPIENT_MAX = 20;
export const MAIL_PAGE_SIZE = 25;
/** The most people the recipient lookup returns for one search. */
export const MAIL_SEARCH_LIMIT = 20;
/** The longest search text the recipient lookup reads. */
export const MAIL_SEARCH_MAX = 64;
/** Messages a member may send per minute (new conversations and replies together). */
export const MAIL_PER_MINUTE_LIMIT = 20;

/** What the conversation endpoint's PATCH can do. */
export const MAIL_ACTIONS = ['okundu', 'okunmadi', 'arsivle', 'gelene', 'cope', 'sil'] as const;
export type MailAction = (typeof MAIL_ACTIONS)[number];

export interface MailPerson {
	id: string;
	name: string;
	surname: string;
}

export interface MailThreadSummary {
	id: string;
	topic: string;
	/** The newest message's time. */
	lastMessage: number;
	/** The newest message, cut to a line. */
	preview: string;
	lastSender: MailPerson;
	/** Everyone but the member. */
	attendees: MailPerson[];
	messageCount: number;
	/** Messages in it the member has not read. */
	unread: number;
}

export interface MailConversationList {
	folder: MailFolder;
	topics: MailThreadSummary[];
	total: number;
	page: number;
	pageSize: number;
	/** The server's clock when the list was built; "today" in the list is measured against it. */
	now: number;
	/** Conversations in the inbox with something unread, whatever folder is shown. */
	unread: number;
}

export interface MailMessage {
	id: string;
	sender: MailPerson;
	body: string;
	creation: number;
	okundu: boolean;
	myMi: boolean;
}

export interface MailConversation {
	id: string;
	topic: string;
	folder: MailStorage;
	attendees: MailPerson[];
	messages: MailMessage[];
}

/** A recipient the message did not reach, and why. */
export interface MailSkipped {
	id: string;
	name: string;
	/** `role`: the member's role does not open Mail. `pasif`: no longer an active member. */
	reason: 'role' | 'pasif';
}

export interface MailSendResult {
	threadId: string;
	messageId: string;
	skipped: MailSkipped[];
}

/** What the recipient picker gets: a name and an id, nothing else about the member (no e-mail address, department or student number). */
export interface MailRecipient extends MailPerson {
	/** False when the member's role does not open Mail: a message to them would not arrive. */
	reachable: boolean;
}

/** The recipient lookup's answer. `suggestion`: no search text was given, these are the people written with most recently. */
export interface MailRecipientList {
	/** The search text this answers, so a slow answer to an earlier text is not mistaken for the current one. */
	q: string;
	recipients: MailRecipient[];
	suggestion: boolean;
}

/** What the sender is told about a recipient the message did not reach. */
export function skippedReason(a: MailSkipped): string {
	return a.reason === 'role' ? `${a.name} kişisinin roleü Posta'yı açmıyor.` : `${a.name} artık aktif üye değil.`;
}

/** The first line of a message body, for lists and notifications. */
export function previewLine(body: string, max = 120): string {
	const line = body.replace(/\s+/g, ' ').trim();
	return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

export { previewLine as previewRow };
