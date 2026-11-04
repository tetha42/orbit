export interface ChatRoomItem {
	id: string;
	typeValue: 'genel' | 'takim' | 'ozel';
	teamId: string | null;
	name: string;
	creation: number;
	avatar?: string | null;
	peerUserId?: string | null;
	memberCount?: number;
	lastMessage?: ChatMessageItem | null;
	unreadCount?: number;
}

export interface ChatPollOptionItem {
	id: string;
	pollId: string;
	order: number;
	text: string;
	voteCount: number;
	percent: number;
	voteGivers?: Array<{ id: string; name: string; photo?: string | null }>;
}

export interface ChatPollItem {
	id: string;
	messageId: string;
	roomId: string;
	creatorId: string;
	creatorName?: string;
	question: string;
	multipleSelection: boolean;
	anonymous: boolean;
	endsAt: number | null;
	kapali: boolean;
	creation: number;
	options: ChatPollOptionItem[];
	totalVote: number;
	userVotes: string[];
}

export interface QuotedMessageSnapshot {
	id: string;
	senderName: string;
	content: string;
}

export interface ChatAttachmentItem {
	name: string;
	url: string;
	size?: number;
	tip?: string;
}

export interface ChatMessageItem {
	id: string;
	roomId: string;
	senderId: string;
	senderName: string;
	senderPhoto: string | null;
	content: string;
	attachments: ChatAttachmentItem[];
	date: number;
	deletionDate?: number | null;
	editDate?: number | null;
	poll?: ChatPollItem | null;
	repliedMessageId?: string | null;
	repliedMessage?: QuotedMessageSnapshot | null;
	deliveredMi?: boolean;
}

export interface ChatContactItem {
	id: string;
	name: string;
	surname: string;
	profilePhoto: string | null;
	roleName: string | null;
	department: string;
}

export interface ChatRoomMemberItem {
	id: string;
	firstName?: string;
	lastName?: string;
	avatarUrl?: string | null;
	roleName?: string | null;
	department?: string;
	name: string;
	surname: string;
	profilePhoto: string | null;
}
