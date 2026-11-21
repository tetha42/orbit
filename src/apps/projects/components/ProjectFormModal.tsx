'use client';

import React, { useState } from 'react';
import { FolderPlus } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { PROJECT_TITLE_MAX, PROJECT_SUMMARY_MAX, normalizeTechnologies } from '@/lib/projects';
import type { Project } from '@/db/schema';
import ui from '@/core/ui/ui.module.css';
import styles from './Projects.module.css';
import { sendJson } from '@/core/data/http';
import { Sheet } from '@/core/ui/Sheet';
import contract from '../projects.contract.json';

interface Props {
	/** Editing an existing project, or adding a new one. */
	project: Project | null;
	teams: { id: string; name: string }[];
	manage: boolean;
	onClose: () => void;
	onSaved: (project: Project, created: boolean) => void;
}

export function ProjectFormModal({ project, teams, manage, onClose, onSaved }: Props) {
	const { t } = useI18n();
	const [title, setTitle] = useState(project?.title ?? '');
	const [summary, setSummary] = useState(project?.summary ?? '');
	const [description, setDescription] = useState(project?.description ?? '');
	const [repoUrl, setRepoUrl] = useState(project?.repoUrl ?? '');
	const [liveUrl, setLiveUrl] = useState(project?.liveUrl ?? '');
	const [tech, setTech] = useState((project?.technologies ?? []).join(', '));
	const [teamId, setTeamId] = useState(project?.teamId ?? '');
	const [ownerTeamId, setOwnerTeamId] = useState(project?.ownerTeamId ?? project?.teamId ?? '');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	const preview = normalizeTechnologies(tech) ?? [];

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (busy) return;
		setBusy(true);
		setError('');
		const body = {
			title,
			summary,
			description,
			repoUrl,
			liveUrl,
			technologies: tech,
			teamId: teamId || null,
			ownerTeamId: ownerTeamId || null,
		};
		const res = project
			? await sendJson<{ project: Project }>(
					`/api/projects/${encodeURIComponent(project.id)}`,
					'PATCH',
					body,
				)
			: await sendJson<{ project: Project }>('/api/projects', 'POST', body);
		setBusy(false);
		if (!res.ok) {
			setError(res.error || t('kbActionFailed'));
			return;
		}
		onSaved(res.data.project, !project);
	};

	return (
		<Sheet
			title={project ? t('pjFormTitleEdit') : t('pjFormTitleNew')}
			icon={<FolderPlus size={20} color="var(--accent)" />}
			onClose={onClose}
			onSubmit={submit}
			maxWidth={620}
			closeLabel={t('pjClose')}
			footer={
				<>
					<button type="button" className={ui.btn} onClick={onClose}>
						{t('pjCancel')}
					</button>
					<button type="submit" className={ui.primaryBtn} disabled={busy}>
						{project ? t('pjSave') : manage ? t('pjSubmitPublish') : t('pjSubmitProposal')}
					</button>
				</>
			}
		>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('pjFieldTitle')}</span>
				<input
					className={ui.input}
					value={title}
					autoFocus
					maxLength={Math.min(PROJECT_TITLE_MAX, contract.limits.maxTitleLength)}
					onChange={(e) => setTitle(e.target.value)}
					required
					minLength={3}
				/>
			</label>
			<label className={ui.field}>
				<span className={ui.fieldLabel} style={{ display: 'flex' }}>
					{t('pjFieldSummary')}
					<span className={styles.counter}>
						{summary.length}/{PROJECT_SUMMARY_MAX}
					</span>
				</span>
				<textarea
					className={ui.textarea}
					style={{ minHeight: 60 }}
					rows={2}
					value={summary}
					maxLength={PROJECT_SUMMARY_MAX}
					onChange={(e) => setSummary(e.target.value)}
					required
					minLength={10}
				/>
				<span className={ui.hint}>{t('pjFieldSummaryHint')}</span>
			</label>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('pjFieldDesc')}</span>
				<textarea
					className={ui.textarea}
					rows={5}
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					placeholder={t('pjFieldDescPh')}
				/>
			</label>
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
					gap: 12,
				}}
			>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('pjFieldRepo')}</span>
					<input
						className={ui.input}
						type="url"
						value={repoUrl}
						placeholder="https://github.com/tetha42/…"
						onChange={(e) => setRepoUrl(e.target.value)}
					/>
				</label>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('pjFieldDemo')}</span>
					<input
						className={ui.input}
						type="url"
						value={liveUrl}
						placeholder="https://…"
						onChange={(e) => setLiveUrl(e.target.value)}
					/>
				</label>
			</div>
			<span className={ui.hint} style={{ marginTop: -8 }}>
				{t('pjLinkHint')}
			</span>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('pjFieldTech')}</span>
				<input
					className={ui.input}
					value={tech}
					onChange={(e) => setTech(e.target.value)}
					placeholder={t('pjFieldTechPh')}
				/>
				{preview.length > 0 && (
					<div className={styles.techList} style={{ marginTop: 4 }}>
						{preview.map((x) => (
							<span key={x} className={styles.tech}>
								{x}
							</span>
						))}
					</div>
				)}
			</label>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('pjFieldTeam')}</span>
				<select
					className={ui.select}
					style={{ maxWidth: 'none' }}
					value={teamId}
					onChange={(e) => setTeamId(e.target.value)}
				>
					<option value="">{t('pjNoTeam')}</option>
					{teams.map((tm) => (
						<option key={tm.id} value={tm.id}>
							{tm.name}
						</option>
					))}
				</select>
			</label>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('pjFieldOwnerTeam')}</span>
				<select
					className={ui.select}
					style={{ maxWidth: 'none' }}
					value={ownerTeamId}
					onChange={(e) => setOwnerTeamId(e.target.value)}
				>
					<option value="">{t('pjNoTeam')}</option>
					{teams.map((tm) => (
						<option key={tm.id} value={tm.id}>
							{tm.name}
						</option>
					))}
				</select>
			</label>
			{!project && <div className={ui.hint}>{manage ? t('pjManagerHint') : t('pjMemberHint')}</div>}
			{error && (
				<div className={ui.error} role="alert">
					{error}
				</div>
			)}
		</Sheet>
	);
}
