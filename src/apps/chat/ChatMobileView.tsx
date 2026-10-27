'use client';

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
	ChevronLeft,
	MessageSquare,
	MessageSquarePlus,
	RefreshCw,
	Search,
	Send,
	UserPlus,
	Users,
	X,
	Pencil,
	Trash2,
	Check,
	Plus,
	Hash,
	PlusCircle,
	Reply,
	Forward,
} from 'lucide-react';
import { useSession } from '@/core/session';
import { useI18n } from '@/core/i18n';
import { useDialog } from '@/components/Common/DialogProvider';
import { fill } from '@/lib/text';
import { useChat } from './hooks/useChat';
import { NewChatModal } from './components/NewChatModal';
import { AddMemberModal } from './components/AddMemberModal';
import { GroupInfoModal } from './components/GroupInfoModal';
import { ComposerActionsMenu } from './components/composer/ComposerActionsMenu';
import { CreatePollModal } from './components/poll/CreatePollModal';
import { PollMessageCard } from './components/poll/PollMessageCard';
import { ForwardMessageModal } from './components/ForwardMessageModal';
import type { ChatOdaItem, ChatMesajItem } from './types';
import { useMobileSubView } from '@/lib/client/useMobileSubView';
import s from './ChatMobile.module.css';
import chatStyles from './Chat.module.css';

