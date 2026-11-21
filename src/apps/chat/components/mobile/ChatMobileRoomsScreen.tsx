'use client';

import React from 'react';
import {
	MessageSquare,
	MessageSquarePlus,
	RefreshCw,
	Search,
	Users,
	X,
	Hash,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { ChatRoomItem } from '../../types';
import { ChatMobileTabBar, type ChatMobileTab } from './ChatMobileTabBar';
import { ChatMobileRoomRow } from './ChatMobileRoomRow';
import s from '../../ChatMobile.module.css';

interface ChatMobileRoomsScreenProps {
	activeTab: ChatMobileTab;
	searchQuery: string;
	onSearchChange: (value: string) => void;
	listScrollRef: React.RefObject<HTMLDivElement | null>;
	filteredRooms: ChatRoomItem[];
	generalRooms: ChatRoomItem[];
	teamRooms: ChatRoomItem[];
	customRooms: ChatRoomItem[];
	totalUnreadCount: number;
	unreadDirectCount: number;
	unreadChannelsCount: number;
	unreadTeamsCount: number;
	onOpenRoom: (roomId: string) => void;
	onOpenNewChat: () => void;
	onRefreshRooms: () => void;
	onTabChange: (tabId: ChatMobileTab) => void;
	modals: React.ReactNode;
}

export function ChatMobileRoomsScreen({
	activeTab,
	searchQuery,
	onSearchChange,
	listScrollRef,
	filteredRooms,
	generalRooms,
	teamRooms,
	customRooms,
	totalUnreadCount,
	unreadDirectCount,
	unreadChannelsCount,
	unreadTeamsCount,
	onOpenRoom,
	onOpenNewChat,
	onRefreshRooms,
	onTabChange,
	modals,
}: ChatMobileRoomsScreenProps) {
	const { t } = useI18n();

	const renderRoomItem = (room: ChatRoomItem) => (
		<ChatMobileRoomRow key={room.id} room={room} onOpen={onOpenRoom} />
	);

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
						onClick={onOpenNewChat}
						title={t('chatNewChat')}
					>
						<MessageSquarePlus size={15} />
						<span>{t('chatNewChat')}</span>
					</button>
					<button
						type="button"
						className={s.iconBtn}
						onClick={onRefreshRooms}
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
						onChange={(e) => onSearchChange(e.target.value)}
					/>
					{searchQuery.length > 0 && (
						<button
							type="button"
							className={s.clearBtn}
							onClick={() => onSearchChange('')}
							aria-label={t('chatSearchClear')}
						>
							<X size={12} strokeWidth={3} />
						</button>
					)}
				</div>
			</div>

			<div className={s.list} ref={listScrollRef}>
				{activeTab === 'all' && (
					<>
						{generalRooms.length > 0 && (
							<div>
								<div className={s.sectionHeader}>{t('chatChannels')}</div>
								{generalRooms.map(renderRoomItem)}
							</div>
						)}
						{teamRooms.length > 0 && (
							<div>
								<div className={s.sectionHeader}>{t('chatTeamRooms')}</div>
								{teamRooms.map(renderRoomItem)}
							</div>
						)}
						{customRooms.length > 0 && (
							<div>
								<div className={s.sectionHeader}>{t('chatDirectMessages')}</div>
								{customRooms.map(renderRoomItem)}
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
					customRooms.length > 0 ? (
						<div>
							<div className={s.sectionHeader}>{t('chatDirectMessages')}</div>
							{customRooms.map(renderRoomItem)}
						</div>
					) : (
						<div className={s.emptyListCard}>
							<MessageSquare size={36} opacity={0.4} color="var(--accent)" />
							<p style={{ margin: '8px 0 14px', fontSize: '13px', opacity: 0.7 }}>
								{searchQuery ? t('chatNoMembersFound') : t('chatNoDirect')}
							</p>
							<button type="button" className={s.newChatBtn} onClick={onOpenNewChat}>
								<MessageSquarePlus size={14} />
								<span>{t('chatStartDm')}</span>
							</button>
						</div>
					)
				)}

				{activeTab === 'channels' && (
					generalRooms.length > 0 ? (
						<div>
							<div className={s.sectionHeader}>{t('chatChannels')}</div>
							{generalRooms.map(renderRoomItem)}
						</div>
					) : (
						<div className={s.emptyListCard}>
							<Hash size={36} opacity={0.4} color="var(--accent)" />
							<p style={{ margin: '8px 0', fontSize: '13px', opacity: 0.7 }}>
								{searchQuery ? t('chatNoMembersFound') : t('chatNoChannels')}
							</p>
						</div>
					)
				)}

				{activeTab === 'teams' && (
					teamRooms.length > 0 ? (
						<div>
							<div className={s.sectionHeader}>{t('chatTeamRooms')}</div>
							{teamRooms.map(renderRoomItem)}
						</div>
					) : (
						<div className={s.emptyListCard}>
							<Users size={36} opacity={0.4} color="var(--accent)" />
							<p style={{ margin: '8px 0', fontSize: '13px', opacity: 0.7 }}>
								{searchQuery ? t('chatNoMembersFound') : t('chatNoTeams')}
							</p>
						</div>
					)
				)}
			</div>

			<ChatMobileTabBar
				activeTab={activeTab}
				totalUnreadCount={totalUnreadCount}
				unreadDirectCount={unreadDirectCount}
				unreadChannelsCount={unreadChannelsCount}
				unreadTeamsCount={unreadTeamsCount}
				onTabChange={onTabChange}
			/>

			{modals}
		</div>
	);
}
