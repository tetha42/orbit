'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { MessageSquare, ArrowLeft, Phone, Search, UserPlus, Users } from 'lucide-react';
import type { ChatRoomItem } from '../types';
import s from '../Chat.module.css';

interface ChatRoomHeaderProps {
	activeRoom: ChatRoomItem;
	isGroupOrTeam: boolean;
	onMobileBack: () => void;
	onOpenAddMember: () => void;
	onOpenGroupInfo: () => void;
	onToggleSearch?: () => void;
	onStartCall?: () => void;
}

export function ChatRoomHeader({
	activeRoom,
	isGroupOrTeam,
	onMobileBack,
	onOpenAddMember,
	onOpenGroupInfo,
	onToggleSearch,
	onStartCall,
}: ChatRoomHeaderProps) {
	const { t } = useI18n();

	return (
		<div className={s.chatHeader}>
			<div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
				{typeof window !== 'undefined' && window.innerWidth < 768 && (
					<button
						type="button"
						onClick={onMobileBack}
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
						if (isGroupOrTeam) onOpenGroupInfo();
					}}
				>
					{activeRoom.avatar ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							src={activeRoom.avatar}
							alt={activeRoom.name}
							style={{ width: '100%', height: '100%', objectFit: 'cover' }}
						/>
					) : isGroupOrTeam ? (
						<Users size={18} />
					) : activeRoom.typeValue === 'private' ? (
						<span style={{ fontSize: '13px', fontWeight: 700 }}>
							{(activeRoom.name || '?').slice(0, 1).toUpperCase()}
						</span>
					) : (
						<MessageSquare size={18} />
					)}
				</div>

				<div
					style={{ minWidth: 0, cursor: isGroupOrTeam ? 'pointer' : 'default' }}
					onClick={() => {
						if (isGroupOrTeam) onOpenGroupInfo();
					}}
				>
					<div className={s.headerTitle} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
						{activeRoom.name}
					</div>
					<div className={s.headerSub} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
						{activeRoom.typeValue === 'general'
							? t('chatPublicSub')
							: activeRoom.typeValue === 'team'
							? t('chatTeamSub')
							: activeRoom.memberCount && activeRoom.memberCount > 2
							? fill(t('chatTotalMembers'), { n: activeRoom.memberCount })
							: t('chatPrivateSub')}
					</div>
				</div>
			</div>

			<div className={s.headerActions}>
				{onToggleSearch && (
					<button
						type="button"
						className={s.headerIconBtn}
						onClick={onToggleSearch}
						title={t('chatSearchInRoom')}
					>
						<Search size={16} />
					</button>
				)}
				{onStartCall && (
					<button
						type="button"
						className={s.headerIconBtn}
						onClick={onStartCall}
						title={t('chatCallStart')}
					>
						<Phone size={16} />
					</button>
				)}
				<button
					type="button"
					className={s.headerIconBtn}
					onClick={onOpenAddMember}
					title={t('chatAddMembers')}
				>
					<UserPlus size={16} />
				</button>

				{isGroupOrTeam && (
					<button
						type="button"
						className={s.headerIconBtn}
						onClick={onOpenGroupInfo}
						title={t('chatGroupInfo')}
					>
						<Users size={16} />
					</button>
				)}
			</div>
		</div>
	);
}
