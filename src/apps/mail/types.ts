import type { MailFolderInfo, MailMessageSummary, MailMessageDetail, MailAttachmentMeta } from '@/lib/mail/imap';

export type { MailFolderInfo, MailMessageSummary, MailMessageDetail, MailAttachmentMeta };

export interface MailState {
	folders: MailFolderInfo[];
	activeFolder: string;
	messages: MailMessageSummary[];
	selectedUid: number | null;
	activeMessage: MailMessageDetail | null;
	isLoadingFolders: boolean;
	isLoadingList: boolean;
	isLoadingDetail: boolean;
	searchQuery: string;
	page: number;
	totalMessages: number;
	userEmail: string;
	isComposeOpen: boolean;
	composeInitial?: {
		to?: string;
		subject?: string;
		body?: string;
		replyToUid?: number;
	};
	error: string | null;
}
