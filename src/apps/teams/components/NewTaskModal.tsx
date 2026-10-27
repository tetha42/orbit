'use client';

import React, { useState } from 'react';
import { ListPlus } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import {
	BASLIK_MAX,
	normalizeTeslimTarihi,
	type GorevDurumu,
	type GorevOnceligi,
} from '@/lib/kanban';
import styles from '@/core/ui/ui.module.css';
import { COLUMNS, PRIORITIES } from '../types';
import { sendJson } from '@/core/data/http';
import { LabelEditor } from './LabelEditor';
import { Sheet } from '@/core/ui/Sheet';

interface Props {
	teamId: string;
	column: GorevDurumu;
	members: { id: string; name: string; role: string }[];
	labels: string[];
	onClose: () => void;
	onCreated: () => void | Promise<void>;
}

export function NewTaskModal({ teamId, column, members, labels, onClose, onCreated }: Props) {
	const { t } = useI18n();
	const [baslik, setBaslik] = useState('');
	const [aciklama, setAciklama] = useState('');
	const [status, setDurum] = useState<GorevDurumu>(column);
	const [oncelik, setOncelik] = useState<GorevOnceligi>('orta');
	const [atanan, setAtanan] = useState('');
	const [teslim, setTeslim] = useState('');
	const [etiketler, setEtiketler] = useState<string[]>([]);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!baslik.trim() || busy) return;
		setBusy(true);
		setError('');
		const res = await sendJson('/api/teams', 'POST', {
			action: 'addTask',
			teamId: teamId,
			baslik: baslik.trim(),
			aciklama,
			status,
			oncelik,
			atananUyeId: atanan || undefined,
			teslimTarihi: teslim ? normalizeTeslimTarihi(teslim) : undefined,
			etiketler,
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
			title={t('kbNewTask')}
			icon={<ListPlus size={20} color="#0a84ff" />}
			onClose={onClose}
			onSubmit={submit}
			closeLabel={t('kbClose')}
			footer={
				<>
					<button type="button" className={styles.btn} onClick={onClose}>
						{t('kbCancel')}
					</button>
					<button type="submit" className={styles.primaryBtn} disabled={busy || !baslik.trim()}>
						{t('kbCreate')}
					</button>
				</>
			}
		>
			<label className={styles.field}>
				<span className={styles.fieldLabel}>{t('kbTitle')}</span>
				<input
					autoFocus
					className={styles.input}
					value={baslik}
					maxLength={BASLIK_MAX}
					onChange={(e) => setBaslik(e.target.value)}
					placeholder={t('kbTitlePh')}
					required
				/>
			</label>
			<label className={styles.field}>
				<span className={styles.fieldLabel}>{t('kbDesc')}</span>
				<textarea
					className={styles.textarea}
					value={aciklama}
					onChange={(e) => setAciklama(e.target.value)}
					placeholder={t('kbDescPh')}
					rows={3}
				/>
			</label>
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
					gap: 12,
				}}
			>
				<label className={styles.field}>
					<span className={styles.fieldLabel}>{t('kbColumn')}</span>
					<select
						className={styles.select}
						style={{ maxWidth: 'none' }}
						value={status}
						onChange={(e) => setDurum(e.target.value as GorevDurumu)}
					>
						{COLUMNS.map((c) => (
							<option key={c.id} value={c.id}>
								{t(c.key)}
							</option>
						))}
					</select>
				</label>
				<label className={styles.field}>
					<span className={styles.fieldLabel}>{t('kbAssignee')}</span>
					<select
						className={styles.select}
						style={{ maxWidth: 'none' }}
						value={atanan}
						onChange={(e) => setAtanan(e.target.value)}
					>
						<option value="">{t('kbUnassigned')}</option>
						{members.map((m) => (
							<option key={m.id} value={m.id}>
								{m.name}
								{m.role ? ` · ${m.role}` : ''}
							</option>
						))}
					</select>
				</label>
				<label className={styles.field}>
					<span className={styles.fieldLabel}>{t('kbDue')}</span>
					<input
						className={styles.input}
						type="date"
						value={teslim}
						onChange={(e) => setTeslim(e.target.value)}
					/>
				</label>
			</div>
			<div className={styles.field}>
				<span className={styles.fieldLabel}>{t('kbPriority')}</span>
				<div className={styles.prioPicker} role="radiogroup">
					{PRIORITIES.map((p) => (
						<button
							key={p.id}
							type="button"
							role="radio"
							aria-checked={oncelik === p.id}
							className={`${styles.prioOption} ${oncelik === p.id ? styles.prioOptionActive : ''}`}
							style={{ '--prio': p.color } as React.CSSProperties}
							onClick={() => setOncelik(p.id)}
						>
							{t(p.key)}
						</button>
					))}
				</div>
			</div>
			<div className={styles.field}>
				<span className={styles.fieldLabel}>{t('kbLabels')}</span>
				<LabelEditor labels={etiketler} allLabels={labels} onChange={setEtiketler} />
			</div>
			{!atanan && <div className={styles.hint}>{t('kbPoolHint')}</div>}
			{error && <div className={styles.error}>{error}</div>}
		</Sheet>
	);
}
