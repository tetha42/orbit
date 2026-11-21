export interface MailFolderInfo {
	id: string;
	role: 'inbox' | 'starred' | 'sent' | 'drafts' | 'trash' | 'spam' | 'other';
	name: string;
	unread: number;
	total: number;
}

export interface MailParticipant {
	name: string;
	address: string;
}

export interface MailMessageSummary {
	uid: number;
	id: string;
	folder: string;
	subject: string;
	from: MailParticipant;
	to: MailParticipant[];
	date: number;
	seen: boolean;
	flagged: boolean;
	hasAttachments: boolean;
	snippet: string;
}

export interface MailAttachmentMeta {
	filename: string;
	contentType: string;
	size: number;
	checksum?: string;
}

export interface MailMessageDetail extends MailMessageSummary {
	html: string;
	text: string;
	cc: MailParticipant[];
	bcc: MailParticipant[];
	attachments: MailAttachmentMeta[];
}

export interface FolderMessagesResult {
	folder: string;
	page: number;
	pageSize: number;
	total: number;
	messages: MailMessageSummary[];
}
