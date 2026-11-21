'use client';

import React, { useState } from 'react';
import { Users } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { Sheet } from '@/core/ui/Sheet';
import {
	CAPACITY_MAX,
	TEAM_DESCRIPTION_MAX,
	TEAM_NAME_MAX,
	type ParticipationType,
} from '@/lib/teams';
import ui from '@/core/ui/ui.module.css';
import styles from './Teams.module.css';
import { sendJson } from '@/core/data/http';
import teamsContract from '../teams.contract.json';
import type { Team } from '../types';

export function EditTeamModal({
	team,
	roster,
	categories,
	onClose,
	onSaved,
}: {
	team: Team;
	roster: { id: string; name: string; surname: string }[];
	categories: string[];
	onClose: () => void;
	onSaved: () => Promise<void>;
}) {
	const { t } = useI18n();
	const all = team.permissions.editAll;
	const [name, setName] = useState(team.name);
	const [category, setCategory] = useState(team.category);
	const [description, setDescription] = useState(team.description);
	const [capacity, setCapacity] = useState(String(team.capacity));
	const [repoUrl, setRepoUrl] = useState(team.repoUrl ?? '');
	const [leadId, setLeadId] = useState(team.leadId ?? '');
	const [participationType, setParticipationType] = useState<ParticipationType>(team.participationType);
	const [status, setStatus] = useState(team.status);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const maxCapacity = Math.min(CAPACITY_MAX, teamsContract.limits.maxTeamCapacity);

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		setBusy(true);
		setError('');
		const body: Record<string, unknown> = { action: 'updateTeam', teamId: team.id };
		if (description !== team.description) body.description = description.trim();
		if (Number(capacity) !== team.capacity) body.capacity = Number(capacity);
		if (repoUrl !== (team.repoUrl ?? '')) body.repoUrl = repoUrl.trim();
		if (participationType !== team.participationType) body.participationType = participationType;
		if (all) {
			if (name !== team.name) body.name = name.trim();
			if (category !== team.category) body.category = category;
			if (status !== team.status) body.status = status;
			if (leadId !== team.leadId) body.leadId = leadId;
		}
		const res = await sendJson('/api/teams', 'POST', body);
		setBusy(false);
		if (!res.ok) {
			setError(res.error || t('kbActionFailed'));
			return;
		}
		await onSaved();
	};

	const categoryOptions = categories.includes(team.category)
		? categories
		: [team.category, ...categories];

	return (
		<Sheet
			title={t('tmSettingsTitle')}
			subtitle={team.name}
			label={t('tmSettingsTitle')}
			icon={<Users size={20} color="var(--accent)" />}
			onClose={onClose}
			closeLabel={t('kbClose')}
			onSubmit={submit}
			footer={
				<>
					<button type="button" className={ui.btn} onClick={onClose}>
						{t('tmCancel')}
					</button>
					<button type="submit" className={ui.primaryBtn} disabled={busy}>
						{t('tmSave')}
					</button>
				</>
			}
		>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('tmFieldName')}</span>
				<input
					className={ui.input}
					disabled={!all}
					required
					minLength={3}
					maxLength={TEAM_NAME_MAX}
					value={name}
					onChange={(e) => setName(e.target.value)}
				/>
			</label>
			<div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('tmFieldCategory')}</span>
					<select
						className={ui.select}
						style={{ maxWidth: 'none' }}
						disabled={!all}
						value={category}
						onChange={(e) => setCategory(e.target.value)}
					>
						{categoryOptions.map((c) => (
							<option key={c} value={c}>
								{c}
							</option>
						))}
					</select>
				</label>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('tmFieldQuota')}</span>
					<input
						className={ui.input}
						type="number"
						min={Math.max(1, team.fullCapacity)}
						max={maxCapacity}
						required
						value={capacity}
						onChange={(e) => setCapacity(e.target.value)}
					/>
				</label>
			</div>
			{all && (
				<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
					<label className={ui.field}>
						<span className={ui.fieldLabel}>{t('tmFieldStatus')}</span>
						<select
							className={ui.select}
							style={{ maxWidth: 'none' }}
							value={status}
							onChange={(e) => setStatus(e.target.value as typeof team.status)}
						>
							<option value="active">{t('tmStatusActive')}</option>
							<option value="suspended">{t('tmStatusPaused')}</option>
							<option value="done">{t('tmStatusFinished')}</option>
						</select>
					</label>
					<label className={ui.field}>
						<span className={ui.fieldLabel}>{t('tmFieldCaptain')}</span>
						<select
							className={ui.select}
							style={{ maxWidth: 'none' }}
							value={leadId}
							onChange={(e) => setLeadId(e.target.value)}
						>
							<option value="">—</option>
							{roster.map((m) => (
								<option key={m.id} value={m.id}>
									{m.name} {m.surname}
								</option>
							))}
						</select>
					</label>
				</div>
			)}
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('tmFieldRepo')}</span>
				<input
					className={ui.input}
					type="url"
					placeholder="https://github.com/tetha42/…"
					value={repoUrl}
					onChange={(e) => setRepoUrl(e.target.value)}
				/>
			</label>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('tmFieldDesc')}</span>
				<textarea
					className={ui.textarea}
					rows={3}
					required
					minLength={10}
					maxLength={TEAM_DESCRIPTION_MAX}
					value={description}
					onChange={(e) => setDescription(e.target.value)}
				/>
			</label>
			<div className={ui.field}>
				<span className={ui.fieldLabel}>{t('tmFieldJoin')}</span>
				<div className={styles.radioList} role="radiogroup">
					<label className={styles.radio}>
						<input
							type="radio"
							name="edit-participation"
							checked={participationType === 'open'}
							onChange={() => setParticipationType('open')}
						/>
						{t('tmJoinOpen')}
					</label>
					<label className={styles.radio}>
						<input
							type="radio"
							name="edit-participation"
							checked={participationType === 'approval'}
							onChange={() => setParticipationType('approval')}
						/>
						{t('tmJoinApproval')}
					</label>
				</div>
			</div>
			{error && (
				<div className={ui.error} role="alert">
					{error}
				</div>
			)}
		</Sheet>
	);
}
