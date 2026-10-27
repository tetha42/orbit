'use client';

import React from 'react';
import type { teslimDurumu } from '@/lib/kanban';
import styles from './Kanban.module.css';
import { COLUMNS, type GorevDurumu, type TeamTask } from '../types';
import { KanbanColumn } from './KanbanColumn';

interface KanbanColumnGridProps {
	tasks: TeamTask[];
	byColumn: Map<GorevDurumu, TeamTask[]>;
	drop: { col: GorevDurumu; index: number } | null;
	dragId: string | null;
	canManage: boolean;
	canWork: (task: TeamTask) => boolean;
	now: number;
	dueText: (state: ReturnType<typeof teslimDurumu>, ts: number) => string;
	move: (task: TeamTask, targetCol: GorevDurumu, targetIndex?: number) => void;
	step: (task: TeamTask, delta: -1 | 1) => void;
	setOpenTaskId: (id: string | null) => void;
	setNewTaskCol: (col: GorevDurumu) => void;
	setDragId: (id: string | null) => void;
	setDrop: (drop: { col: GorevDurumu; index: number } | null) => void;
}

export function KanbanColumnGrid({
	tasks,
	byColumn,
	drop,
	dragId,
	canManage,
	canWork,
	now,
	dueText,
	move,
	step,
	setOpenTaskId,
	setNewTaskCol,
	setDragId,
	setDrop,
}: KanbanColumnGridProps) {
	return (
		<div className={styles.columns}>
			{COLUMNS.map((col, colIndex) => {
				const list = byColumn.get(col.id) ?? [];
				const over = drop?.col === col.id;
				return (
					<KanbanColumn
						key={col.id}
						col={col}
						colIndex={colIndex}
						list={list}
						over={over}
						dropIndex={drop?.col === col.id ? drop.index : null}
						dragId={dragId}
						canManage={canManage}
						canWork={canWork}
						now={now}
						dueText={dueText}
						onDragOver={(e) => {
							if (dragId && canManage) {
								e.preventDefault();
								if (!drop || drop.col !== col.id) setDrop({ col: col.id, index: list.length });
							}
						}}
						onDragLeave={(e) => {
							if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrop(null);
						}}
						onDrop={(e) => {
							e.preventDefault();
							const id = e.dataTransfer.getData('text/plain') || dragId;
							const task = tasks.find((t) => t.id === id);
							if (task) void move(task, col.id, drop?.index);
							setDragId(null);
							setDrop(null);
						}}
						onNewTask={() => setNewTaskCol(col.id)}
						onCardDragStart={(e, id) => {
							e.dataTransfer.setData('text/plain', id);
							e.dataTransfer.effectAllowed = 'move';
							setDragId(id);
						}}
						onCardDragEnd={() => {
							setDragId(null);
							setDrop(null);
						}}
						onCardDragOver={(e, i) => {
							if (dragId && canManage) {
								e.preventDefault();
								const rect = e.currentTarget.getBoundingClientRect();
								const insertAfter = e.clientY > rect.top + rect.height / 2;
								setDrop({ col: col.id, index: insertAfter ? i + 1 : i });
							}
						}}
						onOpenTask={setOpenTaskId}
						onStep={step}
					/>
				);
			})}
		</div>
	);
}
