'use client';

import React from 'react';
import { Lock } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import styles from './Teams.module.css';
import ui from '@/core/ui/ui.module.css';

interface LockedTeamViewProps {
	joinButton: React.ReactNode;
}

export function LockedTeamView({ joinButton }: LockedTeamViewProps) {
	const { t } = useI18n();

	return (
		<div className={styles.locked}>
			<div className={styles.lockedCard}>
				<Lock size={36} color="#ff9f0a" />
				<h3 style={{ margin: 0, fontSize: 17 }}>{t('tmLocked')}</h3>
				<p className={ui.muted} style={{ margin: 0, lineHeight: 1.5 }}>
					{t('tmLockedHint')}
				</p>
				{joinButton}
			</div>
		</div>
	);
}
