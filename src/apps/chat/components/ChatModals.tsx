'use client';

import React from 'react';
import type { ChatMessageItem, ChatRoomItem } from '../types';
import { NewChatModal } from './NewChatModal';
import { AddMemberModal } from './AddMemberModal';
import { GroupInfoModal } from './GroupInfoModal';
import { CreatePollModal } from './poll/CreatePollModal';
import { ForwardMessageModal } from './ForwardMessageModal';

interface ChatModalsProps {
	currentUserId: string;
	rooms: ChatRoomItem[];
	activeRoom: ChatRoomItem | null;
	isNewChatOpen: boolean;
	onCloseNewChat: () => void;
	isAddMemberOpen: boolean;
	onOpenAddMember: () => void;
	onCloseAddMember: () => void;
	isGroupInfoOpen: boolean;
	onCloseGroupInfo: () => void;
	isCreatePollOpen: boolean;
	onCloseCreatePoll: () => void;
	forwardingMessage: ChatMessageItem | null;
	onCloseForward: () => void;
	createDm: (targetUserId: string) => Promise<string | null>;
	createGroupDm: (memberIds: string[], title?: string) => Promise<string | null>;
	addMembers: (roomId: string, memberIds: string[]) => Promise<boolean>;
	createPoll: (pollData: {
		question: string;
		options: string[];
		multipleSelection: boolean;
		anonymous: boolean;
		endsAt: number | null;
	}) => Promise<boolean>;
	forwardMessage: (messageId: string, targetRoomIds: string[]) => Promise<{ ok: boolean; count?: number }>;
	onRoomCreated: (roomId: string | null) => void;
}

export function ChatModals({
	currentUserId,
	rooms,
	activeRoom,
	isNewChatOpen,
	onCloseNewChat,
	isAddMemberOpen,
	onOpenAddMember,
	onCloseAddMember,
	isGroupInfoOpen,
	onCloseGroupInfo,
	isCreatePollOpen,
	onCloseCreatePoll,
	forwardingMessage,
	onCloseForward,
	createDm,
	createGroupDm,
	addMembers,
	createPoll,
	forwardMessage,
	onRoomCreated,
}: ChatModalsProps) {
	return (
		<>
			<NewChatModal
				isOpen={isNewChatOpen}
				onClose={onCloseNewChat}
				onSelectContact={async (targetUserId) => {
					const rId = await createDm(targetUserId);
					onRoomCreated(rId);
				}}
				onCreateGroup={async (memberIds, title) => {
					const rId = await createGroupDm(memberIds, title);
					onRoomCreated(rId);
				}}
			/>

			{activeRoom && (
				<AddMemberModal
					isOpen={isAddMemberOpen}
					onClose={onCloseAddMember}
					room={activeRoom}
					currentUserId={currentUserId}
					onAddMembers={async (roomId, memberIds) => {
						await addMembers(roomId, memberIds);
					}}
					onCreateGroupWithCounterpart={async (memberIds, title) => {
						const rId = await createGroupDm(memberIds, title);
						onRoomCreated(rId);
					}}
				/>
			)}

			{activeRoom && (
				<GroupInfoModal
					isOpen={isGroupInfoOpen}
					onClose={onCloseGroupInfo}
					room={activeRoom}
					onOpenAddMembers={onOpenAddMember}
				/>
			)}

			<CreatePollModal
				isOpen={isCreatePollOpen}
				onClose={onCloseCreatePoll}
				onSubmit={createPoll}
			/>

			<ForwardMessageModal
				isOpen={Boolean(forwardingMessage)}
				onClose={onCloseForward}
				message={forwardingMessage}
				rooms={rooms}
				onForward={forwardMessage}
			/>
		</>
	);
}
