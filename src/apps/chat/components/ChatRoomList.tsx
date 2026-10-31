'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { MessageSquare, Users } from 'lucide-react';
import type { ChatOdaItem } from '../types';
import s from '../Chat.module.css';

interface ChatRoomListProps {
	rooms: ChatOdaItem[];
	activeRoomId: string | null;
	onSelectRoom: (odaId: string) => void;
}

export function ChatRoomList({ rooms, activeRoomId, onSelectRoom }: ChatRoomListProps) {
	const { t } = useI18n();

	const formatTime = (ts?: number) => {
		if (!ts) return '';
		const d = new Date(ts);
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	};

	const genelRooms = rooms.filter((r) => r.tur !== 'takim' && r.tur !== 'ozel');
	const teamRooms = rooms.filter((r) => r.tur === 'takim');
	const ozelRooms = rooms.filter((r) => r.tur === 'ozel');

	const renderRoomItem = (room: ChatOdaItem) => {
		const isActive = room.id === activeRoomId;
		const isGroupDm = room.tur === 'ozel' && (room.memberCount || 0) > 2;

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
							alt={room.ad}
							style={{ width: '100%', height: '100%', objectFit: 'cover' }}
						/>
					) : room.tur === 'takim' || isGroupDm ? (
						<Users size={18} />
					) : room.tur === 'ozel' ? (
						<span style={{ fontSize: '13px', fontWeight: 700 }}>
							{(room.ad || '?').slice(0, 1).toUpperCase()}
						</span>
					) : (
						<MessageSquare size={18} />
					)}
				</div>

				<div className={s.roomInfo}>
					<div className={s.roomNameRow}>
						<span className={s.roomName}>{room.ad}</span>
						{room.sonMesaj?.date && (
							<span className={s.roomTime}>{formatTime(room.sonMesaj.date)}</span>
						)}
					</div>

					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
						<span className={s.roomLastMsg}>
							{room.sonMesaj
								? `${(room.sonMesaj.gonderenAd || 'Üye').split(' ')[0]}: ${room.sonMesaj.icerik}`
								: t('chatNoMessages')}
						</span>
						{Boolean(room.okunmamisSayisi && room.okunmamisSayisi > 0) && (
							<span className={s.unreadBadge}>{room.okunmamisSayisi}</span>
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
			{genelRooms.length > 0 && (
				<div>
					<div style={sectionHeaderStyle}>{t('chatChannels')}</div>
					{genelRooms.map(renderRoomItem)}
				</div>
			)}

			{teamRooms.length > 0 && (
				<div>
					<div style={sectionHeaderStyle}>{t('chatTeamRooms')}</div>
					{teamRooms.map(renderRoomItem)}
				</div>
			)}

			{ozelRooms.length > 0 && (
				<div>
					<div style={sectionHeaderStyle}>{t('chatDirectMessages')}</div>
					{ozelRooms.map(renderRoomItem)}
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
