'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from '@/core/session';
import { useI18n } from '@/core/i18n';
import { MessageSquare } from 'lucide-react';
import { useIsMobile } from '@/lib/client/useClientValue';
import type { ChatMessageItem } from './types';
import { ChatMobileView } from './ChatMobileView';
import { useChat } from './hooks/useChat';
import { ChatMessageList } from './components/ChatMessageList';
import { ChatMessageInput } from './components/ChatMessageInput';
import { ChatSidebar } from './components/ChatSidebar';
import { ChatRoomHeader } from './components/ChatRoomHeader';
import { ChatSearchDrawer } from './components/ChatSearchDrawer';
import { ChatModals } from './components/ChatModals';
import { startRoomVoiceCall } from './call/callStore';
import s from './Chat.module.css';

export function ChatApp() {
	const isMobile = useIsMobile();
	return isMobile ? <ChatMobileView /> : <ChatDesktopView />;
}

function ChatDesktopView() {
	const { currentUser, isAdmin } = useSession();
	const { t } = useI18n();
	const {
		rooms,
		activeRoom,
		activeRoomId,
		messages,
		loadingMessages,
		loadingOlderMessages,
		hasMoreMessages,
		loadOlderMessages,
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

	const [mobileView, setMobileView] = useState<'rooms' | 'chat'>('rooms');
	const [isNewChatOpen, setIsNewChatOpen] = useState(false);
	const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
	const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
	const [isCreatePollOpen, setIsCreatePollOpen] = useState(false);
	const [isRoomSearchOpen, setIsRoomSearchOpen] = useState(false);
	const [editingMessage, setEditingMessage] = useState<ChatMessageItem | null>(null);
	const [forwardingMessage, setForwardingMessage] = useState<ChatMessageItem | null>(null);

	useEffect(() => {
		setEditingMessage(null);
		setForwardingMessage(null);
		setIsRoomSearchOpen(false);
	}, [activeRoomId]);

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f' && activeRoomId) {
				e.preventDefault();
				setIsRoomSearchOpen((v) => !v);
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [activeRoomId]);

	const handleSelectRoom = (roomId: string) => {
		selectRoom(roomId);
		setMobileView('chat');
	};

	if (!currentUser) return null;

	const isGroupOrTeam = Boolean(
		activeRoom &&
			(activeRoom.typeValue === 'team' ||
				(activeRoom.typeValue === 'private' && (activeRoom.memberCount || 0) > 2))
	);

	const isCompactViewport = typeof window !== 'undefined' && window.innerWidth < 768;

	return (
		<div className={s.container}>
			<ChatSidebar
				rooms={rooms}
				activeRoomId={activeRoomId}
				hiddenOnMobile={isCompactViewport && mobileView === 'chat'}
				onSelectRoom={handleSelectRoom}
				onOpenNewChat={() => setIsNewChatOpen(true)}
				onRefreshRooms={refreshRooms}
				onJumpToHit={(rId, msgId) => {
					focusMessageInRoom(rId, msgId);
					setMobileView('chat');
				}}
			/>

			<div
				className={s.mainChat}
				style={{ display: isCompactViewport && mobileView === 'rooms' ? 'none' : 'flex' }}
			>
				{activeRoom ? (
					<>
						<ChatRoomHeader
							activeRoom={activeRoom}
							isGroupOrTeam={isGroupOrTeam}
							onMobileBack={() => setMobileView('rooms')}
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

						<ChatMessageList
							messages={messages}
							currentUserId={currentUser.id}
							isAdmin={isAdmin}
							loading={loadingMessages}
							hasMore={hasMoreMessages}
							loadingOlder={loadingOlderMessages}
							onLoadOlder={loadOlderMessages}
							onStartEdit={(msg) => setEditingMessage(msg)}
							onDelete={deleteMessage}
							onReply={(msg) => setReplyingMessage(msg)}
							onForward={(msg) => setForwardingMessage(msg)}
							onVotePoll={votePoll}
							onClosePoll={closePoll}
							focusedMessageId={focusedMessageId}
							onFocusMessageHandled={clearFocusedMessage}
						/>

						<ChatMessageInput
							roomId={activeRoomId}
							onSendMessage={sendMessage}
							editingMessage={editingMessage}
							onSaveEdit={editMessage}
							onCancelEdit={() => setEditingMessage(null)}
							replyingMessage={replyingMessage}
							onCancelReply={cancelReply}
							onOpenPollModal={() => setIsCreatePollOpen(true)}
							isAdmin={isAdmin}
						/>
					</>
				) : (
					<div className={s.emptyState}>
						<MessageSquare size={48} opacity={0.3} />
						<span style={{ fontSize: '15px', fontWeight: 600 }}>{t('chatStartChatPrompt')}</span>
						<span style={{ fontSize: '12px' }}>{t('chatStartChatHint')}</span>
					</div>
				)}
			</div>

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
					if (rId) setMobileView('chat');
				}}
			/>
		</div>
	);
}
