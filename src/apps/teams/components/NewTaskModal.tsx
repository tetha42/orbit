'use client';

import React, { useState } from 'react';
import { ListPlus } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import {
	TITLE_MAX,
	normalizeDueDate,
	type TaskStatus,
	type TaskPriority,
} from '@/lib/kanban';
import styles from '@/core/ui/ui.module.css';
import { COLUMNS, PRIORITIES } from '../types';
import { sendJson } from '@/core/data/http';
import { LabelEditor } from './LabelEditor';
import { Sheet } from '@/core/ui/Sheet';

interface Props {
	teamId: string;
	column: TaskStatus;
	members: { id: string; name: string; role: string }[];
	labels: string[];
	onClose: () => void;
	onCreated: () => void | Promise<void>;
}

export function NewTaskModal({ teamId, column, members, labels, onClose, onCreated }: Props) {
	const { t } = useI18n();
	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [status, setStatus] = useState<TaskStatus>(column);
	const [priority, setPriority] = useState<TaskPriority>('medium');
	const [assignee, setAssignee] = useState('');
	const [due, setDue] = useState('');
	const [tags, setTags] = useState<string[]>([]);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!title.trim() || busy) return;
		setBusy(true);
		setError('');
		const res = await sendJson('/api/teams', 'POST', {
			action: 'addTask',
			teamId: teamId,
			title: title.trim(),
			description,
			status,
			priority,
			assigneeMemberId: assignee || undefined,
			dueDate: due ? normalizeDueDate(due) : undefined,
			tags,
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
			icon={<ListPlus size={20} color="var(--accent)" />}
			onClose={onClose}
			onSubmit={submit}
			closeLabel={t('kbClose')}
			footer={
				<>
					<button type="button" className={styles.btn} onClick={onClose}>
						{t('kbCancel')}
					</button>
					<button type="submit" className={styles.primaryBtn} disabled={busy || !title.trim()}>
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
					value={title}
					maxLength={TITLE_MAX}
					onChange={(e) => setTitle(e.target.value)}
					placeholder={t('kbTitlePh')}
					required
				/>
			</label>
			<label className={styles.field}>
				<span className={styles.fieldLabel}>{t('kbDesc')}</span>
				<textarea
					className={styles.textarea}
					value={description}
					onChange={(e) => setDescription(e.target.value)}
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
						onChange={(e) => setStatus(e.target.value as TaskStatus)}
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
						value={assignee}
						onChange={(e) => setAssignee(e.target.value)}
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
						value={due}
						onChange={(e) => setDue(e.target.value)}
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
							aria-checked={priority === p.id}
							className={`${styles.prioOption} ${priority === p.id ? styles.prioOptionActive : ''}`}
							style={{ '--prio': p.color } as React.CSSProperties}
							onClick={() => setPriority(p.id)}
						>
							{t(p.key)}
						</button>
					))}
				</div>
			</div>
			<div className={styles.field}>
				<span className={styles.fieldLabel}>{t('kbLabels')}</span>
				<LabelEditor labels={tags} allLabels={labels} onChange={setTags} />
			</div>
			{!assignee && <div className={styles.hint}>{t('kbPoolHint')}</div>}
			{error && <div className={styles.error}>{error}</div>}
		</Sheet>
	);
}
