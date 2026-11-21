export type {
	MailFolderInfo,
	MailParticipant,
	MailMessageSummary,
	MailAttachmentMeta,
	MailMessageDetail,
	FolderMessagesResult,
} from './imap/types';
export { invalidateMailboxCache, createImapClient } from './imap/connection';
export { getMailboxes } from './imap/mailboxes';
export { getFolderMessages } from './imap/folderMessages';
export { getMessageDetail } from './imap/messageDetail';
export { performMailAction, emptyTrashFolder } from './imap/messageActions';
