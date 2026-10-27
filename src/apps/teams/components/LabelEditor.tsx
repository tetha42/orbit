'use client';

import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import styles from './Kanban.module.css';
import { labelHue } from '../types';

interface Props {
	labels: string[];
	allLabels: string[];
	readOnly?: boolean;
	onChange: (next: string[]) => void;
}

export function LabelEditor({ labels, allLabels, readOnly, onChange }: Props) {
	const { t } = useI18n();
	const [adding, setAdding] = useState(false);
	const [draft, setDraft] = useState('');

	const add = (raw: string) => {
		const val = raw
			.trim()
			.toLowerCase()
			.replace(/^[#\s]+/, '');
		if (val && !labels.includes(val)) onChange([...labels, val]);
		setDraft('');
		setAdding(false);
	};

	const remove = (val: string) => onChange(labels.filter((l) => l !== val));
	const unused = allLabels.filter((l) => !labels.includes(l));

	return (
		<div className={styles.labelEditor}>
			{labels.map((l) => (
				<span key={l} className={styles.label} style={{ '--label-hue': labelHue(l) } as React.CSSProperties}>
					#{l}
					{!readOnly && (
						<button
							type="button"
							className={styles.labelRemove}
							onClick={() => remove(l)}
							aria-label={fill(t('tmRemoveLabelAria'), { label: l })}
						>
							<X size={10} />
						</button>
					)}
				</span>
			))}

			{!readOnly && !adding && (
				<button type="button" className={styles.labelAddBtn} onClick={() => setAdding(true)}>
					<Plus size={11} /> {t('kbAddLabel')}
				</button>
			)}

			{!readOnly && adding && (
				<span className={styles.labelInputWrap}>
					<input
						type="text"
						autoFocus
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								add(draft);
							} else if (e.key === 'Escape') {
								setAdding(false);
							}
						}}
						placeholder={t('kbLabelName')}
					/>
					{unused.length > 0 && (
						<select onChange={(e) => e.target.value && add(e.target.value)} defaultValue="" aria-label="Mevcut etiketler">
							<option value="" disabled>
								{t('kbPickLabel')}
							</option>
							{unused.map((l) => (
								<option key={l} value={l}>
									#{l}
								</option>
							))}
						</select>
					)}
					<button type="button" onClick={() => add(draft)}>
						{t('add')}
					</button>
					<button type="button" onClick={() => setAdding(false)}>
						<X size={12} />
					</button>
				</span>
			)}
		</div>
	);
}
