'use client';

import React from 'react';
import { Award, Calendar, CheckSquare, Crown, FolderGit2, ListTodo, Users } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { UserSummary } from '@/db';
import ui from '@/core/ui/ui.module.css';
import styles from './Account.module.css';

interface AccountStatsCardsProps {
	summary: UserSummary;
}

export function AccountStatsCards({ summary }: AccountStatsCardsProps) {
	const { t } = useI18n();

	const stats = [
		{ icon: <Users size={16} />, value: summary.teams.length, label: t('acStatTeams') },
		{ icon: <Calendar size={16} />, value: summary.attendedEvent, label: t('acStatEvents') },
		{ icon: <CheckSquare size={16} />, value: summary.completedTask, label: t('acStatTasksDone') },
		{ icon: <ListTodo size={16} />, value: summary.openTask, label: t('acStatTasksOpen') },
		{ icon: <Award size={16} />, value: summary.certificate, label: t('acStatCerts') },
		{ icon: <FolderGit2 size={16} />, value: summary.project, label: t('acStatProjects') },
	];

	return (
		<>
			<section className={styles.stats}>
				{stats.map((s) => (
					<div key={s.label} className={styles.stat}>
						<span className={styles.statIcon}>{s.icon}</span>
						<div>
							<div className={styles.statValue}>{s.value}</div>
							<div className={styles.statLabel}>{s.label}</div>
						</div>
					</div>
				))}
			</section>

			<section className={styles.card}>
				<h4 className={styles.cardTitle}>
					<Users size={15} /> {t('acMyTeams')}
				</h4>
				{summary.teams.length === 0 ? (
					<div className={ui.muted}>{t('acNoTeams')}</div>
				) : (
					<div className={styles.teams}>
						{summary.teams.map((tm) => (
							<span key={tm.id} className={styles.teamChip}>
								{tm.captainMi && <Crown size={12} color="#ff9f0a" aria-label={t('acCaptain')} />}
								<strong>{tm.name}</strong>
								<span className={ui.muted}>{tm.role}</span>
							</span>
						))}
					</div>
				)}
			</section>
		</>
	);
}
