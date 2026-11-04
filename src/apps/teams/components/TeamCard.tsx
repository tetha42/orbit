'use client';

import React from 'react';
import { ChevronRight, Settings2, Trash2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { initials } from '@/core/text/initials';
import styles from './Teams.module.css';
import ui from '@/core/ui/ui.module.css';
import type { Team } from '../types';

interface TeamCardProps {
	team: Team;
	joinButton: React.ReactNode;
	onOpen: (id: string) => void;
	onEdit?: (team: Team) => void;
	onRemove: (team: Team) => void;
}

export function TeamCard({ team: tm, joinButton, onOpen, onEdit, onRemove }: TeamCardProps) {
	const { t } = useI18n();

	const quotaColor = (team: Team) =>
		team.remainingCapacity === 0
			? '#ff453a'
			: team.occupancyRatio > 75
				? 'linear-gradient(90deg,#ff9f0a,#ff453a)'
				: 'linear-gradient(90deg,#0a84ff,#30d158)';

	return (
		<article
			data-focus-id={`team:${tm.id}`}
			data-team-id={tm.id}
			className={`${styles.card} ${tm.myMyStatus === 'aktif' ? styles.cardMine : ''}`}
		>
			<div className={styles.pills}>
				<span className={`${styles.pill} ${styles.pCategory}`}>{tm.category}</span>
				{tm.myMyStatus === 'aktif' && <span className={`${styles.pill} ${styles.pMine}`}>{t('tmMember')}</span>}
				{tm.myMyStatus === 'basvurdu' && <span className={`${styles.pill} ${styles.pApplied}`}>{t('tmApplied')}</span>}
				{tm.participationType === 'onayli' && <span className={`${styles.pill} ${styles.pMode}`}>{t('tmByApplication')}</span>}
				{tm.status !== 'aktif' && (
					<span className={`${styles.pill} ${styles.pPaused}`}>
						{t(tm.status === 'askida' ? 'tmPaused' : 'tmFinished')}
					</span>
				)}
				{tm.permissions.manage && tm.applications.length > 0 && (
					<span className={styles.tabBadge}>{tm.applications.length}</span>
				)}
			</div>
			<h3 className={styles.cardTitle}>{tm.name}</h3>
			<p className={styles.cardDesc}>{tm.description}</p>
			<div className={styles.captain}>
				<span className={ui.avatar} style={{ marginLeft: 0, background: 'linear-gradient(135deg,#ff9f0a,#ff375f)' }}>
					{initials(tm.leaderNameSurname)}
				</span>
				<span>
					<span className={ui.muted} style={{ fontSize: 11.5 }}>
						{t('tmCaptain')}
					</span>
					<br />
					<strong>{tm.leaderNameSurname || t('tmNoCaptain')}</strong>
				</span>
				<span className={styles.avatars} aria-hidden>
					{tm.members
						.filter((u) => u.userId !== tm.leadId)
						.slice(0, 4)
						.map((u) => (
							<span key={u.userId} className={ui.avatar} title={u.userNameSurname}>
								{initials(u.userNameSurname)}
							</span>
						))}
				</span>
			</div>
			<div className={styles.quota}>
				<div className={styles.quotaRow}>
					<span>
						{t('tmQuota')}: {tm.fullCapacity}/{tm.capacity}
					</span>
					<span style={{ color: tm.remainingCapacity === 0 ? '#ff453a' : '#30d158' }}>
						{tm.remainingCapacity === 0 ? t('tmFull') : fill(t('tmSpotsLeft'), { n: tm.remainingCapacity })}
					</span>
				</div>
				<div className={styles.track}>
					<span style={{ width: `${tm.occupancyRatio}%`, background: quotaColor(tm) }} />
				</div>
			</div>
			<div className={styles.cardActions}>
				{joinButton}
				<button type="button" className={ui.btn} onClick={() => onOpen(tm.id)}>
					{t('tmOpen')} <ChevronRight size={14} />
				</button>
				{tm.permissions.manage && onEdit && (
					<button
						type="button"
						data-icon
						className={ui.btn}
						title={t('tmTabSettings')}
						aria-label={`${t('tmTabSettings')}: ${tm.name}`}
						onClick={() => onEdit(tm)}
					>
						<Settings2 size={14} />
					</button>
				)}
				{tm.permissions.editAll && (
					<button
						type="button"
						data-icon
						className={`${ui.btn} ${ui.btnDanger}`}
						title={t('tmDelete')}
						aria-label={`${t('tmDelete')}: ${tm.name}`}
						onClick={() => onRemove(tm)}
					>
						<Trash2 size={14} />
					</button>
				)}
			</div>
		</article>
	);
}
