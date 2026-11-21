'use client';

import React from 'react';
import { MessageSquare, Send, Users, Hash, PlusCircle } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import s from '../../ChatMobile.module.css';

export type ChatMobileTab = 'all' | 'direct' | 'channels' | 'teams' | 'new';

interface ChatMobileTabBarProps {
	activeTab: ChatMobileTab;
	totalUnreadCount: number;
	unreadDirectCount: number;
	unreadChannelsCount: number;
	unreadTeamsCount: number;
	onTabChange: (tabId: ChatMobileTab) => void;
}

export function ChatMobileTabBar({
	activeTab,
	totalUnreadCount,
	unreadDirectCount,
	unreadChannelsCount,
	unreadTeamsCount,
	onTabChange,
}: ChatMobileTabBarProps) {
	const { t } = useI18n();

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

	return (
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
						onClick={() => onTabChange(tab.id)}
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
	);
}
