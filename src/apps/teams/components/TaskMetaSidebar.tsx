'use client';

import React from 'react';
import { Hand, Trash2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import {
	normalizeDueDate,
	toDateInput,
	type TaskStatus,
} from '@/lib/kanban';
import { initials } from '@/core/text/initials';
import styles from './Kanban.module.css';
import ui from '@/core/ui/ui.module.css';
import { COLUMNS, PRIORITIES, columnMeta, priorityMeta, type TeamTask } from '../types';
import { LabelEditor } from './LabelEditor';

interface TaskMetaSidebarProps {
	task: TeamTask;
	members: { id: string; name: string; role: string }[];
	allLabels: string[];
	currentUserId: string;
	izinler: { manage: boolean; work: boolean; comment: boolean };
	canClaim: boolean;
	due: string | false | null;
	locale: string;
	when: (ts: number) => string;
	onSetStatus: (status: TaskStatus) => void;
	onPatch: (body: Record<string, unknown>) => void;
	onDeleteTask: () => void;
}

export function TaskMetaSidebar({
	task,
	members,
	allLabels,
	currentUserId,
	izinler,
	canClaim,
	due,
	locale,
	when,
	onSetStatus,
	onPatch,
	onDeleteTask,
}: TaskMetaSidebarProps) {
	const { t } = useI18n();
	const col = columnMeta(task.status);
	const prio = priorityMeta(task.oncelik);

	return (
		<aside className={styles.sheetSide}>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('kbStatus')}</span>
				<select
					className={ui.select}
					style={{ maxWidth: 'none', borderLeft: `3px solid ${col.color}` }}
					value={task.status}
					disabled={!izinler.work}
					onChange={(e) => onSetStatus(e.target.value as TaskStatus)}
				>
					{COLUMNS.map((c) => (
						<option key={c.id} value={c.id}>
							{t(c.key)}
						</option>
					))}
				</select>
			</label>

			<div className={ui.field}>
				<span className={ui.fieldLabel}>{t('kbAssignee')}</span>
				{izinler.manage ? (
					<select
						className={ui.select}
						style={{ maxWidth: 'none' }}
						value={task.atananUyeId ?? ''}
						onChange={(e) => onPatch({ atananUyeId: e.target.value || null })}
					>
						<option value="">{t('kbUnassigned')}</option>
						{members.map((m) => (
							<option key={m.id} value={m.id}>
								{m.name}
							</option>
						))}
					</select>
				) : (
					<div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
						<span className={`${ui.avatar} ${task.atananUyeId ? '' : styles.avatarEmpty}`} style={{ marginLeft: 0 }}>
							{task.atananUyeId ? initials(task.atananAdSoyad) : '?'}
						</span>
						{task.atananAdSoyad || t('kbUnassigned')}
					</div>
				)}
				{canClaim && (
					<button type="button" className={ui.primaryBtn} style={{ height: 30 }} onClick={() => onPatch({ atananUyeId: currentUserId })}>
						<Hand size={14} />
						{t('kbClaim')}
					</button>
				)}
			</div>

			<div className={ui.field}>
				<span className={ui.fieldLabel}>{t('kbPriority')}</span>
				<div className={ui.prioPicker} role="radiogroup" aria-label={t('kbPriority')}>
					{PRIORITIES.map((p) => (
						<button
							key={p.id}
							type="button"
							role="radio"
							aria-checked={task.oncelik === p.id}
							disabled={!izinler.manage}
							className={`${ui.prioOption} ${task.oncelik === p.id ? ui.prioOptionActive : ''}`}
							style={{ '--prio': p.color, fontSize: 10.5 } as React.CSSProperties}
							onClick={() => task.oncelik !== p.id && onPatch({ oncelik: p.id })}
						>
							{t(p.key)}
						</button>
					))}
				</div>
			</div>

			<label className={ui.field}>
				<span className={ui.fieldLabel}>
					{t('kbDue')}
					{due && (due === 'gecikti' || due === 'bugun') && (
						<span className={`${styles.badge} ${styles[`due_${due}`]}`} style={{ marginLeft: 6 }}>
							{t(due === 'gecikti' ? 'kbDueOverdue' : 'kbDueToday')}
						</span>
					)}
				</span>
				<input
					className={ui.input}
					type="date"
					disabled={!izinler.manage}
					value={toDateInput(task.teslimTarihi)}
					onChange={(e) =>
						onPatch({ teslimTarihi: e.target.value ? normalizeDueDate(e.target.value) ?? null : null })
					}
				/>
			</label>

			<div className={ui.field}>
				<span className={ui.fieldLabel}>{t('kbLabels')}</span>
				<LabelEditor
					labels={task.etiketler ?? []}
					allLabels={allLabels}
					readOnly={!izinler.work}
					onChange={(etiketler) => onPatch({ etiketler })}
				/>
			</div>

			<div className={ui.hint} style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 'auto' }}>
				<span style={{ color: prio.color, fontWeight: 700 }}>● {t(prio.key)}</span>
				<span>
					{fill(t('kbCreatedBy'), {
						name: task.olusturanAdSoyad || t('kbSomeone'),
						when: new Date(task.olusturma).toLocaleDateString(locale),
					})}
				</span>
				{task.guncellenme ? <span>{fill(t('kbUpdated'), { when: when(task.guncellenme) })}</span> : null}
				{task.tamamlanma ? (
					<span>{fill(t('kbCompletedAt'), { when: new Date(task.tamamlanma).toLocaleDateString(locale) })}</span>
				) : null}
			</div>

			{izinler.manage && (
				<button type="button" className={`${ui.btn} ${ui.btnDanger}`} onClick={onDeleteTask}>
					<Trash2 size={14} />
					{t('kbDelete')}
				</button>
			)}
		</aside>
	);
}
