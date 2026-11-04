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
	permissions: { manage: boolean; work: boolean; comment: boolean };
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
	permissions,
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
	const prio = priorityMeta(task.priority);

	return (
		<aside className={styles.sheetSide}>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('kbStatus')}</span>
				<select
					className={ui.select}
					style={{ maxWidth: 'none', borderLeft: `3px solid ${col.color}` }}
					value={task.status}
					disabled={!permissions.work}
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
				{permissions.manage ? (
					<select
						className={ui.select}
						style={{ maxWidth: 'none' }}
						value={task.assigneeMemberId ?? ''}
						onChange={(e) => onPatch({ assigneeMemberId: e.target.value || null })}
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
						<span className={`${ui.avatar} ${task.assigneeMemberId ? '' : styles.avatarEmpty}`} style={{ marginLeft: 0 }}>
							{task.assigneeMemberId ? initials(task.assigneeNameSurname) : '?'}
						</span>
						{task.assigneeNameSurname || t('kbUnassigned')}
					</div>
				)}
				{canClaim && (
					<button type="button" className={ui.primaryBtn} style={{ height: 30 }} onClick={() => onPatch({ assigneeMemberId: currentUserId })}>
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
							aria-checked={task.priority === p.id}
							disabled={!permissions.manage}
							className={`${ui.prioOption} ${task.priority === p.id ? ui.prioOptionActive : ''}`}
							style={{ '--prio': p.color, fontSize: 10.5 } as React.CSSProperties}
							onClick={() => task.priority !== p.id && onPatch({ priority: p.id })}
						>
							{t(p.key)}
						</button>
					))}
				</div>
			</div>

			<label className={ui.field}>
				<span className={ui.fieldLabel}>
					{t('kbDue')}
					{due && (due === 'overdue' || due === 'today') && (
						<span className={`${styles.badge} ${styles[`due_${due}`]}`} style={{ marginLeft: 6 }}>
							{t(due === 'overdue' ? 'kbDueOverdue' : 'kbDueToday')}
						</span>
					)}
				</span>
				<input
					className={ui.input}
					type="date"
					disabled={!permissions.manage}
					value={toDateInput(task.dueDate)}
					onChange={(e) =>
						onPatch({ dueDate: e.target.value ? normalizeDueDate(e.target.value) ?? null : null })
					}
				/>
			</label>

			<div className={ui.field}>
				<span className={ui.fieldLabel}>{t('kbLabels')}</span>
				<LabelEditor
					labels={task.tags ?? []}
					allLabels={allLabels}
					readOnly={!permissions.work}
					onChange={(tags) => onPatch({ tags })}
				/>
			</div>

			<div className={ui.hint} style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 'auto' }}>
				<span style={{ color: prio.color, fontWeight: 700 }}>● {t(prio.key)}</span>
				<span>
					{fill(t('kbCreatedBy'), {
						name: task.creatorNameSurname || t('kbSomeone'),
						when: new Date(task.creation).toLocaleDateString(locale),
					})}
				</span>
				{task.update ? <span>{fill(t('kbUpdated'), { when: when(task.update) })}</span> : null}
				{task.completion ? (
					<span>{fill(t('kbCompletedAt'), { when: new Date(task.completion).toLocaleDateString(locale) })}</span>
				) : null}
			</div>

			{permissions.manage && (
				<button type="button" className={`${ui.btn} ${ui.btnDanger}`} onClick={onDeleteTask}>
					<Trash2 size={14} />
					{t('kbDelete')}
				</button>
			)}
		</aside>
	);
}
