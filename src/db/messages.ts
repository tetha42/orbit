export {
	ensureMailSchema,
	getMailMembers,
	searchMailCandidates,
	getRecentMailThreads,
	getMailCandidate,
	getMailCandidateRoles,
	getMailEmailSetting,
	setMailEmailSetting,
	type MailMember,
	type MailCandidate,
} from './messages/recipients';
export { getMailThreads } from './messages/threadList';
export {
	getUnreadMailCount,
	getUnreadMailThreads,
	getMailThread,
	getMailParticipantIds,
	getMailSearchThreads,
	type UnreadMailThread,
	type MailThreadDetail,
	type MailSearchThread,
} from './messages/queries';
export {
	createMailThread,
	addMailReply,
	setMailThreadStatus,
	type MailStatusAction,
} from './messages/mutations';
