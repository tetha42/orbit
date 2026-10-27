'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from '@/core/session';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import {
	MessageSquare,
	RefreshCw,
	ArrowLeft,
	MessageSquarePlus,
	UserPlus,
	Users,
} from 'lucide-react';
import { useIsMobile } from '@/lib/client/useClientValue';
import type { ChatMesajItem } from './types';
import { ChatMobileView } from './ChatMobileView';
import { useChat } from './hooks/useChat';
import { ChatRoomList } from './components/ChatRoomList';
import { ChatMessageList } from './components/ChatMessageList';
import { ChatMessageInput } from './components/ChatMessageInput';
import { NewChatModal } from './components/NewChatModal';
import { AddMemberModal } from './components/AddMemberModal';
import { GroupInfoModal } from './components/GroupInfoModal';
import { CreatePollModal } from './components/poll/CreatePollModal';
import { ForwardMessageModal } from './components/ForwardMessageModal';
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
		refreshRooms,
		createDm,
		createGroupDm,
		addMembers,
		createPoll,
		votePoll,
		closePoll,
		replyingMessage,
		setReplyingMessage,
		cancelReply,
		forwardMessage,
	} = useChat();

	const [mobileView, setMobileView] = useState<'rooms' | 'chat'>('rooms');
	const [isNewChatOpen, setIsNewChatOpen] = useState(false);
	const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
	const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
	const [isCreatePollOpen, setIsCreatePollOpen] = useState(false);
	const [editingMessage, setEditingMessage] = useState<ChatMesajItem | null>(null);
	const [forwardingMessage, setForwardingMessage] = useState<ChatMesajItem | null>(null);

	useEffect(() => {
		setEditingMessage(null);
		setForwardingMessage(null);
	}, [activeRoomId]);

	const handleSelectRoom = (odaId: string) => {
		selectRoom(odaId);
		setMobileView('chat');
	};

	if (!currentUser) return null;

	const isGroupOrTeam =
		activeRoom &&
		(activeRoom.tur === 'takim' ||
			(activeRoom.tur === 'ozel' && (activeRoom.memberCount || 0) > 2));

	return (
		<div className={s.container}>
			{/* Rooms Sidebar */}
			<div
				className={s.sidebar}
				style={{
					display:
						typeof window !== 'undefined' &&
						window.innerWidth < 768 &&
						mobileView === 'chat'
							? 'none'
							: 'flex',
				}}
			>
				<div className={s.sidebarHeader}>
					<div className={s.sidebarTitle}>
						<MessageSquare size={18} color="var(--accent)" />
						<span>{t('chatTitle')}</span>
					</div>

					<div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
						{/* WhatsApp "New Chat" button */}
						<button
							type="button"
							onClick={() => setIsNewChatOpen(true)}
							style={{
								background: 'var(--accent-subtle)',
								border: '1px solid var(--accent-border)',
								color: 'var(--accent)',
								cursor: 'pointer',
								padding: '5px 7px',
								borderRadius: '8px',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
							}}
							title={t('chatNewChat')}
						>
							<MessageSquarePlus size={15} />
						</button>

						<button
							type="button"
							onClick={refreshRooms}
							style={{
								background: 'transparent',
								border: 'none',
								color: 'rgba(255, 255, 255, 0.6)',
								cursor: 'pointer',
								padding: '5px',
							}}
							title={t('chatRefresh')}
						>
							<RefreshCw size={14} />
						</button>
					</div>
				</div>

				<ChatRoomList
					rooms={rooms}
					activeRoomId={activeRoomId}
					onSelectRoom={handleSelectRoom}
				/>
			</div>

			{/* Main Chat Conversation View */}
			<div
				className={s.mainChat}
				style={{
					display:
						typeof window !== 'undefined' &&
						window.innerWidth < 768 &&
						mobileView === 'rooms'
							? 'none'
							: 'flex',
				}}
			>
				{activeRoom ? (
					<>
						<div className={s.chatHeader}>
							<div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
								{typeof window !== 'undefined' && window.innerWidth < 768 && (
									<button
										type="button"
										onClick={() => setMobileView('rooms')}
										style={{
											background: 'rgba(255, 255, 255, 0.1)',
											border: 'none',
											borderRadius: '50%',
											width: '28px',
											height: '28px',
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
											color: '#fff',
											cursor: 'pointer',
											flexShrink: 0,
										}}
									>
										<ArrowLeft size={16} />
									</button>
								)}

								{/* Room Avatar */}
								<div
									style={{
										width: '34px',
										height: '34px',
										borderRadius: '50%',
										background: 'rgba(255, 255, 255, 0.1)',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										overflow: 'hidden',
										flexShrink: 0,
										color: 'var(--accent)',
										cursor: isGroupOrTeam ? 'pointer' : 'default',
									}}
									onClick={() => {
										if (isGroupOrTeam) setIsGroupInfoOpen(true);
									}}
								>
									{activeRoom.avatar ? (
										// eslint-disable-next-line @next/next/no-img-element
										<img
											src={activeRoom.avatar}
											alt={activeRoom.ad}
											style={{ width: '100%', height: '100%', objectFit: 'cover' }}
										/>
									) : isGroupOrTeam ? (
										<Users size={18} />
									) : activeRoom.tur === 'ozel' ? (
										<span style={{ fontSize: '13px', fontWeight: 700 }}>
											{(activeRoom.ad || '?').slice(0, 1).toUpperCase()}
										</span>
									) : (
										<MessageSquare size={18} />
									)}
								</div>

								<div
									style={{ minWidth: 0, cursor: isGroupOrTeam ? 'pointer' : 'default' }}
									onClick={() => {
										if (isGroupOrTeam) setIsGroupInfoOpen(true);
									}}
								>
									<div className={s.headerTitle} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
										{activeRoom.ad}
									</div>
									<div className={s.headerSub} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
										{activeRoom.tur === 'genel'
											? t('chatPublicSub')
											: activeRoom.tur === 'takim'
											? t('chatTeamSub')
											: activeRoom.memberCount && activeRoom.memberCount > 2
											? fill(t('chatTotalMembers'), { n: activeRoom.memberCount })
											: t('chatPrivateSub')}
									</div>
								</div>
							</div>

							{/* WhatsApp Top-Bar Actions */}
							<div className={s.headerActions}>
								{/* Add Member button (both in 1-on-1 and groups) */}
								<button
									type="button"
									className={s.headerIconBtn}
									onClick={() => setIsAddMemberOpen(true)}
									title={t('chatAddMembers')}
								>
									<UserPlus size={16} />
								</button>

								{/* Group Info button if group or team */}
								{isGroupOrTeam && (
									<button
										type="button"
										className={s.headerIconBtn}
										onClick={() => setIsGroupInfoOpen(true)}
										title={t('chatGroupInfo')}
									>
										<Users size={16} />
									</button>
								)}
							</div>
						</div>

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
						/>

						<ChatMessageInput
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
						<span style={{ fontSize: '12px' }}>
							{t('chatStartChatHint')}
						</span>
					</div>
				)}
			</div>

			{/* WhatsApp "New Chat" Modal */}
			<NewChatModal
				isOpen={isNewChatOpen}
				onClose={() => setIsNewChatOpen(false)}
				onSelectContact={async (targetUserId) => {
					const rId = await createDm(targetUserId);
					if (rId) setMobileView('chat');
				}}
				onCreateGroup={async (memberIds, title) => {
					const rId = await createGroupDm(memberIds, title);
					if (rId) setMobileView('chat');
				}}
			/>

			{/* "Add Member" Modal */}
			{activeRoom && (
				<AddMemberModal
					isOpen={isAddMemberOpen}
					onClose={() => setIsAddMemberOpen(false)}
					room={activeRoom}
					currentUserId={currentUser.id}
					onAddMembers={async (odaId, memberIds) => {
						await addMembers(odaId, memberIds);
					}}
					onCreateGroupWithCounterpart={async (memberIds, title) => {
						const rId = await createGroupDm(memberIds, title);
						if (rId) setMobileView('chat');
					}}
				/>
			)}

			{/* "Group Info" Modal */}
			{activeRoom && (
				<GroupInfoModal
					isOpen={isGroupInfoOpen}
					onClose={() => setIsGroupInfoOpen(false)}
					room={activeRoom}
					onOpenAddMembers={() => setIsAddMemberOpen(true)}
				/>
			)}

			{/* "Create Poll" Modal */}
			<CreatePollModal
				isOpen={isCreatePollOpen}
				onClose={() => setIsCreatePollOpen(false)}
				onSubmit={createPoll}
			/>

			{/* "Forward Message" Modal */}
			<ForwardMessageModal
				isOpen={Boolean(forwardingMessage)}
				onClose={() => setForwardingMessage(null)}
				message={forwardingMessage}
				rooms={rooms}
				onForward={forwardMessage}
			/>
		</div>
	);
}
