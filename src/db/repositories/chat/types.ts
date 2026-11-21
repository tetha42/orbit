import type { ChatPollItem } from '@/apps/chat/types';

export interface ChatRoom {
	id: string;
	typeValue: 'general' | 'team' | 'private';
	teamId: string | null;
	name: string;
	creation: number;
	avatar?: string | null;
	peerUserId?: string | null;
	memberCount?: number;
	lastMessage?: ChatMessageRecord | null;
	unreadCount?: number;
}

export interface QuotedMessageSnapshot {
	id: string;
	senderName: string;
	content: string;
}

export interface ChatMessageRecord {
	id: string;
	roomId: string;
	senderId: string;
	senderName: string;
	senderPhoto: string | null;
	content: string;
	attachments: Array<{ name: string; url: string; size?: number; type?: string; pollId?: string }>;
	date: number;
	deletionDate?: number | null;
	editDate?: number | null;
	poll?: ChatPollItem | null;
	repliedMessageId?: string | null;
	repliedMessage?: QuotedMessageSnapshot | null;
	isDelivered?: boolean;
}

export interface UnreadChatRoomSummary {
	id: string;
	topic: string;
	at: number;
	unread: number;
	messageId: string;
	sender: { name: string; surname: string };
}

export interface ChatMessageCursor {
	date: number;
	id: string;
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

export interface RawPollOption {
	id: string;
	text: string;
	sortOrder?: number;
}

export interface RawPollVote {
	optionId: string;
	userId: string;
	userName?: string;
	userAvatar?: string | null;
	votedAt?: number;
}
