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
		team.kalanKontenjan === 0
			? '#ff453a'
			: team.dolulukOrani > 75
				? 'linear-gradient(90deg,#ff9f0a,#ff453a)'
				: 'linear-gradient(90deg,#0a84ff,#30d158)';

	return (
		<article
			data-focus-id={`team:${tm.id}`}
			data-team-id={tm.id}
			className={`${styles.card} ${tm.benimDurumum === 'aktif' ? styles.cardMine : ''}`}
		>
			<div className={styles.pills}>
				<span className={`${styles.pill} ${styles.pCategory}`}>{tm.kategori}</span>
				{tm.benimDurumum === 'aktif' && <span className={`${styles.pill} ${styles.pMine}`}>{t('tmMember')}</span>}
				{tm.benimDurumum === 'basvurdu' && <span className={`${styles.pill} ${styles.pApplied}`}>{t('tmApplied')}</span>}
				{tm.katilimTuru === 'onayli' && <span className={`${styles.pill} ${styles.pMode}`}>{t('tmByApplication')}</span>}
				{tm.status !== 'aktif' && (
					<span className={`${styles.pill} ${styles.pPaused}`}>
						{t(tm.status === 'askida' ? 'tmPaused' : 'tmFinished')}
					</span>
				)}
				{tm.izinler.manage && tm.basvurular.length > 0 && (
					<span className={styles.tabBadge}>{tm.basvurular.length}</span>
				)}
			</div>
			<h3 className={styles.cardTitle}>{tm.ad}</h3>
			<p className={styles.cardDesc}>{tm.aciklama}</p>
			<div className={styles.captain}>
				<span className={ui.avatar} style={{ marginLeft: 0, background: 'linear-gradient(135deg,#ff9f0a,#ff375f)' }}>
					{initials(tm.liderAdSoyad)}
				</span>
				<span>
					<span className={ui.muted} style={{ fontSize: 11.5 }}>
						{t('tmCaptain')}
					</span>
					<br />
					<strong>{tm.liderAdSoyad || t('tmNoCaptain')}</strong>
				</span>
				<span className={styles.avatars} aria-hidden>
					{tm.uyeler
						.filter((u) => u.userId !== tm.liderId)
						.slice(0, 4)
						.map((u) => (
							<span key={u.userId} className={ui.avatar} title={u.kullaniciAdSoyad}>
								{initials(u.kullaniciAdSoyad)}
							</span>
						))}
				</span>
			</div>
			<div className={styles.quota}>
				<div className={styles.quotaRow}>
					<span>
						{t('tmQuota')}: {tm.doluKontenjan}/{tm.kontenjan}
					</span>
					<span style={{ color: tm.kalanKontenjan === 0 ? '#ff453a' : '#30d158' }}>
						{tm.kalanKontenjan === 0 ? t('tmFull') : fill(t('tmSpotsLeft'), { n: tm.kalanKontenjan })}
					</span>
				</div>
				<div className={styles.track}>
					<span style={{ width: `${tm.dolulukOrani}%`, background: quotaColor(tm) }} />
				</div>
			</div>
			<div className={styles.cardActions}>
				{joinButton}
				<button type="button" className={ui.btn} onClick={() => onOpen(tm.id)}>
					{t('tmOpen')} <ChevronRight size={14} />
				</button>
				{tm.izinler.manage && onEdit && (
					<button
						type="button"
						data-icon
						className={ui.btn}
						title={t('tmTabSettings')}
						aria-label={`${t('tmTabSettings')}: ${tm.ad}`}
						onClick={() => onEdit(tm)}
					>
						<Settings2 size={14} />
					</button>
				)}
				{tm.izinler.editAll && (
					<button
						type="button"
						data-icon
						className={`${ui.btn} ${ui.btnDanger}`}
						title={t('tmDelete')}
						aria-label={`${t('tmDelete')}: ${tm.ad}`}
						onClick={() => onRemove(tm)}
					>
						<Trash2 size={14} />
					</button>
				)}
			</div>
		</article>
	);
}
