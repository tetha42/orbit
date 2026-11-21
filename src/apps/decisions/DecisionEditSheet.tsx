'use client';

import React, { useState } from 'react';
import { Pencil } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { Sheet } from '@/core/ui/Sheet';
import ui from '@/core/ui/ui.module.css';
import { fill } from '@/lib/text';
import contract from './decisions.contract.json';
import { documentRef } from './documentMeta';
import type { Decision } from './types';

export interface DecisionEditPayload {
	title: string;
	agenda: string;
	content: string;
	isPublic: boolean;
}

interface DecisionEditSheetProps {
	decision: Decision;
	busy: boolean;
	onClose: () => void;
	onSave: (payload: DecisionEditPayload) => Promise<boolean>;
}

/** The edit dialog: subject, agenda, text and whether members may read the document. */
export function DecisionEditSheet({ decision, busy, onClose, onSave }: DecisionEditSheetProps) {
	const { t } = useI18n();
	const [title, setTitle] = useState(decision.title);
	const [agenda, setAgenda] = useState(decision.agenda ?? '');
	const [content, setContent] = useState(decision.content ?? '');
	const [isPublic, setIsPublic] = useState(Number(decision.isPublic) === 1);

	const disabled = busy || title.trim().length < 3 || content.trim().length < 10;

	return (
		<Sheet
			title={t('decisionsEditDocTitle')}
			label={fill(t('decisionsEditSheetTitle'), { no: documentRef(decision.referenceNumber) })}
			icon={<Pencil size={18} />}
			onClose={onClose}
			onSubmit={async (e) => {
				e.preventDefault();
				if (disabled) return;
				const ok = await onSave({
					title: title.trim(),
					agenda: agenda.trim(),
					content: content.trim(),
					isPublic,
				});
				if (ok) onClose();
			}}
			maxWidth={620}
		>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('decisionsSubjectLabel')}</span>
				<input
					type="text"
					className={ui.input}
					required
					minLength={3}
					maxLength={contract.limits.maxTitleLength}
					value={title}
					onChange={(e) => setTitle(e.target.value)}
				/>
			</label>

			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('decisionsAgendaLabel')}</span>
				<textarea
					className={ui.input}
					style={{ minHeight: 56, resize: 'vertical' }}
					maxLength={2000}
					value={agenda}
					onChange={(e) => setAgenda(e.target.value)}
				/>
			</label>

			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('decisionsTextLabel')}</span>
				<textarea
					className={ui.input}
					style={{ minHeight: 140, resize: 'vertical' }}
					required
					minLength={10}
					maxLength={contract.limits.maxContentLength}
					value={content}
					onChange={(e) => setContent(e.target.value)}
				/>
			</label>

			<label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12 }}>
				<input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} style={{ marginTop: 2 }} />
				<span>{t('decisionsPublicOption')}</span>
			</label>

			<div style={{ fontSize: 11, opacity: 0.6 }}>{t('decisionsEditNotice')}</div>

			<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
				<button type="button" className={ui.btn} onClick={onClose}>
					{t('cancel')}
				</button>
				<button type="submit" className={ui.primaryBtn} disabled={disabled}>
					{t('save')}
				</button>
			</div>
		</Sheet>
	);
}
