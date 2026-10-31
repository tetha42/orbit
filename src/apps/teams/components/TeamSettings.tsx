'use client';

import React, { useState } from 'react';
import { Settings2, Trash2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { CAPACITY_MAX, TEAM_DESCRIPTION_MAX, TEAM_NAME_MAX } from '@/lib/teams';
import ui from '@/core/ui/ui.module.css';
import styles from './Teams.module.css';
import { sendJson } from '@/core/data/http';
import type { Team } from '../types';

interface Props {
	team: Team;
	roster: { id: string; ad: string; soyad: string }[];
	categories: string[];
	notify: (text: string, tone?: 'success' | 'error') => void;
	onChanged: () => Promise<void>;
	onDelete: () => void;
}

/** Captain: description, quota, repo, membership mode. Management: everything, including handing over. */
export function TeamSettings({ team, roster, categories, notify, onChanged, onDelete }: Props) {
	const { t } = useI18n();
	const all = team.izinler.editAll;
	const [ad, setAd] = useState(team.ad);
	const [kategori, setKategori] = useState(team.kategori);
	const [aciklama, setAciklama] = useState(team.aciklama);
	const [kontenjan, setKontenjan] = useState(String(team.kontenjan));
	const [repoUrl, setRepoUrl] = useState(team.repoUrl ?? '');
	const [katilimTuru, setKatilimTuru] = useState(team.katilimTuru);
	const [status, setDurum] = useState(team.status);
	const [liderId, setLiderId] = useState(team.liderId ?? '');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	const save = async (e: React.FormEvent) => {
		e.preventDefault();
		setBusy(true);
		setError('');
		// Send only what changed, so a captain never trips the management-only fields.
		const body: Record<string, unknown> = { action: 'updateTeam', teamId: team.id };
		if (aciklama !== team.aciklama) body.aciklama = aciklama;
		if (Number(kontenjan) !== team.kontenjan) body.kontenjan = Number(kontenjan);
		if (repoUrl !== (team.repoUrl ?? '')) body.repoUrl = repoUrl;
		if (katilimTuru !== team.katilimTuru) body.katilimTuru = katilimTuru;
		if (all) {
			if (ad !== team.ad) body.ad = ad;
			if (kategori !== team.kategori) body.kategori = kategori;
			if (status !== team.status) body.status = status;
			if (liderId && liderId !== team.liderId) body.liderId = liderId;
		}
		const res = await sendJson('/api/teams', 'POST', body);
		setBusy(false);
		if (!res.ok) {
			setError(res.error || t('kbActionFailed'));
			return;
		}
		notify(t('tmSaved'));
		await onChanged();
	};

	// Legacy rows may hold a category outside the list; keep it selectable.
	const categoryOptions = categories.includes(team.kategori) ? categories : [team.kategori, ...categories];

	return (
		<form className={styles.settings} onSubmit={save} aria-label={t('tmSettingsTitle')}>
			<h4 className={styles.sectionHead}>
				<Settings2 size={16} /> {t('tmSettingsTitle')}
			</h4>
			{!all && <div className={ui.hint}>{t('tmOnlyBoard')}</div>}
			<div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('tmFieldName')}</span>
					<input className={ui.input} value={ad} disabled={!all} maxLength={TEAM_NAME_MAX} onChange={(e) => setAd(e.target.value)} />
				</label>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('tmFieldCategory')}</span>
					<select className={ui.select} style={{ maxWidth: 'none' }} value={kategori} disabled={!all} onChange={(e) => setKategori(e.target.value)}>
						{categoryOptions.map((c) => (
							<option key={c} value={c}>
								{c}
							</option>
						))}
					</select>
				</label>
			</div>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('tmFieldDesc')}</span>
				<textarea className={ui.textarea} rows={4} maxLength={TEAM_DESCRIPTION_MAX} value={aciklama} onChange={(e) => setAciklama(e.target.value)} />
			</label>
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('tmFieldQuota')}</span>
					<input className={ui.input} type="number" min={Math.max(1, team.doluKontenjan)} max={CAPACITY_MAX} value={kontenjan} onChange={(e) => setKontenjan(e.target.value)} />
				</label>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('tmFieldRepo')}</span>
					<input className={ui.input} type="url" placeholder="https://github.com/tetha42/…" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} />
				</label>
			</div>
			<div className={ui.field}>
				<span className={ui.fieldLabel}>{t('tmFieldJoin')}</span>
				<div className={styles.radioList} role="radiogroup">
					<label className={styles.radio}>
						<input type="radio" name="katilim" checked={katilimTuru === 'acik'} onChange={() => setKatilimTuru('acik')} />
						{t('tmJoinOpen')}
					</label>
					<label className={styles.radio}>
						<input type="radio" name="katilim" checked={katilimTuru === 'onayli'} onChange={() => setKatilimTuru('onayli')} />
						{t('tmJoinApproval')}
					</label>
				</div>
			</div>
			{all && (
				<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
					<label className={ui.field}>
						<span className={ui.fieldLabel}>{t('tmFieldStatus')}</span>
						<select className={ui.select} style={{ maxWidth: 'none' }} value={status} onChange={(e) => setDurum(e.target.value as Team['status'])}>
							<option value="aktif">{t('tmStatusActive')}</option>
							<option value="askida">{t('tmStatusPaused')}</option>
							<option value="tamamlandi">{t('tmStatusFinished')}</option>
						</select>
					</label>
					<label className={ui.field}>
						<span className={ui.fieldLabel}>{t('tmFieldCaptain')}</span>
						<select className={ui.select} style={{ maxWidth: 'none' }} value={liderId} onChange={(e) => setLiderId(e.target.value)}>
							{!team.liderId && <option value="">—</option>}
							{roster.map((m) => (
								<option key={m.id} value={m.id}>
									{m.ad} {m.soyad}
								</option>
							))}
						</select>
						<span className={ui.hint}>{t('tmCaptainHint')}</span>
					</label>
				</div>
			)}
			{error && (
				<div className={ui.error} role="alert">
					{error}
				</div>
			)}
			<div className={ui.btnRow} style={{ justifyContent: 'space-between' }}>
				{all ? (
					<button type="button" className={`${ui.btn} ${ui.btnDanger}`} onClick={onDelete}>
						<Trash2 size={14} /> {t('tmDelete')}
					</button>
				) : (
					<span />
				)}
				<button type="submit" className={ui.primaryBtn} disabled={busy}>
					{t('tmSave')}
				</button>
			</div>
		</form>
	);
}
