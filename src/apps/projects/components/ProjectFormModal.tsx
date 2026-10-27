'use client';

import React, { useState } from 'react';
import { FolderPlus } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { PROJE_BASLIK_MAX, PROJE_OZET_MAX, normalizeTeknolojiler } from '@/lib/projects';
import type { Project } from '@/db/schema';
import ui from '@/core/ui/ui.module.css';
import styles from './Projects.module.css';
import { sendJson } from '@/core/data/http';
import { Sheet } from '@/core/ui/Sheet';

interface Props {
	/** Editing an existing project, or adding a new one. */
	proje: Project | null;
	teams: { id: string; ad: string }[];
	manage: boolean;
	onClose: () => void;
	onSaved: (proje: Project, created: boolean) => void;
}

export function ProjectFormModal({ proje, teams, manage, onClose, onSaved }: Props) {
	const { t } = useI18n();
	const [baslik, setBaslik] = useState(proje?.baslik ?? '');
	const [ozet, setOzet] = useState(proje?.ozet ?? '');
	const [aciklama, setAciklama] = useState(proje?.aciklama ?? '');
	const [repoUrl, setRepoUrl] = useState(proje?.repoUrl ?? '');
	const [canliUrl, setCanliUrl] = useState(proje?.canliUrl ?? '');
	const [tech, setTech] = useState((proje?.teknolojiler ?? []).join(', '));
	const [teamId, setTakimId] = useState(proje?.teamId ?? '');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	const preview = normalizeTeknolojiler(tech) ?? [];

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (busy) return;
		setBusy(true);
		setError('');
		const body = {
			baslik,
			ozet,
			aciklama,
			repoUrl,
			canliUrl,
			teknolojiler: tech,
			teamId: teamId || null,
		};
		const res = proje
			? await sendJson<{ proje: Project }>(
					`/api/projects/${encodeURIComponent(proje.id)}`,
					'PATCH',
					body,
				)
			: await sendJson<{ proje: Project }>('/api/projects', 'POST', body);
		setBusy(false);
		if (!res.ok) {
			setError(res.error || t('kbActionFailed'));
			return;
		}
		onSaved(res.data.proje, !proje);
	};

	return (
		<Sheet
			title={proje ? t('pjFormTitleEdit') : t('pjFormTitleNew')}
			icon={<FolderPlus size={20} color="#0a84ff" />}
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
						{proje ? t('pjSave') : manage ? t('pjSubmitPublish') : t('pjSubmitProposal')}
					</button>
				</>
			}
		>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('pjFieldTitle')}</span>
				<input
					className={ui.input}
					value={baslik}
					autoFocus
					maxLength={PROJE_BASLIK_MAX}
					onChange={(e) => setBaslik(e.target.value)}
					required
					minLength={3}
				/>
			</label>
			<label className={ui.field}>
				<span className={ui.fieldLabel} style={{ display: 'flex' }}>
					{t('pjFieldSummary')}
					<span className={styles.counter}>
						{ozet.length}/{PROJE_OZET_MAX}
					</span>
				</span>
				<textarea
					className={ui.textarea}
					style={{ minHeight: 60 }}
					rows={2}
					value={ozet}
					maxLength={PROJE_OZET_MAX}
					onChange={(e) => setOzet(e.target.value)}
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
					value={aciklama}
					onChange={(e) => setAciklama(e.target.value)}
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
						value={canliUrl}
						placeholder="https://…"
						onChange={(e) => setCanliUrl(e.target.value)}
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
					onChange={(e) => setTakimId(e.target.value)}
				>
					<option value="">{t('pjNoTeam')}</option>
					{teams.map((tm) => (
						<option key={tm.id} value={tm.id}>
							{tm.ad}
						</option>
					))}
				</select>
			</label>
			{!proje && <div className={ui.hint}>{manage ? t('pjManagerHint') : t('pjMemberHint')}</div>}
			{error && (
				<div className={ui.error} role="alert">
					{error}
				</div>
			)}
		</Sheet>
	);
}
