'use client';

import React from 'react';
import { ArrowLeft, ExternalLink, FolderGit2, LayoutGrid, MessageSquare, Settings2, Users, Wallet } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import styles from './Teams.module.css';
import ui from '@/core/ui/ui.module.css';
import type { Team } from '../types';

export type TeamWorkspaceTab = 'kanban' | 'members' | 'chat' | 'vault' | 'settings';

interface TeamWorkspaceHeaderProps {
	team: Team;
	visibleTab: TeamWorkspaceTab;
	setActiveTab: (tab: TeamWorkspaceTab) => void;
	canSeeVault: boolean;
	onBack: () => void;
}

export function TeamWorkspaceHeader({
	team,
	visibleTab,
	setActiveTab,
	canSeeVault,
	onBack,
}: TeamWorkspaceHeaderProps) {
	const { t } = useI18n();

	return (
		<div className={styles.wsHeader}>
			<div className={styles.wsTitle}>
				<button type="button" className={ui.btn} onClick={onBack}>
					<ArrowLeft size={14} /> {t('tmBack')}
				</button>
				<div data-focus-id={`team:${team.id}`} style={{ minWidth: 0 }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
						<h2 className={styles.wsName}>{team.name}</h2>
						<span className={`${styles.pill} ${styles.pCategory}`}>{team.category}</span>
						{team.status !== 'active' && (
							<span className={`${styles.pill} ${styles.pPaused}`}>
								{t(team.status === 'suspended' ? 'tmPaused' : 'tmFinished')}
							</span>
						)}
					</div>
					<div className={styles.wsMeta}>
						{t('tmCaptain')}: {team.leaderName || t('tmNoCaptain')} · {t('tmQuota')}: {team.fullCapacity}/{team.capacity}
					</div>
				</div>
			</div>
			<nav className={styles.tabs} aria-label={team.name}>
				<button
					type="button"
					className={`${styles.tab} ${visibleTab === 'kanban' ? styles.tabActive : ''}`}
					onClick={() => setActiveTab('kanban')}
				>
					<LayoutGrid size={14} /> {t('tmTabBoard')}
				</button>
				<button
					type="button"
					className={`${styles.tab} ${visibleTab === 'members' ? styles.tabActive : ''}`}
					onClick={() => setActiveTab('members')}
					data-focus-section="members"
				>
					<Users size={14} /> {t('tmTabMembers')} ({team.fullCapacity})
					{team.applications.length > 0 && <span className={styles.tabBadge}>{team.applications.length}</span>}
				</button>
				<button
					type="button"
					className={`${styles.tab} ${visibleTab === 'chat' ? styles.tabActive : ''}`}
					onClick={() => setActiveTab('chat')}
					data-focus-section="chat"
				>
					<MessageSquare size={14} /> {t('tmTabChat')}
				</button>
				{canSeeVault && (
					<button
						type="button"
						className={`${styles.tab} ${visibleTab === 'vault' ? styles.tabActive : ''}`}
						onClick={() => setActiveTab('vault')}
						data-focus-section="vault"
					>
						<Wallet size={14} /> {t('tmTabTreasury')}
					</button>
				)}
				{team.permissions.manage && (
					<button
						type="button"
						className={`${styles.tab} ${visibleTab === 'settings' ? styles.tabActive : ''}`}
						onClick={() => setActiveTab('settings')}
					>
						<Settings2 size={14} /> {t('tmTabSettings')}
					</button>
				)}
				{team.repoUrl && (
					<a className={styles.tab} href={team.repoUrl} target="_blank" rel="noreferrer noopener">
						<FolderGit2 size={14} /> {t('tmRepo')} <ExternalLink size={12} />
					</a>
				)}
			</nav>
		</div>
	);
}
