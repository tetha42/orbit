'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useSession } from '@/core/session';
import { useI18n } from '@/core/i18n';
import { useWindowActions } from '@/core/windows';
import {
	BarChart2,
	ExternalLink,
	RefreshCw,
	Users,
} from 'lucide-react';
import { useChat } from '../hooks/useChat';
import { ChatMessageList } from './ChatMessageList';
import { ChatMessageInput } from './ChatMessageInput';
import { CreatePollModal } from './poll/CreatePollModal';
import { ForwardMessageModal } from './ForwardMessageModal';
import { GroupInfoModal } from './GroupInfoModal';
import type { ChatMesajItem } from '../types';
import s from '../Chat.module.css';

interface TeamChatEmbedProps {
	teamId: string;
	takimAd: string;
}

export function TeamChatEmbed({ teamId, takimAd }: TeamChatEmbedProps) {
	const { currentUser, isAdmin } = useSession();
	const { t } = useI18n();
	const { openApp } = useWindowActions();

	const targetRoomId = useMemo(() => `oda_takim_${teamId}`, [teamId]);

	// Ensure team room exists in PostgreSQL database with correct title
	useEffect(() => {
		let isSubscribed = true;
		void fetch('/api/chat/rooms', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'ensure_team', teamId, takimAd }),
		})
			.then((res) => res.json())
			.then(() => {
				if (isSubscribed) {
					// Room verified
				}
			})
			.catch(() => {});

		return () => {
			isSubscribed = false;
		};
	}, [teamId, takimAd]);

	const [editingMessage, setEditingMessage] = useState<ChatMesajItem | null>(null);
	const [forwardingMessage, setForwardingMessage] = useState<ChatMesajItem | null>(null);
	const [isCreatePollOpen, setIsCreatePollOpen] = useState(false);
	const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);

	const {
		rooms,
		activeRoom,
		messages,
		loadingMessages,
		sendMessage,
		deleteMessage,
		editMessage,
		createPoll,
		votePoll,
		closePoll,
		replyingMessage,
		setReplyingMessage,
		cancelReply,
		forwardMessage,
		refreshRooms,
		refreshMessages,
	} = useChat(targetRoomId);

	// Fallback room object if room list hasn't loaded yet
	const resolvedRoom = useMemo(() => {
		return (
			activeRoom ||
			rooms.find((r) => r.id === targetRoomId) || {
				id: targetRoomId,
				tur: 'takim' as const,
				ad: `${takimAd} ${t('chatTeamChatSuffix')}`,
				teamId,
				olusturma: 0,
				memberCount: undefined,
			}
		);
	}, [activeRoom, rooms, targetRoomId, takimAd, t, teamId]);

	if (!currentUser) return null;

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				height: '100%',
				minHeight: '400px',
				background: 'rgba(0, 0, 0, 0.2)',
				borderRadius: '12px',
				border: '1px solid rgba(255, 255, 255, 0.08)',
				overflow: 'hidden',
			}}
		>
			{/* Chat Header with Shortcut Actions */}
			<div className={s.chatHeader}>
				<div style={{ minWidth: 0, flex: 1 }}>
					<div className={s.headerTitle} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
						{takimAd} {t('chatTeamChatSuffix')}
					</div>
					<div className={s.headerSub}>{t('chatTeamChatSub')}</div>
				</div>

				<div className={s.headerActions} style={{ flexShrink: 0, gap: '6px' }}>
					{/* Create Poll Button */}
					<button
						type="button"
						className={s.headerActionBtn}
						onClick={() => setIsCreatePollOpen(true)}
						title={t('chatCreatePoll')}
					>
						<BarChart2 size={14} />
						<span style={{ fontSize: '11px' }}>{t('chatCreatePoll')}</span>
					</button>

					{/* Room Info / Members Button */}
					<button
						type="button"
						className={s.headerActionBtn}
						onClick={() => setIsGroupInfoOpen(true)}
						title={t('chatGroupInfo')}
					>
						<Users size={14} />
						{resolvedRoom.memberCount !== undefined && (
							<span style={{ fontSize: '11px' }}>{resolvedRoom.memberCount}</span>
						)}
					</button>

					{/* Refresh Button */}
					<button
						type="button"
						className={s.headerIconBtn}
						onClick={() => {
							void refreshRooms();
							refreshMessages();
						}}
						title={t('chatRefresh')}
					>
						<RefreshCw size={14} className={loadingMessages ? s.spin : ''} />
					</button>

					{/* Open in Chat Mini App (Shortcut) */}
					<button
						type="button"
						className={s.headerActionBtn}
						style={{
							background: 'var(--accent-subtle, rgba(10, 132, 255, 0.15))',
							borderColor: 'var(--accent)',
							color: 'var(--accent)',
						}}
						onClick={() => openApp('chat', { kind: 'room', itemId: targetRoomId })}
						title={t('chatOpenInApp')}
					>
						<ExternalLink size={14} />
						<span style={{ fontSize: '11px' }}>{t('chatOpenInApp')}</span>
					</button>
				</div>
			</div>

			{/* Full-featured Chat Message List */}
			<ChatMessageList
				messages={messages}
				currentUserId={currentUser.id}
				isAdmin={isAdmin}
				loading={loadingMessages}
				onStartEdit={(msg) => setEditingMessage(msg)}
				onDelete={deleteMessage}
				onReply={(msg) => setReplyingMessage(msg)}
				onForward={(msg) => setForwardingMessage(msg)}
				onVotePoll={votePoll}
				onClosePoll={closePoll}
			/>

			{/* Full-featured Chat Message Input */}
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

			{/* Modals & Dialogs */}
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

			<GroupInfoModal
				isOpen={isGroupInfoOpen}
				onClose={() => setIsGroupInfoOpen(false)}
				room={resolvedRoom}
				onOpenAddMembers={() => {}}
			/>
		</div>
	);
}
