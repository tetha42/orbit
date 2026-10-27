'use client';

import React from 'react';
import { ArrowLeft, ExternalLink, FolderGit2, LayoutGrid, MessageSquare, Settings2, Users, Wallet } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import styles from './Teams.module.css';
import ui from '@/core/ui/ui.module.css';
import type { Team } from '../types';

export type TeamWorkspaceTab = 'kanban' | 'members' | 'chat' | 'kasa' | 'settings';

interface TeamWorkspaceHeaderProps {
	team: Team;
	visibleTab: TeamWorkspaceTab;
	setActiveTab: (tab: TeamWorkspaceTab) => void;
	canSeeKasa: boolean;
	onBack: () => void;
}

export function TeamWorkspaceHeader({
	team,
	visibleTab,
	setActiveTab,
	canSeeKasa,
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
						<h2 className={styles.wsName}>{team.ad}</h2>
						<span className={`${styles.pill} ${styles.pCategory}`}>{team.kategori}</span>
						{team.status !== 'aktif' && (
							<span className={`${styles.pill} ${styles.pPaused}`}>
								{t(team.status === 'askida' ? 'tmPaused' : 'tmFinished')}
							</span>
						)}
					</div>
					<div className={styles.wsMeta}>
						{t('tmCaptain')}: {team.liderAdSoyad || t('tmNoCaptain')} · {t('tmQuota')}: {team.doluKontenjan}/{team.kontenjan}
					</div>
				</div>
			</div>
			<nav className={styles.tabs} aria-label={team.ad}>
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
					<Users size={14} /> {t('tmTabMembers')} ({team.doluKontenjan})
					{team.basvurular.length > 0 && <span className={styles.tabBadge}>{team.basvurular.length}</span>}
				</button>
				<button
					type="button"
					className={`${styles.tab} ${visibleTab === 'chat' ? styles.tabActive : ''}`}
					onClick={() => setActiveTab('chat')}
					data-focus-section="chat"
				>
					<MessageSquare size={14} /> {t('tmTabChat')}
				</button>
				{canSeeKasa && (
					<button
						type="button"
						className={`${styles.tab} ${visibleTab === 'kasa' ? styles.tabActive : ''}`}
						onClick={() => setActiveTab('kasa')}
						data-focus-section="kasa"
					>
						<Wallet size={14} /> {t('tmTabKasa')}
					</button>
				)}
				{team.izinler.manage && (
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