function formatTime(ts?: number): string {
	if (!ts) return '';
	return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(ts?: number): string {
	if (!ts) return '';
	const d = new Date(ts);
	return `${d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function RoomIcon({ room }: { room: ChatOdaItem }) {
	const isGroup = room.tur === 'takim' || (room.tur === 'ozel' && (room.memberCount || 0) > 2);
	return (
		<div className={s.roomIcon}>
			{room.avatar ? (
				// eslint-disable-next-line @next/next/no-img-element
				<img src={room.avatar} alt={room.ad} />
			) : isGroup ? (
				<Users size={19} />
			) : room.tur === 'ozel' ? (
				<span className={s.roomIconInitial}>{(room.ad || '?').slice(0, 1).toUpperCase()}</span>
			) : (
				<MessageSquare size={19} />
			)}
		</div>
	);
}

/**
 * Mobile view for the Chat application.
 * Designed with the desktop macOS/Cupertino theme tokens (dark frosted panels, Apple green accents).
 */
export function ChatMobileView() {
	const { currentUser, isAdmin } = useSession();
	const { t, language } = useI18n();
	const dialog = useDialog();
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

	type ChatMobileTab = 'all' | 'direct' | 'channels' | 'teams' | 'new';
	const [activeTab, setActiveTab] = useState<ChatMobileTab>('all');
	const listScrollRef = useRef<HTMLDivElement>(null);

	const [screen, setScreen] = useState<'rooms' | 'chat'>('rooms');
	useMobileSubView(screen === 'chat');
	const [searchQuery, setSearchQuery] = useState('');
	const [isNewChatOpen, setIsNewChatOpen] = useState(false);
	const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
	const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
	const [isCreatePollOpen, setIsCreatePollOpen] = useState(false);
	const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
	const [text, setText] = useState('');
	const [editingMessage, setEditingMessage] = useState<ChatMesajItem | null>(null);
	const [forwardingMessage, setForwardingMessage] = useState<ChatMesajItem | null>(null);
	const [prevRoomId, setPrevRoomId] = useState(activeRoomId);
	const bottomRef = useRef<HTMLDivElement>(null);
	const messagesScrollRef = useRef<HTMLDivElement>(null);
	const prevMessagesRef = useRef<ChatMesajItem[]>([]);
	const prevScrollHeightRef = useRef(0);
	const prevScreenRef = useRef<'rooms' | 'chat'>('rooms');
	const composerInputRef = useRef<HTMLInputElement>(null);

	if (activeRoomId !== prevRoomId) {
		setPrevRoomId(activeRoomId);
		setEditingMessage(null);
		setForwardingMessage(null);
		setText('');
	}

	// Preserve the reader's position when older messages are prepended, and
	// follow new messages only when already near the bottom.
	useLayoutEffect(() => {
		if (screen !== 'chat') {
			prevMessagesRef.current = messages;
			prevScreenRef.current = screen;
			return;
		}
		const el = messagesScrollRef.current;
		const prev = prevMessagesRef.current;
		const screenChanged = prevScreenRef.current !== screen;
		const prevLastId = prev[prev.length - 1]?.id;
		const prevFirstId = prev[0]?.id;
		const lastId = messages[messages.length - 1]?.id;
		const firstId = messages[0]?.id;
		const prepended =
			prev.length > 0 &&
			messages.length > prev.length &&
			lastId === prevLastId &&
			firstId !== prevFirstId;

		if (el) {
			if (screenChanged || (messages.length > 0 && prev.length === 0)) {
				bottomRef.current?.scrollIntoView({ behavior: 'auto' });
			} else if (prepended) {
				el.scrollTop = el.scrollHeight - prevScrollHeightRef.current;
			} else if (messages.length > 0 && lastId !== prevLastId) {
				const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
				if (nearBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
			}
			prevScrollHeightRef.current = el.scrollHeight;
		}
		prevMessagesRef.current = messages;
		prevScreenRef.current = screen;
	}, [messages, screen]);

	const handleMessagesScroll = () => {
		const el = messagesScrollRef.current;
		if (!el || !hasMoreMessages || loadingOlderMessages) return;
		if (el.scrollTop < 80) void loadOlderMessages();
	};

	// Filter rooms based on search query
	const filteredRooms = useMemo(() => {
		const q = searchQuery.trim().toLocaleLowerCase(language === 'tr' ? 'tr-TR' : undefined);
		if (!q) return rooms;
		return rooms.filter((r) =>
			r.ad.toLocaleLowerCase(language === 'tr' ? 'tr-TR' : undefined).includes(q)
		);
	}, [rooms, searchQuery, language]);

	// Split rooms into categories matching desktop ChatRoomList
	const genelRooms = useMemo(
		() => filteredRooms.filter((r) => r.tur !== 'takim' && r.tur !== 'ozel'),
		[filteredRooms]
	);
	const takimRooms = useMemo(
		() => filteredRooms.filter((r) => r.tur === 'takim'),
		[filteredRooms]
	);
	const ozelRooms = useMemo(
		() => filteredRooms.filter((r) => r.tur === 'ozel'),
		[filteredRooms]
	);

	const totalUnreadCount = useMemo(
		() => rooms.reduce((acc, r) => acc + (r.okunmamisSayisi || 0), 0),
		[rooms]
	);
	const unreadDirectCount = useMemo(
		() => ozelRooms.reduce((acc, r) => acc + (r.okunmamisSayisi || 0), 0),
		[ozelRooms]
	);
	const unreadChannelsCount = useMemo(
		() => genelRooms.reduce((acc, r) => acc + (r.okunmamisSayisi || 0), 0),
		[genelRooms]
	);
	const unreadTeamsCount = useMemo(
		() => takimRooms.reduce((acc, r) => acc + (r.okunmamisSayisi || 0), 0),
		[takimRooms]
	);

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

	const tabs: Array<{
		id: ChatMobileTab;
		label: string;
		badgeCount?: number;
		Icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
	}> = [
		{
			id: 'all',
			label: t('chatMobTabAll'),
			Icon: MessageSquare,
			badgeCount: totalUnreadCount > 0 ? totalUnreadCount : undefined,
		},
		{
			id: 'direct',
			label: t('chatMobTabDirect'),
			Icon: Send,
			badgeCount: unreadDirectCount > 0 ? unreadDirectCount : undefined,
		},
		{
			id: 'channels',
			label: t('chatMobTabChannels'),
			Icon: Hash,
			badgeCount: unreadChannelsCount > 0 ? unreadChannelsCount : undefined,
		},
		{
			id: 'teams',
			label: t('chatMobTabTeams'),
			Icon: Users,
			badgeCount: unreadTeamsCount > 0 ? unreadTeamsCount : undefined,
		},
		{
			id: 'new',
			label: t('chatMobTabNew'),
			Icon: PlusCircle,
		},
	];

	if (!currentUser) return null;

	const isGroupOrTeam =
		!!activeRoom &&
		(activeRoom.tur === 'takim' || (activeRoom.tur === 'ozel' && (activeRoom.memberCount || 0) > 2));

	const openRoom = (id: string) => {
		selectRoom(id);
		setScreen('chat');
	};

	const handleSend = async (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = text.trim();
		if (!trimmed || sending) return;
		setText('');
		composerInputRef.current?.focus();
		if (editingMessage) {
			const ok = await editMessage(editingMessage.id, trimmed);
			if (ok) {
				setEditingMessage(null);
			} else {
				setText(trimmed);
			}
		} else {
			const ok = await sendMessage(trimmed);
			if (!ok) setText(trimmed);
		}
		requestAnimationFrame(() => {
			composerInputRef.current?.focus();
		});
	};

	const subtitle = (room: ChatOdaItem) =>
		room.tur === 'genel'
			? t('chatPublicSub')
			: room.tur === 'takim'
			? t('chatTeamSub')
			: room.memberCount && room.memberCount > 2
			? fill(t('chatTotalMembers'), { n: room.memberCount })
			: t('chatPrivateSub');

	const renderRoomItem = (room: ChatOdaItem) => {
		const unread = room.okunmamisSayisi || 0;
		return (
			<button key={room.id} type="button" className={s.roomItem} onClick={() => openRoom(room.id)}>
				<RoomIcon room={room} />
				<div className={s.roomBody}>
					<div className={s.roomNameRow}>
						<span className={s.roomName}>{room.ad}</span>
						{room.sonMesaj?.date && (
							<span className={s.roomTime}>{formatTime(room.sonMesaj.date)}</span>
						)}
					</div>
					<div className={s.roomLastMsgRow}>
						<span className={s.roomLastMsg}>
							{room.sonMesaj
								? `${(room.sonMesaj.gonderenAd || t('spotKindMember')).split(' ')[0]}: ${room.sonMesaj.icerik}`
								: t('chatNoMessages')}
						</span>
						{unread > 0 && <span className={s.unreadBadge}>{unread}</span>}
					</div>
				</div>
			</button>
		);
	};

	const modals = (
		<>
			<NewChatModal
				isOpen={isNewChatOpen}
				onClose={() => setIsNewChatOpen(false)}
				onSelectContact={async (targetUserId) => {
					const rId = await createDm(targetUserId);
					if (rId) setScreen('chat');
				}}
				onCreateGroup={async (memberIds, title) => {
					const rId = await createGroupDm(memberIds, title);
					if (rId) setScreen('chat');
				}}
			/>
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
						if (rId) setScreen('chat');
					}}
				/>
			)}
			{activeRoom && (
				<GroupInfoModal
					isOpen={isGroupInfoOpen}
					onClose={() => setIsGroupInfoOpen(false)}
					room={activeRoom}
					onOpenAddMembers={() => setIsAddMemberOpen(true)}
				/>
			)}
			<CreatePollModal
				isOpen={isCreatePollOpen}
				onClose={() => setIsCreatePollOpen(false)}
				onSubmit={createPoll}
			/>
			<ForwardMessageModal
				isOpen={Boolean(forwardingMessage)}
				onClose={() => setForwardingMessage(null)}
				message={forwardingMessage}
				rooms={rooms}
				onForward={forwardMessage}
			/>
		</>
	);

	// SCREEN 1: Rooms overview list
	if (screen === 'rooms' || !activeRoom) {
		return (
			<div className={s.root}>
				<div className={s.topBar}>
					<div className={s.topTitleWrap}>
						<span className={s.topTitle}>{t('chatTitle')}</span>
					</div>

					<div className={s.topActions}>
						<button
							type="button"
							className={s.newChatBtn}
							onClick={() => setIsNewChatOpen(true)}
							title={t('chatNewChat')}
						>
							<MessageSquarePlus size={15} />
							<span>{t('chatNewChat')}</span>
						</button>
						<button
							type="button"
							className={s.iconBtn}
							onClick={refreshRooms}
							title={t('chatRefresh')}
						>
							<RefreshCw size={15} />
						</button>
					</div>
				</div>

				<div className={s.searchWrap}>
					<div className={s.searchBox}>
						<Search size={15} color="rgba(255, 255, 255, 0.45)" />
						<input
							type="text"
							className={s.searchInput}
							placeholder={t('chatSearchPlaceholder')}
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
						/>
						{searchQuery.length > 0 && (
							<button
								type="button"
								className={s.clearBtn}
								onClick={() => setSearchQuery('')}
								aria-label="Temizle"
							>
								<X size={12} strokeWidth={3} />
							</button>
						)}
					</div>
				</div>

				<div className={s.list} ref={listScrollRef}>
					{activeTab === 'all' && (
						<>
							{genelRooms.length > 0 && (
								<div>
									<div className={s.sectionHeader}>{t('chatChannels')}</div>
									{genelRooms.map(renderRoomItem)}
								</div>
							)}

							{takimRooms.length > 0 && (
								<div>
									<div className={s.sectionHeader}>{t('chatTeamRooms')}</div>
									{takimRooms.map(renderRoomItem)}
								</div>
							)}

							{ozelRooms.length > 0 && (
								<div>
									<div className={s.sectionHeader}>{t('chatDirectMessages')}</div>
									{ozelRooms.map(renderRoomItem)}
								</div>
							)}

							{filteredRooms.length === 0 && (
								<div className={s.emptyList}>
									{searchQuery ? t('chatNoMembersFound') : t('chatNoMessages')}
								</div>
							)}
						</>
					)}

					{activeTab === 'direct' && (
						<>
							{ozelRooms.length > 0 ? (
								<div>
									<div className={s.sectionHeader}>{t('chatDirectMessages')}</div>
									{ozelRooms.map(renderRoomItem)}
								</div>
							) : (
								<div className={s.emptyListCard}>
									<MessageSquare size={36} opacity={0.4} color="var(--accent)" />
									<p style={{ margin: '8px 0 14px', fontSize: '13px', opacity: 0.7 }}>
										{searchQuery ? t('chatNoMembersFound') : t('chatNoDirect')}
									</p>
									<button
										type="button"
										className={s.newChatBtn}
										onClick={() => setIsNewChatOpen(true)}
									>
										<MessageSquarePlus size={14} />
										<span>{t('chatStartDm')}</span>
									</button>
								</div>
							)}
						</>
					)}

					{activeTab === 'channels' && (
						<>
							{genelRooms.length > 0 ? (
								<div>
									<div className={s.sectionHeader}>{t('chatChannels')}</div>
									{genelRooms.map(renderRoomItem)}
								</div>
							) : (
								<div className={s.emptyListCard}>
									<Hash size={36} opacity={0.4} color="var(--accent)" />
									<p style={{ margin: '8px 0', fontSize: '13px', opacity: 0.7 }}>
										{searchQuery ? t('chatNoMembersFound') : t('chatNoChannels')}
									</p>
								</div>
							)}
						</>
					)}

					{activeTab === 'teams' && (
						<>
							{takimRooms.length > 0 ? (
								<div>
									<div className={s.sectionHeader}>{t('chatTeamRooms')}</div>
									{takimRooms.map(renderRoomItem)}
								</div>
							) : (
								<div className={s.emptyListCard}>
									<Users size={36} opacity={0.4} color="var(--accent)" />
									<p style={{ margin: '8px 0', fontSize: '13px', opacity: 0.7 }}>
										{searchQuery ? t('chatNoMembersFound') : t('chatNoTeams')}
									</p>
								</div>
							)}
						</>
					)}
				</div>

				{/* Fixed Apple iOS Bottom Tab Bar */}
				<nav className={s.mobileBottomTabBar} role="tablist" aria-label={t('chatMobNavAria')}>
					{tabs.map((tab) => {
						const activeTabMatched = activeTab === tab.id;
						const IconComponent = tab.Icon;
						const isAdd = tab.id === 'new';
						return (
							<button
								key={tab.id}
								type="button"
								role="tab"
								aria-selected={activeTabMatched}
								className={`${s.mobileBottomTabBtn} ${activeTabMatched ? s.mobileBottomTabBtnActive : ''}`}
								onClick={() => handleTabChange(tab.id)}
								title={tab.label}
								style={isAdd ? { color: 'var(--accent)' } : undefined}
							>
								<div className={s.mobileBottomTabIconWrap}>
									<IconComponent size={20} strokeWidth={activeTabMatched ? 2.3 : 1.7} />
									{tab.badgeCount !== undefined && tab.badgeCount > 0 && (
										<span className={s.tabBadge}>{tab.badgeCount}</span>
									)}
								</div>
								<span className={s.mobileBottomTabLabel}>{tab.label}</span>
							</button>
						);
					})}
				</nav>

				{modals}
			</div>
		);
	}

	// SCREEN 2: Active Conversation
	return (
		<div className={s.root}>
			<div className={s.convHeader}>
				<button
					type="button"
					className={s.convBackBtn}
					onClick={() => setScreen('rooms')}
					aria-label="Sohbet listesi"
				>
					<ChevronLeft size={22} strokeWidth={2.4} />
					<span>{language === 'tr' ? 'Sohbetler' : 'Chats'}</span>
				</button>

				<button
					type="button"
					className={`${s.convWho} ${isGroupOrTeam ? s.convWhoClickable : ''}`}
					onClick={() => isGroupOrTeam && setIsGroupInfoOpen(true)}
				>
					<div className={s.convIcon}>
						{activeRoom.avatar ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img src={activeRoom.avatar} alt={activeRoom.ad} />
						) : isGroupOrTeam ? (
							<Users size={18} />
						) : activeRoom.tur === 'ozel' ? (
							<span className={s.convIconInitial}>
								{activeRoom.ad.slice(0, 1).toUpperCase()}
							</span>
						) : (
							<MessageSquare size={18} />
						)}
					</div>
					<div className={s.convText}>
						<span className={s.convName}>{activeRoom.ad}</span>
						<span className={s.convSub}>{subtitle(activeRoom)}</span>
					</div>
				</button>

				<div className={s.convActions}>
					<button
						type="button"
						className={s.iconBtn}
						onClick={() => setIsAddMemberOpen(true)}
						title={t('chatAddMembers')}
					>
						<UserPlus size={16} />
					</button>
					{isGroupOrTeam && (
						<button
							type="button"
							className={s.iconBtn}
							onClick={() => setIsGroupInfoOpen(true)}
							title={t('chatGroupInfo')}
						>
							<Users size={16} />
						</button>
					)}
				</div>
			</div>

			{loadingMessages ? (
				<div className={s.centerState}>{t('chatLoadingMsgs')}</div>
			) : messages.length === 0 ? (
				<div className={s.centerState}>
					<MessageSquare size={40} opacity={0.3} color="var(--accent)" />
					<strong style={{ color: '#ffffff' }}>{t('chatNoMessages')}</strong>
					<span style={{ fontSize: '12px' }}>{t('chatFirstMessagePrompt')}</span>
				</div>
			) : (
				<div className={s.messages} ref={messagesScrollRef} onScroll={handleMessagesScroll}>
					{hasMoreMessages && (
						<div className={s.loadOlderWrap}>
							<button
								type="button"
								className={s.loadOlderBtn}
								onClick={() => void loadOlderMessages()}
								disabled={loadingOlderMessages}
							>
								{loadingOlderMessages ? t('chatLoadingOlder') : t('chatLoadOlder')}
							</button>
						</div>
					)}
					{messages.map((msg) => {
						if (msg.gonderenId === 'sistem') {
							return (
								<div key={msg.id} className={s.systemMsg}>
									<span className={s.systemPill}>{msg.icerik}</span>
								</div>
							);
						}
						const isMine = msg.gonderenId === currentUser.id;
						const isDeleted = Boolean(msg.silinmeTarihi);
						const isEdited = Boolean(msg.duzenlenmeTarihi) && !isDeleted;

						return (
							<div
								key={msg.id}
								className={`${s.msgRow} ${isMine ? s.msgRowMine : ''} ${isDeleted ? s.msgRowDeleted : ''}`}
							>
								{!isMine && (
									<div className={s.msgAvatar}>
										{msg.gonderenFoto ? (
											// eslint-disable-next-line @next/next/no-img-element
											<img src={msg.gonderenFoto} alt={msg.gonderenAd || t('spotKindMember')} />
										) : (
											(msg.gonderenAd || '?').slice(0, 1).toUpperCase()
										)}
									</div>
								)}

								<div className={s.msgBody}>
									{!isMine && (
										<span className={s.msgSender}>{msg.gonderenAd || t('spotKindMember')}</span>
									)}
									<div className={s.bubbleWrap}>
										{msg.anket ? (
											<PollMessageCard
												poll={msg.anket}
												currentUserId={currentUser.id}
												isAdmin={Boolean(isAdmin)}
												onVote={votePoll}
												onClosePoll={closePoll}
											/>
										) : (
											<div className={`${s.bubble} ${isMine ? s.bubbleMine : ''} ${isDeleted ? s.bubbleDeleted : ''}`}>
												{/* Forwarded Header */}
												{msg.iletildiMi && !isDeleted && (
													<div className={`${s.forwardedTag} ${isMine ? s.forwardedTagMine : ''}`}>
														<Forward size={11} />
														<span>{t('chatForwarded')}</span>
													</div>
												)}

												{/* Quoted Reply Bubble */}
												{msg.yanitlananMesaj && !isDeleted && (
													<div className={`${s.quotedBubble} ${isMine ? s.quotedBubbleMine : ''}`}>
														<div className={s.quotedBar} />
														<div className={s.quotedContent}>
															<span className={s.quotedAuthor}>{msg.yanitlananMesaj.gonderenAd}</span>
															<span className={s.quotedSnippet}>{msg.yanitlananMesaj.icerik}</span>
														</div>
													</div>
												)}

												{isDeleted && <span className={s.deletedInlineNotice}>[{t('chatDelete').toUpperCase()}] </span>}
												<div className={s.msgTextContent}>{msg.icerik}</div>
												<div className={s.bubbleTime}>{formatTime(msg.date)}</div>
											</div>
										)}

										{!isDeleted && (
											<div className={s.mobileMsgActions}>
												{!msg.anket && (
													<button
														type="button"
														className={s.mobileActionBtn}
														onClick={() => {
															setReplyingMessage(msg);
															composerInputRef.current?.focus();
														}}
														title={t('chatReply')}
													>
														<Reply size={11} />
													</button>
												)}
												{!msg.anket && (
													<button
														type="button"
														className={s.mobileActionBtn}
														onClick={() => setForwardingMessage(msg)}
														title={t('chatForward')}
													>
														<Forward size={11} />
													</button>
												)}
												{isMine && !msg.anket && (
													<button
														type="button"
														className={s.mobileActionBtn}
														onClick={() => {
															setEditingMessage(msg);
															setText(msg.icerik);
															composerInputRef.current?.focus();
														}}
														title={t('chatEdit')}
													>
														<Pencil size={11} />
													</button>
												)}
												{(isMine || isAdmin) && (
													<button
														type="button"
														className={`${s.mobileActionBtn} ${s.mobileActionBtnDanger}`}
														onClick={async () => {
															if (await dialog.confirm({ message: t('chatDeleteConfirm'), tone: 'danger' })) {
																void deleteMessage(msg.id);
															}
														}}
														title={t('chatDelete')}
													>
														<Trash2 size={11} />
													</button>
												)}
											</div>
										)}
									</div>

									{isDeleted && msg.silinmeTarihi && (
										<div className={s.deletedBadge}>
											<span>🗑️ {fill(t('chatDeletedAt'), { time: formatDateTime(msg.silinmeTarihi) })}</span>
											<span className={s.adminOnlyTag}>{t('chatAdminDeletedBadge')}</span>
										</div>
									)}

									{isEdited && msg.duzenlenmeTarihi && (
										<div className={s.editedBadge}>
											<span>✏️ {fill(t('chatEditedAt'), { time: formatTime(msg.duzenlenmeTarihi) })}</span>
										</div>
									)}
								</div>
							</div>
						);
					})}
					<div ref={bottomRef} />
				</div>
			)}

			{editingMessage && (
				<div className={s.mobileEditingBanner}>
					<div className={s.mobileEditingInfo}>
						<Pencil size={12} />
						<span>
							<strong>{t('chatEditingBanner')}:</strong> {editingMessage.icerik.slice(0, 32)}
							{editingMessage.icerik.length > 32 ? '…' : ''}
						</span>
					</div>
					<button
						type="button"
						className={s.mobileCancelEditBtn}
						onClick={() => {
							setEditingMessage(null);
							setText('');
						}}
						title={t('chatCancelEdit')}
					>
						<X size={14} />
					</button>
				</div>
			)}

			{replyingMessage && !editingMessage && (
				<div className={s.mobileReplyBanner}>
					<div className={s.mobileReplyInfo}>
						<Reply size={12} />
						<span>
							<strong>{t('chatReplyingBanner')}:</strong>{' '}
							<span style={{ fontWeight: 600 }}>{replyingMessage.gonderenAd}</span>{' '}
							&mdash; {replyingMessage.icerik.slice(0, 32)}
							{replyingMessage.icerik.length > 32 ? '…' : ''}
						</span>
					</div>
					<button
						type="button"
						className={s.mobileCancelEditBtn}
						onClick={cancelReply}
						title={t('chatCancelReply')}
					>
						<X size={14} />
					</button>
				</div>
			)}

			<form className={s.composer} onSubmit={handleSend}>
				<div className={chatStyles.composerActionWrapper}>
					<button
						type="button"
						className={`${chatStyles.composerPlusBtn} ${isActionsMenuOpen ? chatStyles.composerPlusBtnActive : ''}`}
						onClick={() => setIsActionsMenuOpen((prev) => !prev)}
						title={t('chatActionsMenu') || 'Ek Eylemler'}
						aria-expanded={isActionsMenuOpen}
					>
						<Plus size={18} />
					</button>
					<ComposerActionsMenu
						isOpen={isActionsMenuOpen}
						onClose={() => setIsActionsMenuOpen(false)}
						isAdmin={Boolean(isAdmin)}
						onSelectAction={(actionId) => {
							if (actionId === 'poll') {
								setIsCreatePollOpen(true);
							}
						}}
					/>
				</div>

				<input
					ref={composerInputRef}
					type="text"
					className={s.composerInput}
					placeholder={t('chatTypePlaceholder')}
					value={text}
					onChange={(e) => setText(e.target.value)}
				/>
				<button
					type="submit"
					className={s.sendBtn}
					disabled={sending || !text.trim()}
					title={editingMessage ? t('chatSaveEdit') : t('chatSend')}
				>
					{editingMessage ? <Check size={18} /> : <Send size={18} />}
				</button>
			</form>
			{modals}
		</div>
	);
}
