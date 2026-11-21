'use client';

import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useSoc } from '../../context/SocContext';
import s from './SocSidebar.module.css';
import { SIDEBAR_I18N } from './i18nSidebar';
import { SidebarNavGroups } from './SidebarNavGroups';
import { SidebarFooter } from './SidebarFooter';

export function SocSidebar() {
	const { language } = useI18n();
	const copy = SIDEBAR_I18N[language] ?? SIDEBAR_I18N.en;

	const {
		activeTab,
		setActiveTab,
		openLabTab,
		overview,
		bans,
		sessions,
		siemLogs,
		canManage,
		isResettingDefcon,
		handleResetDefcon,
		handleToggleLockdown,
		setShowWebhookModal,
	} = useSoc();

	const defcon = overview?.defcon ?? 5;
	const isLockdownActive = Boolean(overview?.lockdown.active);
	const activeBansCount = bans.filter((b) => b.status === 'ban').length;

	return (
		<aside className={s.sidebar} aria-label={copy.navAriaLabel}>
			{/* Brand Header */}
			<div className={s.header}>
				<div className={s.brandIcon}>
					<ShieldAlert size={16} />
				</div>
				<div className={s.brandInfo}>
					<span className={s.brandTitle}>SoC Studio</span>
					<span className={s.brandSubtitle}>{copy.brandSubtitle}</span>
				</div>
			</div>

			<SidebarNavGroups
				copy={copy}
				activeTab={activeTab}
				canManage={canManage}
				activeBansCount={activeBansCount}
				sessionsCount={sessions.length}
				siemLogsCount={siemLogs.length}
				onSelectTab={setActiveTab}
				onOpenLabTab={openLabTab}
			/>

			<SidebarFooter
				copy={copy}
				defcon={defcon}
				canManage={canManage}
				isLockdownActive={isLockdownActive}
				isResettingDefcon={isResettingDefcon}
				onResetDefcon={handleResetDefcon}
				onToggleLockdown={handleToggleLockdown}
				onOpenWebhooks={() => setShowWebhookModal(true)}
			/>
		</aside>
	);
}
