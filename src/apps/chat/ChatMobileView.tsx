'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useSession } from '@/core/session';
import { useChat } from './hooks/useChat';
import { ChatModals } from './components/ChatModals';
import { ChatMobileRoomsScreen } from './components/mobile/ChatMobileRoomsScreen';
import { ChatMobileConvHeader } from './components/mobile/ChatMobileConvHeader';
import { ChatMobileMessageList } from './components/mobile/ChatMobileMessageList';
import { ChatMobileComposer } from './components/mobile/ChatMobileComposer';
import { ChatSearchDrawer } from './components/ChatSearchDrawer';
import { startRoomVoiceCall } from './call/callStore';
import { useChatMobileRooms } from './components/mobile/useChatMobileRooms';
import type { ChatMobileTab } from './components/mobile/ChatMobileTabBar';
import type { ChatMessageItem } from './types';
import { useMobileSubView } from '@/lib/client/useMobileSubView';
import s from './ChatMobile.module.css';

/**
 * Mobile view for the Chat application.
 * Designed with the desktop macOS/Cupertino theme tokens (dark frosted panels, Apple green accents).
 */
export function ChatMobileView() {
	const { currentUser, isAdmin } = useSession();
	const {
		rooms,
		activeRoom,
		activeRoomId,
		messages,
		loadingMessages,
		loadingOlderMessages,
		hasMoreMessages,
		loadOlderMessages,
		sending,
		sendMessage,
		deleteMessage,
		editMessage,
		selectRoom,
		focusMessageInRoom,
		refreshRooms,
		createDm,
		createGroupDm,
		addMembers,
		createPoll,
		votePoll,
		closePoll,
		replyingMessage,
		focusedMessageId,
		clearFocusedMessage,
		setReplyingMessage,
		cancelReply,
		forwardMessage,
	} = useChat();

	const [activeTab, setActiveTab] = useState<ChatMobileTab>('all');
	const listScrollRef = useRef<HTMLDivElement>(null);
	const composerInputRef = useRef<HTMLInputElement>(null);
	const [screen, setScreen] = useState<'rooms' | 'chat'>('rooms');
	useMobileSubView(screen === 'chat');
	const [searchQuery, setSearchQuery] = useState('');
	const [isNewChatOpen, setIsNewChatOpen] = useState(false);
	const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
	const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
	const [isCreatePollOpen, setIsCreatePollOpen] = useState(false);
	const [isRoomSearchOpen, setIsRoomSearchOpen] = useState(false);
	const [activeActionsId, setActiveActionsId] = useState<string | null>(null);
	const [editingMessage, setEditingMessage] = useState<ChatMessageItem | null>(null);
	const [forwardingMessage, setForwardingMessage] = useState<ChatMessageItem | null>(null);

	useEffect(() => {
		setEditingMessage(null);
		setForwardingMessage(null);
		setActiveActionsId(null);
	}, [activeRoomId]);

	useEffect(() => {
		if (focusedMessageId) setScreen('chat');
	}, [focusedMessageId]);

	const {
		filteredRooms,
		generalRooms,
		teamRooms,
		customRooms,
		totalUnreadCount,
		unreadDirectCount,
		unreadChannelsCount,
		unreadTeamsCount,
	} = useChatMobileRooms(rooms, searchQuery);

	const handleTabChange = (tabId: ChatMobileTab) => {
		if (tabId === 'new') {
			setIsNewChatOpen(true);
			return;
		}
		if (activeTab === tabId) {
			listScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
		} else {
			setActiveTab(tabId);
			listScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
		}
	};

	if (!currentUser) return null;

	const isGroupOrTeam = Boolean(
		activeRoom &&
			(activeRoom.typeValue === 'team' ||
				(activeRoom.typeValue === 'private' && (activeRoom.memberCount || 0) > 2))
	);

	const openRoom = (id: string) => {
		selectRoom(id);
		setScreen('chat');
	};

	const modals = (
		<ChatModals
			currentUserId={currentUser.id}
			rooms={rooms}
			activeRoom={activeRoom}
			isNewChatOpen={isNewChatOpen}
			onCloseNewChat={() => setIsNewChatOpen(false)}
			isAddMemberOpen={isAddMemberOpen}
			onOpenAddMember={() => setIsAddMemberOpen(true)}
			onCloseAddMember={() => setIsAddMemberOpen(false)}
			isGroupInfoOpen={isGroupInfoOpen}
			onCloseGroupInfo={() => setIsGroupInfoOpen(false)}
			isCreatePollOpen={isCreatePollOpen}
			onCloseCreatePoll={() => setIsCreatePollOpen(false)}
			forwardingMessage={forwardingMessage}
			onCloseForward={() => setForwardingMessage(null)}
			createDm={createDm}
			createGroupDm={createGroupDm}
			addMembers={addMembers}
			createPoll={createPoll}
			forwardMessage={forwardMessage}
			onRoomCreated={(rId) => {
				if (rId) setScreen('chat');
			}}
		/>
	);

	if (screen === 'rooms' || !activeRoom) {
		return (
			<ChatMobileRoomsScreen
				activeTab={activeTab}
				searchQuery={searchQuery}
				onSearchChange={setSearchQuery}
				listScrollRef={listScrollRef}
				filteredRooms={filteredRooms}
				generalRooms={generalRooms}
				teamRooms={teamRooms}
				customRooms={customRooms}
				totalUnreadCount={totalUnreadCount}
				unreadDirectCount={unreadDirectCount}
				unreadChannelsCount={unreadChannelsCount}
				unreadTeamsCount={unreadTeamsCount}
				onOpenRoom={openRoom}
				onOpenNewChat={() => setIsNewChatOpen(true)}
				onRefreshRooms={refreshRooms}
				onTabChange={handleTabChange}
				modals={modals}
			/>
		);
	}

	return (
		<div className={s.root}>
			<ChatMobileConvHeader
				activeRoom={activeRoom}
				isGroupOrTeam={isGroupOrTeam}
				onBack={() => setScreen('rooms')}
				onOpenAddMember={() => setIsAddMemberOpen(true)}
				onOpenGroupInfo={() => setIsGroupInfoOpen(true)}
				onToggleSearch={() => setIsRoomSearchOpen((v) => !v)}
				onStartCall={() => void startRoomVoiceCall(activeRoom.id, currentUser.id)}
			/>
			<ChatSearchDrawer
				roomId={activeRoom.id}
				isOpen={isRoomSearchOpen}
				onClose={() => setIsRoomSearchOpen(false)}
				onJumpToHit={(rId, msgId) => focusMessageInRoom(rId, msgId)}
			/>

			<ChatMobileMessageList
				screen={screen}
				messages={messages}
				currentUserId={currentUser.id}
				isAdmin={Boolean(isAdmin)}
				loadingMessages={loadingMessages}
				hasMoreMessages={hasMoreMessages}
				loadingOlderMessages={loadingOlderMessages}
				loadOlderMessages={loadOlderMessages}
				focusedMessageId={focusedMessageId}
				clearFocusedMessage={clearFocusedMessage}
				activeActionsId={activeActionsId}
				setActiveActionsId={setActiveActionsId}
				onReply={(msg) => {
					setReplyingMessage(msg);
					composerInputRef.current?.focus();
				}}
				onForward={(msg) => setForwardingMessage(msg)}
				onStartEdit={(msg) => {
					setEditingMessage(msg);
					composerInputRef.current?.focus();
				}}
				onDelete={deleteMessage}
				onVotePoll={votePoll}
				onClosePoll={closePoll}
			/>

			<ChatMobileComposer
				activeRoomId={activeRoomId}
				isAdmin={Boolean(isAdmin)}
				sending={sending}
				editingMessage={editingMessage}
				replyingMessage={replyingMessage}
				onCancelEdit={() => setEditingMessage(null)}
				onCancelReply={cancelReply}
				onSendMessage={sendMessage}
				onEditMessage={editMessage}
				onOpenPollModal={() => setIsCreatePollOpen(true)}
				inputRef={composerInputRef}
			/>

			{modals}
		</div>
	);
}
