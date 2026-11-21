'use client';

import React from 'react';
import { MessageSquare, Users } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { ChatRoomItem } from '../../types';
import { formatChatTime } from './chatMobileFormat';
import s from '../../ChatMobile.module.css';

function RoomIcon({ room }: { room: ChatRoomItem }) {
	const isGroup = room.typeValue === 'team' || (room.typeValue === 'private' && (room.memberCount || 0) > 2);
	return (
		<div className={s.roomIcon}>
			{room.avatar ? (
				// eslint-disable-next-line @next/next/no-img-element
				<img src={room.avatar} alt={room.name} />
			) : isGroup ? (
				<Users size={19} />
			) : room.typeValue === 'private' ? (
				<span className={s.roomIconInitial}>{(room.name || '?').slice(0, 1).toUpperCase()}</span>
			) : (
				<MessageSquare size={19} />
			)}
		</div>
	);
}

interface ChatMobileRoomRowProps {
	room: ChatRoomItem;
	onOpen: (roomId: string) => void;
}

export function ChatMobileRoomRow({ room, onOpen }: ChatMobileRoomRowProps) {
	const { t } = useI18n();
	const unread = room.unreadCount || 0;

	return (
		<button type="button" className={s.roomItem} onClick={() => onOpen(room.id)}>
			<RoomIcon room={room} />
			<div className={s.roomBody}>
				<div className={s.roomNameRow}>
					<span className={s.roomName}>{room.name}</span>
					{room.lastMessage?.date && (
						<span className={s.roomTime}>{formatChatTime(room.lastMessage.date)}</span>
					)}
				</div>
				<div className={s.roomLastMsgRow}>
					<span className={s.roomLastMsg}>
						{room.lastMessage
							? `${(room.lastMessage.senderName || t('spotKindMember')).split(' ')[0]}: ${room.lastMessage.content}`
							: t('chatNoMessages')}
					</span>
					{unread > 0 && <span className={s.unreadBadge}>{unread}</span>}
				</div>
			</div>
		</button>
	);
}
