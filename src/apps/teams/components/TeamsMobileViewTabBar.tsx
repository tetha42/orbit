'use client';

import React from 'react';
import { Users, Columns3, PlusCircle, Compass } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import s from './TeamsMobile.module.css';

export type TeamsMobileTab = 'discover' | 'my_teams' | 'board' | 'add';

interface TeamsMobileViewTabBarProps {
	activeTab: TeamsMobileTab;
	myTeamsCount: number;
	onTabChange: (tabId: TeamsMobileTab) => void;
}

export function TeamsMobileViewTabBar({
	activeTab,
	myTeamsCount,
	onTabChange,
}: TeamsMobileViewTabBarProps) {
	const { t } = useI18n();

	const tabs: Array<{
		id: TeamsMobileTab;
		label: string;
		badgeCount?: number;
		Icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
	}> = [
		{ id: 'discover', label: t('tmMobTabDiscover'), Icon: Compass },
		{
			id: 'my_teams',
			label: t('tmMobTabMyTeams'),
			Icon: Users,
			badgeCount: myTeamsCount > 0 ? myTeamsCount : undefined,
		},
		{ id: 'board', label: t('tmMobTabBoard'), Icon: Columns3 },
		{ id: 'add', label: t('tmMobTabAdd'), Icon: PlusCircle },
	];

	return (
		<nav className={s.mobileBottomTabBar} role="tablist" aria-label={t('tmMobNavAria')}>
			{tabs.map((tab) => {
				const activeTabMatched = activeTab === tab.id;
				const IconComponent = tab.Icon;
				return (
					<button
						key={tab.id}
						type="button"
						role="tab"
						aria-selected={activeTabMatched}
						className={`${s.mobileBottomTabBtn} ${activeTabMatched ? s.mobileBottomTabBtnActive : ''}`}
						onClick={() => onTabChange(tab.id)}
						title={tab.label}
						style={tab.id === 'add' ? { color: 'var(--accent)' } : undefined}
					>
						<div className={s.mobileBottomTabIconWrap}>
							<IconComponent size={20} strokeWidth={activeTabMatched ? 2.3 : 1.7} />
							{tab.badgeCount !== undefined && <span className={s.tabBadge}>{tab.badgeCount}</span>}
						</div>
						<span className={s.mobileBottomTabLabel}>{tab.label}</span>
					</button>
				);
			})}
		</nav>
	);
}
