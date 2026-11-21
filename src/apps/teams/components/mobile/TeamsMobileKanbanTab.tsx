'use client';

import React from 'react';
import { Plus, ChevronLeft, ChevronRight, Clock, CheckSquare, MessageSquare } from 'lucide-react';
import { useI18n, getLocaleDefinition } from '@/core/i18n';
import { dueStatus } from '@/lib/kanban';
import { COLUMNS, priorityMeta, columnMeta, type TaskStatus, type TeamTask } from '../../types';
import s from '../TeamsMobile.module.css';

interface TeamsMobileKanbanTabProps {
	selectedKanbanCol: TaskStatus;
	setSelectedKanbanCol: (col: TaskStatus) => void;
	tasksByCol: Map<TaskStatus, TeamTask[]>;
	canManageTeam: boolean;
	canWorkOnTask: (task: TeamTask) => boolean;
	now: number;
	onNewTask: (col: TaskStatus) => void;
	onOpenTask: (taskId: string) => void;
	onStepTask: (task: TeamTask, delta: -1 | 1) => void;
}

export function TeamsMobileKanbanTab({
	selectedKanbanCol,
	setSelectedKanbanCol,
	tasksByCol,
	canManageTeam,
	canWorkOnTask,
	now,
	onNewTask,
	onOpenTask,
	onStepTask,
}: TeamsMobileKanbanTabProps) {
	const { t, language } = useI18n();
	const dateLocale = getLocaleDefinition(language).dateLocale;

	const dueText = (stateDue: ReturnType<typeof dueStatus>, ts: number) => {
		if (stateDue === 'overdue') return t('kbDueOverdue');
		if (stateDue === 'today') return t('kbDueToday');
		return new Date(ts).toLocaleDateString(dateLocale, {
			day: 'numeric',
			month: 'short',
		});
	};

	const activeColTasks = tasksByCol.get(selectedKanbanCol) || [];

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
			<div className={s.kanbanColSwitcher}>
				{COLUMNS.map((col) => {
					const count = tasksByCol.get(col.id)?.length || 0;
					const isColActive = selectedKanbanCol === col.id;
					return (
						<button
							key={col.id}
							type="button"
							className={`${s.colBtn} ${isColActive ? s.colBtnActive : ''}`}
							onClick={() => setSelectedKanbanCol(col.id)}
						>
							<span>{t(col.key)}</span>
							<span className={s.colCountBadge}>{count}</span>
						</button>
					);
				})}
			</div>

			<div className={s.colHeaderRow}>
				<span className={s.colTitleText}>
					{t(columnMeta(selectedKanbanCol).key)} ({activeColTasks.length})
				</span>
				{canManageTeam && (
					<button
						type="button"
						className={s.addTaskBtn}
						onClick={() => onNewTask(selectedKanbanCol)}
					>
						<Plus size={13} />
						<span>{t('kbNewTask')}</span>
					</button>
				)}
			</div>

			<div className={s.taskList}>
				{activeColTasks.length === 0 ? (
					<div className={s.emptyCard}>{t('kbNoTasksInCol')}</div>
				) : (
					activeColTasks.map((task) => {
						const prio = priorityMeta(task.priority);
						const due = task.dueDate ? dueStatus(task.dueDate, task.status, now) : null;
						const colIdx = COLUMNS.findIndex((c) => c.id === task.status);
						const canWork = canWorkOnTask(task);

						return (
							<div
								key={task.id}
								className={s.taskCard}
								onClick={() => onOpenTask(task.id)}
							>
								<div className={s.taskHeader}>
									<span className={s.taskTitle}>{task.title}</span>
									<span
										className={s.prioPill}
										style={{ background: `color-mix(in srgb, ${prio.color} 14%, transparent)`, color: prio.color }}
									>
										{t(prio.key)}
									</span>
								</div>

								{task.description && (
									<p style={{ margin: 0, fontSize: '12px', opacity: 0.7, lineHeight: 1.4 }}>
										{task.description}
									</p>
								)}

								<div className={s.taskMeta}>
									<span>{task.assigneeName || t('kbUnassigned')}</span>
									<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
										{task.dueDate && due && (
											<span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
												<Clock size={11} />
												<span>{dueText(due, task.dueDate)}</span>
											</span>
										)}
										{(task.itemCount ?? 0) > 0 && (
											<span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
												<CheckSquare size={11} />
												<span>{task.doneItemCount}/{task.itemCount}</span>
											</span>
										)}
										{(task.commentCount ?? 0) > 0 && (
											<span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
												<MessageSquare size={11} />
												<span>{task.commentCount}</span>
											</span>
										)}
									</div>
								</div>

								{canWork && (
									<div className={s.taskActionRow} onClick={(e) => e.stopPropagation()}>
										{colIdx > 0 && (
											<button
												type="button"
												className={s.stepBtn}
												onClick={() => onStepTask(task, -1)}
											>
												<ChevronLeft size={12} />
												<span>{t(COLUMNS[colIdx - 1].key)}</span>
											</button>
										)}
										{colIdx < COLUMNS.length - 1 && (
											<button
												type="button"
												className={s.stepBtn}
												onClick={() => onStepTask(task, 1)}
											>
												<span>{t(COLUMNS[colIdx + 1].key)}</span>
												<ChevronRight size={12} />
											</button>
										)}
									</div>
								)}
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}
