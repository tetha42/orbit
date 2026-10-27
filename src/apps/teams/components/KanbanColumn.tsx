'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { teslimDurumu } from '@/lib/kanban';
import styles from './Kanban.module.css';
import ui from '@/core/ui/ui.module.css';
import type { COLUMNS, TeamTask } from '../types';
import { KanbanCard } from './KanbanCard';

interface KanbanColumnProps {
	col: (typeof COLUMNS)[number];
	colIndex: number;
	list: TeamTask[];
	over: boolean;
	dropIndex: number | null;
	dragId: string | null;
	canManage: boolean;
	canWork: (task: TeamTask) => boolean;
	now: number;
	dueText: (state: ReturnType<typeof teslimDurumu>, ts: number) => string;
	onDragOver: (e: React.DragEvent) => void;
	onDragLeave: (e: React.DragEvent) => void;
	onDrop: (e: React.DragEvent) => void;
	onNewTask: () => void;
	onCardDragStart: (e: React.DragEvent, id: string) => void;
	onCardDragEnd: () => void;
	onCardDragOver: (e: React.DragEvent, index: number) => void;
	onOpenTask: (id: string) => void;
	onStep: (task: TeamTask, delta: -1 | 1) => void;
}

export function KanbanColumn({
	col,
	colIndex,
	list,
	over,
	dropIndex,
	dragId,
	canManage,
	canWork,
	now,
	dueText,
	onDragOver,
	onDragLeave,
	onDrop,
	onNewTask,
	onCardDragStart,
	onCardDragEnd,
	onCardDragOver,
	onOpenTask,
	onStep,
}: KanbanColumnProps) {
	const { t } = useI18n();

	return (
		<section
			className={`${styles.column} ${over ? styles.columnOver : ''}`}
			style={{ '--col-accent': col.color } as React.CSSProperties}
			onDragOver={onDragOver}
			onDragLeave={onDragLeave}
			onDrop={onDrop}
			aria-label={t(col.key)}
		>
			<header className={styles.columnHeader}>
				<h4 className={styles.columnTitle}>{t(col.key)}</h4>
				<span className={ui.count}>{list.length}</span>
				{canManage && (
					<button
						type="button"
						className={ui.iconBtn}
						title={t('kbAddHere')}
						aria-label={t('kbAddHere')}
						onClick={onNewTask}
					>
						<Plus size={15} />
					</button>
				)}
			</header>
			<div className={styles.cardList}>
				{list.length === 0 && !over && <div className={ui.empty}>{t('kbEmptyColumn')}</div>}
				{list.map((g, i) => (
					<React.Fragment key={g.id}>
						{over && dropIndex === i && <div className={styles.dropLine} />}
						<KanbanCard
							task={g}
							colIndex={colIndex}
							now={now}
							dragId={dragId}
							canWork={canWork(g)}
							dueText={dueText}
							onDragStart={onCardDragStart}
							onDragEnd={onCardDragEnd}
							onDragOver={(e) => onCardDragOver(e, i)}
							onOpen={onOpenTask}
							onStep={onStep}
						/>
					</React.Fragment>
				))}
				{over && dropIndex !== null && dropIndex >= list.length && <div className={styles.dropLine} />}
			</div>
		</section>
	);
}
