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

export function NewTeamModal({
	roster,
	categories,
	onClose,
	onCreated,
}: {
	roster: { id: string; name: string; surname: string }[];
	categories: string[];
	onClose: () => void;
	onCreated: () => Promise<void>;
}) {
	const { t } = useI18n();
	const [name, setName] = useState('');
	const [category, setCategory] = useState<string>(categories[0] ?? '');
	const [description, setDescription] = useState('');
	const [capacity, setCapacity] = useState('6');
	const [repoUrl, setRepoUrl] = useState('');
	const [leadId, setLeadId] = useState('');
	const [participationType, setParticipationType] = useState<ParticipationType>('open');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const maxCapacity = Math.min(CAPACITY_MAX, teamsContract.limits.maxTeamCapacity);

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		setBusy(true);
		setError('');
		const res = await sendJson('/api/teams', 'POST', {
			action: 'createTeam',
			name: name.trim(),
			category,
			description: description.trim(),
			capacity: Number(capacity),
			repoUrl: repoUrl.trim() || undefined,
			leadId: leadId || undefined,
			participationType,
		});
		setBusy(false);
		if (!res.ok) {
			setError(res.error || t('kbActionFailed'));
			return;
		}
		await onCreated();
	};

	return (
		<Sheet
			title={t('tmNewTeam')}
			label={t('tmNewTeam')}
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
						{t('tmCreate')}
					</button>
				</>
			}
		>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('tmFieldName')}</span>
				<input
					className={ui.input}
					autoFocus
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
						value={category}
						onChange={(e) => setCategory(e.target.value)}
					>
						{categories.map((c) => (
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
						min={1}
						max={maxCapacity}
						required
						value={capacity}
						onChange={(e) => setCapacity(e.target.value)}
					/>
				</label>
			</div>
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
							name="new-participation"
							checked={participationType === 'open'}
							onChange={() => setParticipationType('open')}
						/>
						{t('tmJoinOpen')}
					</label>
					<label className={styles.radio}>
						<input
							type="radio"
							name="new-participation"
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
