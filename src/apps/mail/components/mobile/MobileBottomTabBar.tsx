'use client';

import React from 'react';
import s from '../../MailMobile.module.css';

export type MailMobileTab = 'inbox' | 'starred' | 'sent' | 'folders' | 'compose';

export interface MobileTabItem {
	id: MailMobileTab;
	label: string;
	badgeCount?: number;
	Icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
}

interface MobileBottomTabBarProps {
	tabs: MobileTabItem[];
	activeTabId: MailMobileTab;
	onTabChange: (tabId: MailMobileTab) => void;
	ariaLabel: string;
}

export function MobileBottomTabBar({ tabs, activeTabId, onTabChange, ariaLabel }: MobileBottomTabBarProps) {
	return (
		<nav className={s.mobileBottomTabBar} role="tablist" aria-label={ariaLabel}>
			{tabs.map((tab) => {
				const activeTabMatched = activeTabId === tab.id;
				const IconComponent = tab.Icon;
				const isCompose = tab.id === 'compose';
				return (
					<button
						key={tab.id}
						type="button"
						role="tab"
						aria-selected={activeTabMatched}
						className={`${s.mobileBottomTabBtn} ${activeTabMatched ? s.mobileBottomTabBtnActive : ''}`}
						onClick={() => onTabChange(tab.id)}
						title={tab.label}
						style={isCompose ? { color: 'var(--accent)' } : undefined}
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
