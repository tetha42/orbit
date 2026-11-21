'use client';

import React, { useState } from 'react';
import { FilePlus2, X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import ui from '@/core/ui/ui.module.css';
import contract from './decisions.contract.json';
import { DOCUMENT_TEMPLATES } from './documentMeta';

export interface NewDecisionPayload {
	title: string;
	agenda: string;
	content: string;
	documentType: string;
}

interface DecisionCreateFormProps {
	busy: boolean;
	onCancel: () => void;
	onCreate: (payload: NewDecisionPayload) => Promise<boolean>;
}

/** The inline New Document form: a template, a subject, the agenda and the text to seal. */
export function DecisionCreateForm({ busy, onCancel, onCreate }: DecisionCreateFormProps) {
	const { t } = useI18n();
	const [templateId, setTemplateId] = useState(DOCUMENT_TEMPLATES[0].id);
	const [title, setTitle] = useState('');
	const [agenda, setAgenda] = useState('');
	const [content, setContent] = useState('');

	const template = DOCUMENT_TEMPLATES.find((x) => x.id === templateId) ?? DOCUMENT_TEMPLATES[0];
	const disabled = busy || title.trim().length < 3 || content.trim().length < 10;

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (disabled) return;
		await onCreate({
			title: title.trim(),
			agenda: agenda.trim(),
			content: content.trim(),
			documentType: template.documentType,
		});
	};

	return (
		<form onSubmit={submit} data-decision-create style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0, overflowY: 'auto' }}>
			<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
				<FilePlus2 size={16} />
				<div style={{ flex: 1 }}>
					<div style={{ fontSize: 13.5, fontWeight: 700 }}>{t('decisionsFormTitle')}</div>
					<div style={{ fontSize: 11, opacity: 0.6 }}>{t('decisionsFormSubtitle')}</div>
				</div>
				<button type="button" className={ui.iconBtn} onClick={onCancel} aria-label={t('cancel')}>
					<X size={15} />
				</button>
			</div>

			<div>
				<div style={{ fontSize: 11, fontWeight: 700, opacity: 0.7, marginBottom: 5 }}>{t('decisionsTemplateSelector')}</div>
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 6 }}>
					{DOCUMENT_TEMPLATES.map((item) => (
						<button
							key={item.id}
							type="button"
							aria-pressed={item.id === template.id}
							onClick={() => setTemplateId(item.id)}
							style={{
								textAlign: 'left',
								padding: '7px 9px',
								borderRadius: 7,
								fontSize: 11.5,
								fontWeight: 650,
								cursor: 'pointer',
								color: 'inherit',
								border: `1px solid ${item.id === template.id ? 'color-mix(in srgb, var(--accent) 65%, transparent)' : 'var(--window-border)'}`,
								background: item.id === template.id ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
							}}
						>
							{t(item.labelKey)}
						</button>
					))}
				</div>
			</div>

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
					placeholder={template.agendaHint}
					value={agenda}
					onChange={(e) => setAgenda(e.target.value)}
				/>
			</label>

			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('decisionsTextLabel')}</span>
				<textarea
					className={ui.input}
					style={{ minHeight: 110, resize: 'vertical' }}
					required
					minLength={10}
					maxLength={contract.limits.maxContentLength}
					placeholder={template.bodyHint}
					value={content}
					onChange={(e) => setContent(e.target.value)}
				/>
			</label>

			<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
				<button type="button" className={ui.btn} onClick={onCancel}>
					{t('cancel')}
				</button>
				<button type="submit" className={ui.primaryBtn} disabled={disabled}>
					{t('decisionsSealAndSave')}
				</button>
			</div>
		</form>
	);
}
