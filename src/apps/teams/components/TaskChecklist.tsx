'use client';

import React from 'react';
import { CheckSquare, Trash2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { MADDE_MAX } from '@/lib/kanban';
import type { TeamTaskItem } from '@/db/schema';
import styles from './Kanban.module.css';
import ui from '@/core/ui/ui.module.css';

interface TaskChecklistProps {
	maddeler: TeamTaskItem[];
	doneItems: number;
	canWork: boolean;
	itemDraft: string;
	setItemDraft: (val: string) => void;
	onToggleItem: (m: TeamTaskItem) => void;
	onDeleteItem: (id: string) => void;
	onAddItem: (e: React.FormEvent) => void;
}

export function TaskChecklist({
	maddeler,
	doneItems,
	canWork,
	itemDraft,
	setItemDraft,
	onToggleItem,
	onDeleteItem,
	onAddItem,
}: TaskChecklistProps) {
	const { t } = useI18n();

	return (
		<section>
			<h5 className={ui.sectionTitle}>
				<CheckSquare size={13} />
				{t('kbChecklist')}
				{maddeler.length > 0 && (
					<span style={{ marginLeft: 'auto', textTransform: 'none' }}>
						{doneItems}/{maddeler.length}
					</span>
				)}
			</h5>
			{maddeler.length > 0 && (
				<div className={styles.progressTrack} style={{ marginBottom: 6, height: 5 }}>
					<div
						className={styles.progressSeg}
						style={{ width: `${(doneItems / maddeler.length) * 100}%`, background: '#30d158' }}
					/>
				</div>
			)}
			{maddeler.map((m) => (
				<label key={m.id} className={styles.checkItem}>
					<input
						type="checkbox"
						checked={Number(m.tamamMi) === 1}
						disabled={!canWork}
						onChange={() => onToggleItem(m)}
					/>
					<span className={Number(m.tamamMi) === 1 ? styles.checkDone : ''}>{m.metin}</span>
					{canWork && (
						<button
							type="button"
							className={styles.rowDelete}
							aria-label={t('delete', 'Sil')}
							onClick={(e) => {
								e.preventDefault();
								onDeleteItem(m.id);
							}}
						>
							<Trash2 size={13} />
						</button>
					)}
				</label>
			))}
			{canWork && (
				<form className={styles.inlineAdd} onSubmit={onAddItem}>
					<input
						className={ui.input}
						value={itemDraft}
						maxLength={MADDE_MAX}
						onChange={(e) => setItemDraft(e.target.value)}
						placeholder={t('kbChecklistPh')}
					/>
					<button type="submit" className={ui.btn} disabled={!itemDraft.trim()}>
						{t('kbAdd')}
					</button>
				</form>
			)}
		</section>
	);
}
