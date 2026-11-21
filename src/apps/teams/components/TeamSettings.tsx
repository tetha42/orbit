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
	roster: { id: string; name: string; surname: string }[];
	categories: string[];
	notify: (text: string, tone?: 'success' | 'error') => void;
	onChanged: () => Promise<void>;
	onDelete: () => void;
}

/** Captain: description, quota, repo, membership mode. Management: everything, including handing over. */
export function TeamSettings({ team, roster, categories, notify, onChanged, onDelete }: Props) {
	const { t } = useI18n();
	const all = team.permissions.editAll;
	const [name, setName] = useState(team.name);
	const [category, setCategory] = useState(team.category);
	const [description, setDescription] = useState(team.description);
	const [capacity, setCapacity] = useState(String(team.capacity));
	const [repoUrl, setRepoUrl] = useState(team.repoUrl ?? '');
	const [participationType, setParticipationType] = useState(team.participationType);
	const [status, setStatus] = useState(team.status);
	const [leadId, setLeadId] = useState(team.leadId ?? '');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	const save = async (e: React.FormEvent) => {
		e.preventDefault();
		setBusy(true);
		setError('');
		// Send only what changed, so a captain never trips the management-only fields.
		const body: Record<string, unknown> = { action: 'updateTeam', teamId: team.id };
		if (description !== team.description) body.description = description;
		if (Number(capacity) !== team.capacity) body.capacity = Number(capacity);
		if (repoUrl !== (team.repoUrl ?? '')) body.repoUrl = repoUrl;
		if (participationType !== team.participationType) body.participationType = participationType;
		if (all) {
			if (name !== team.name) body.name = name;
			if (category !== team.category) body.category = category;
			if (status !== team.status) body.status = status;
			if (leadId && leadId !== team.leadId) body.leadId = leadId;
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
	const categoryOptions = categories.includes(team.category) ? categories : [team.category, ...categories];

	return (
		<form className={styles.settings} onSubmit={save} aria-label={t('tmSettingsTitle')}>
			<h4 className={styles.sectionHead}>
				<Settings2 size={16} /> {t('tmSettingsTitle')}
			</h4>
			{!all && <div className={ui.hint}>{t('tmOnlyBoard')}</div>}
			<div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('tmFieldName')}</span>
					<input className={ui.input} value={name} disabled={!all} maxLength={TEAM_NAME_MAX} onChange={(e) => setName(e.target.value)} />
				</label>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('tmFieldCategory')}</span>
					<select className={ui.select} style={{ maxWidth: 'none' }} value={category} disabled={!all} onChange={(e) => setCategory(e.target.value)}>
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
				<textarea className={ui.textarea} rows={4} maxLength={TEAM_DESCRIPTION_MAX} value={description} onChange={(e) => setDescription(e.target.value)} />
			</label>
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('tmFieldQuota')}</span>
					<input className={ui.input} type="number" min={Math.max(1, team.fullCapacity)} max={CAPACITY_MAX} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
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
						<input type="radio" name="participationType" checked={participationType === 'open'} onChange={() => setParticipationType('open')} />
						{t('tmJoinOpen')}
					</label>
					<label className={styles.radio}>
						<input type="radio" name="participationType" checked={participationType === 'approval'} onChange={() => setParticipationType('approval')} />
						{t('tmJoinApproval')}
					</label>
				</div>
			</div>
			{all && (
				<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
					<label className={ui.field}>
						<span className={ui.fieldLabel}>{t('tmFieldStatus')}</span>
						<select className={ui.select} style={{ maxWidth: 'none' }} value={status} onChange={(e) => setStatus(e.target.value as Team['status'])}>
							<option value="active">{t('tmStatusActive')}</option>
							<option value="suspended">{t('tmStatusPaused')}</option>
							<option value="done">{t('tmStatusFinished')}</option>
						</select>
					</label>
					<label className={ui.field}>
						<span className={ui.fieldLabel}>{t('tmFieldCaptain')}</span>
						<select className={ui.select} style={{ maxWidth: 'none' }} value={leadId} onChange={(e) => setLeadId(e.target.value)}>
							{!team.leadId && <option value="">—</option>}
							{roster.map((m) => (
								<option key={m.id} value={m.id}>
									{m.name} {m.surname}
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
