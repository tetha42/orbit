'use client';

import React from 'react';
import { Clock, Shield, UserPlus, Users } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import s from '../MembersMobile.module.css';

export type MembersMobileTab = 'members' | 'pending' | 'roles' | 'add';

interface MembersMobileTabBarProps {
	activeTab: Exclude<MembersMobileTab, 'add'>;
	pendingCount: number;
	onSelectTab: (tab: MembersMobileTab) => void;
}

export function MembersMobileTabBar({
	activeTab,
	pendingCount,
	onSelectTab,
}: MembersMobileTabBarProps) {
	const { t } = useI18n();

	return (
		<nav className={s.mobileBottomTabBar} role="tablist" aria-label={t('membersMobNavAria')}>
			<button
				type="button"
				role="tab"
				aria-selected={activeTab === 'members'}
				className={`${s.mobileBottomTabBtn} ${activeTab === 'members' ? s.mobileBottomTabBtnActive : ''}`}
				onClick={() => onSelectTab('members')}
			>
				<span className={s.mobileBottomTabIconWrap}>
					<Users size={18} />
				</span>
				<span className={s.mobileBottomTabLabel}>{t('membersMobTabAll')}</span>
			</button>

			<button
				type="button"
				role="tab"
				aria-selected={activeTab === 'pending'}
				className={`${s.mobileBottomTabBtn} ${activeTab === 'pending' ? s.mobileBottomTabBtnActive : ''}`}
				onClick={() => onSelectTab('pending')}
			>
				<span className={s.mobileBottomTabIconWrap}>
					<Clock size={18} />
					{pendingCount > 0 && <span className={s.tabBadge}>{pendingCount}</span>}
				</span>
				<span className={s.mobileBottomTabLabel}>{t('membersMobTabPending')}</span>
			</button>

			<button
				type="button"
				role="tab"
				aria-selected={activeTab === 'roles'}
				className={`${s.mobileBottomTabBtn} ${activeTab === 'roles' ? s.mobileBottomTabBtnActive : ''}`}
				onClick={() => onSelectTab('roles')}
			>
				<span className={s.mobileBottomTabIconWrap}>
					<Shield size={18} />
				</span>
				<span className={s.mobileBottomTabLabel}>{t('membersMobTabRoles')}</span>
			</button>

			<button
				type="button"
				className={s.mobileBottomTabBtn}
				style={{ color: 'var(--accent)' }}
				onClick={() => onSelectTab('add')}
			>
				<span className={s.mobileBottomTabIconWrap}>
					<UserPlus size={18} />
				</span>
				<span className={s.mobileBottomTabLabel}>{t('membersMobAdd')}</span>
			</button>
		</nav>
	);
}
