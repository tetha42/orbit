'use client';

import React, { useMemo } from 'react';
import { CheckSquare, ChevronLeft, ChevronRight, Clock, MessageSquare, Copy, ArrowRight, ArrowLeft, ExternalLink } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useContextMenu } from '@/core/shell';
import { copyToClipboard } from '@/lib/clipboard';
import type { MenuItem } from '@/types/workspace';
import { teslimDurumu } from '@/lib/kanban';
import styles from './Kanban.module.css';
import ui from '@/core/ui/ui.module.css';
import { COLUMNS, labelHue, priorityMeta, type TeamTask } from '../types';
import { initials } from '@/core/text/initials';

interface KanbanCardProps {
	task: TeamTask;
	colIndex: number;
	now: number;
	dragId: string | null;
	canWork: boolean;
	dueText: (due: ReturnType<typeof teslimDurumu>, time: number) => string;
	onDragStart: (e: React.DragEvent, id: string) => void;
	onDragEnd: () => void;
	onDragOver: (e: React.DragEvent) => void;
	onOpen: (id: string) => void;
	onStep: (task: TeamTask, delta: -1 | 1) => void;
}

export function KanbanCard({
	task,
	colIndex,
	now,
	dragId,
	canWork,
	dueText,
	onDragStart,
	onDragEnd,
	onDragOver,
	onOpen,
	onStep,
}: KanbanCardProps) {
	const { t } = useI18n();
	const prio = priorityMeta(task.oncelik);
	const due = teslimDurumu(task.teslimTarihi, task.status, now);

	const menuItems = useMemo<MenuItem[]>(() => {
		const items: MenuItem[] = [
			{
				id: `open-${task.id}`,
				label: t('ctxTeamsOpen'),
				icon: <ExternalLink size={13} />,
				action: () => onOpen(task.id),
			},
			{
				id: `copy-title-${task.id}`,
				label: t('ctxTeamsCopyTitle'),
				icon: <Copy size={13} />,
				action: () => {
					void copyToClipboard(task.baslik);
				},
			},
		];

		if (canWork) {
			const moveItems: MenuItem[] = [];
			if (colIndex > 0) {
				moveItems.push({
					id: `move-left-${task.id}`,
					label: t('ctxTeamsMovePrev'),
					icon: <ArrowLeft size={13} />,
					action: () => onStep(task, -1),
				});
			}
			if (colIndex < COLUMNS.length - 1) {
				moveItems.push({
					id: `move-right-${task.id}`,
					label: t('ctxTeamsMoveNext'),
					icon: <ArrowRight size={13} />,
					action: () => onStep(task, 1),
				});
			}

			if (moveItems.length > 0) {
				items.push({ id: `sep-move-${task.id}`, label: '', separator: true }, ...moveItems);
			}
		}

		return items;
	}, [task, t, onOpen, canWork, colIndex, onStep]);

	const contextMenuProps = useContextMenu({ items: menuItems });

	return (
		<article
			data-focus-id={`task:${task.id}`}
			data-task-id={task.id}
			className={`${styles.card} ${dragId === task.id ? styles.cardDragging : ''} ${task.status === 'tamamlandi' ? styles.cardDone : ''}`}
			style={{ '--prio': prio.color, cursor: canWork ? 'grab' : 'pointer' } as React.CSSProperties}
			draggable={canWork}
			tabIndex={0}
			role="button"
			aria-label={task.baslik}
			{...contextMenuProps}
			onDragStart={(e) => onDragStart(e, task.id)}
			onDragEnd={onDragEnd}
			onDragOver={onDragOver}
			onClick={() => onOpen(task.id)}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					onOpen(task.id);
				} else if (e.altKey && canWork && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
					e.preventDefault();
					onStep(task, e.key === 'ArrowLeft' ? -1 : 1);
				}
			}}
		>
			{(task.etiketler?.length ?? 0) > 0 && (
				<div className={styles.labels}>
					{task.etiketler.map((l) => (
						<span key={l} className={styles.label} style={{ '--label-hue': labelHue(l) } as React.CSSProperties}>
							#{l}
						</span>
					))}
				</div>
			)}
			<p className={styles.cardTitle}>{task.baslik}</p>
			{task.aciklama && <p className={styles.cardDesc}>{task.aciklama}</p>}
			<div className={styles.cardFooter}>
				<span className={`${styles.badge} ${styles.prioBadge}`}>{t(prio.key)}</span>
				{due && task.teslimTarihi && (
					<span className={`${styles.badge} ${styles[`due_${due}`]}`} title={new Date(task.teslimTarihi).toLocaleString()}>
						<Clock size={11} />
						{dueText(due, task.teslimTarihi)}
					</span>
				)}
				{(task.maddeSayisi ?? 0) > 0 && (
					<span className={styles.metaItem} title={t('kbChecklist')}>
						<CheckSquare size={12} />
						{task.tamamMaddeSayisi}/{task.maddeSayisi}
					</span>
				)}
				{(task.yorumSayisi ?? 0) > 0 && (
					<span className={styles.metaItem} title={t('kbComments')}>
						<MessageSquare size={12} />
						{task.yorumSayisi}
					</span>
				)}
				{canWork && (
					<span className={styles.moveBtns} onClick={(e) => e.stopPropagation()}>
						{colIndex > 0 && (
							<button
								type="button"
								className={styles.moveBtn}
								title={t('kbMoveLeft')}
								aria-label={t('kbMoveLeft')}
								onClick={() => onStep(task, -1)}
							>
								<ChevronLeft size={13} />
							</button>
						)}
						{colIndex < COLUMNS.length - 1 && (
							<button
								type="button"
								className={styles.moveBtn}
								title={t('kbMoveRight')}
								aria-label={t('kbMoveRight')}
								onClick={() => onStep(task, 1)}
							>
								<ChevronRight size={13} />
							</button>
						)}
					</span>
				)}
				<span
					className={`${ui.avatar} ${task.atananUyeId ? '' : styles.avatarEmpty}`}
					title={task.atananAdSoyad || t('kbUnassigned')}
				>
					{task.atananUyeId ? initials(task.atananAdSoyad) : '?'}
				</span>
			</div>
		</article>
	);
}
