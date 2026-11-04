'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { MessageSquare, Users } from 'lucide-react';
import type { ChatRoomItem } from '../types';
import s from '../Chat.module.css';

interface ChatRoomListProps {
	rooms: ChatRoomItem[];
	activeRoomId: string | null;
	onSelectRoom: (roomId: string) => void;
}

export function ChatRoomList({ rooms, activeRoomId, onSelectRoom }: ChatRoomListProps) {
	const { t } = useI18n();

	const formatTime = (ts?: number) => {
		if (!ts) return '';
		const d = new Date(ts);
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	};

	const generalRooms = rooms.filter((r) => r.typeValue !== 'team' && r.typeValue !== 'private');
	const teamRooms = rooms.filter((r) => r.typeValue === 'team');
	const customRooms = rooms.filter((r) => r.typeValue === 'private');

	const renderRoomItem = (room: ChatRoomItem) => {
		const isActive = room.id === activeRoomId;
		const isGroupDm = room.typeValue === 'private' && (room.memberCount || 0) > 2;

		return (
			<button
				key={room.id}
				type="button"
				onClick={() => onSelectRoom(room.id)}
				className={`${s.roomItem} ${isActive ? s.roomItemActive : ''}`}
			>
				<div className={s.roomIcon} style={{ overflow: 'hidden' }}>
					{room.avatar ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							src={room.avatar}
							alt={room.name}
							style={{ width: '100%', height: '100%', objectFit: 'cover' }}
						/>
					) : room.typeValue === 'team' || isGroupDm ? (
						<Users size={18} />
					) : room.typeValue === 'private' ? (
						<span style={{ fontSize: '13px', fontWeight: 700 }}>
							{(room.name || '?').slice(0, 1).toUpperCase()}
						</span>
					) : (
						<MessageSquare size={18} />
					)}
				</div>

				<div className={s.roomInfo}>
					<div className={s.roomNameRow}>
						<span className={s.roomName}>{room.name}</span>
						{room.lastMessage?.date && (
							<span className={s.roomTime}>{formatTime(room.lastMessage.date)}</span>
						)}
					</div>

					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
						<span className={s.roomLastMsg}>
							{room.lastMessage
								? `${(room.lastMessage.senderName || 'Üye').split(' ')[0]}: ${room.lastMessage.content}`
								: t('chatNoMessages')}
						</span>
						{Boolean(room.unreadCount && room.unreadCount > 0) && (
							<span className={s.unreadBadge}>{room.unreadCount}</span>
						)}
					</div>
				</div>
			</button>
		);
	};

	const sectionHeaderStyle: React.CSSProperties = {
		fontSize: '11px',
		fontWeight: 700,
		textTransform: 'uppercase',
		letterSpacing: '0.05em',
		color: 'var(--text-secondary)',
		padding: '12px 14px 6px',
	};

	return (
		<div className={s.roomList}>
			{generalRooms.length > 0 && (
				<div>
					<div style={sectionHeaderStyle}>{t('chatChannels')}</div>
					{generalRooms.map(renderRoomItem)}
				</div>
			)}

			{teamRooms.length > 0 && (
				<div>
					<div style={sectionHeaderStyle}>{t('chatTeamRooms')}</div>
					{teamRooms.map(renderRoomItem)}
				</div>
			)}

			{customRooms.length > 0 && (
				<div>
					<div style={sectionHeaderStyle}>{t('chatDirectMessages')}</div>
					{customRooms.map(renderRoomItem)}
				</div>
			)}

			{rooms.length === 0 && (
				<div style={{ padding: '30px 16px', textAlign: 'center', opacity: 0.6, fontSize: '13px' }}>
					{t('chatNoMessages')}
				</div>
			)}
		</div>
	);
}
