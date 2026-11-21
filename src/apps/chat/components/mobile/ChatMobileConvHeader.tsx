'use client';

import React from 'react';
import { ChevronLeft, MessageSquare, Phone, Search, UserPlus, Users } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import type { ChatRoomItem } from '../../types';
import s from '../../ChatMobile.module.css';

interface ChatMobileConvHeaderProps {
	activeRoom: ChatRoomItem;
	isGroupOrTeam: boolean;
	onBack: () => void;
	onOpenAddMember: () => void;
	onOpenGroupInfo: () => void;
	onToggleSearch?: () => void;
	onStartCall?: () => void;
}

export function ChatMobileConvHeader({
	activeRoom,
	isGroupOrTeam,
	onBack,
	onOpenAddMember,
	onOpenGroupInfo,
	onToggleSearch,
	onStartCall,
}: ChatMobileConvHeaderProps) {
	const { t } = useI18n();

	const subtitle =
		activeRoom.typeValue === 'general'
			? t('chatPublicSub')
			: activeRoom.typeValue === 'team'
			? t('chatTeamSub')
			: activeRoom.memberCount && activeRoom.memberCount > 2
			? fill(t('chatTotalMembers'), { n: activeRoom.memberCount })
			: t('chatPrivateSub');

	return (
		<div className={s.convHeader}>
			<button
				type="button"
				className={s.convBackBtn}
				onClick={onBack}
				aria-label={t('chatMobileRoomsBack', 'Chats')}
			>
				<ChevronLeft size={22} strokeWidth={2.4} />
				<span>{t('chatMobileRoomsBack', 'Chats')}</span>
			</button>

			<button
				type="button"
				className={`${s.convWho} ${isGroupOrTeam ? s.convWhoClickable : ''}`}
				onClick={() => isGroupOrTeam && onOpenGroupInfo()}
			>
				<div className={s.convIcon}>
					{activeRoom.avatar ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img src={activeRoom.avatar} alt={activeRoom.name} />
					) : isGroupOrTeam ? (
						<Users size={18} />
					) : activeRoom.typeValue === 'private' ? (
						<span className={s.convIconInitial}>
							{activeRoom.name.slice(0, 1).toUpperCase()}
						</span>
					) : (
						<MessageSquare size={18} />
					)}
				</div>
				<div className={s.convText}>
					<span className={s.convName}>{activeRoom.name}</span>
					<span className={s.convSub}>{subtitle}</span>
				</div>
			</button>

			<div className={s.convActions}>
				{onToggleSearch && (
					<button
						type="button"
						className={s.iconBtn}
						onClick={onToggleSearch}
						title={t('chatSearchInRoom')}
					>
						<Search size={16} />
					</button>
				)}
				{onStartCall && (
					<button
						type="button"
						className={s.iconBtn}
						onClick={onStartCall}
						title={t('chatCallStart')}
					>
						<Phone size={16} />
					</button>
				)}
				<button
					type="button"
					className={s.iconBtn}
					onClick={onOpenAddMember}
					title={t('chatAddMembers')}
				>
					<UserPlus size={16} />
				</button>
				{isGroupOrTeam && (
					<button
						type="button"
						className={s.iconBtn}
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
