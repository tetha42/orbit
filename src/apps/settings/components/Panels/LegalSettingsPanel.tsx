'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, Plus } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { legalCardStyle } from './legal/types';
import { useLegalSettings } from './legal/useLegalSettings';
import { LegalDocumentSidebar } from './legal/LegalDocumentSidebar';
import { LegalDocumentEditor } from './legal/LegalDocumentEditor';

export function LegalSettingsPanel() {
	const { t } = useI18n();
	const {
		documents,
		activeId,
		draft,
		setDraft,
		isLoading,
		isSaving,
		status,
		versions,
		activeDocument,
		selectDocument,
		startNew,
		save,
		title,
		body,
	} = useLegalSettings();

	if (isLoading) {
		return <div style={{ padding: 30, textAlign: 'center', opacity: 0.55 }}>{t('loading')}</div>;
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
			<div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
				<div>
					<h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{t('legalTitle')}</h2>
					<p style={{ margin: '3px 0 0 0', fontSize: '12.5px', opacity: 0.65 }}>{t('legalDesc')}</p>
				</div>
				<button
					type="button"
					onClick={startNew}
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: '6px',
						padding: '7px 12px',
						borderRadius: '8px',
						border: '1px solid var(--accent)',
						background: 'var(--accent)',
						color: '#fff',
						fontSize: '12px',
						fontWeight: 600,
						cursor: 'pointer',
					}}
				>
					<Plus size={13} />
					{t('legalAdd')}
				</button>
			</div>

			{status && (
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '8px',
						padding: '10px 12px',
						borderRadius: '8px',
						fontSize: '12px',
						background: status.type === 'ok' ? 'color-mix(in srgb, var(--success) 12%, transparent)' : 'color-mix(in srgb, var(--danger) 12%, transparent)',
						color: status.type === 'ok' ? 'var(--success)' : 'var(--danger)',
						border: `1px solid ${status.type === 'ok' ? 'color-mix(in srgb, var(--success) 30%, transparent)' : 'color-mix(in srgb, var(--danger) 30%, transparent)'}`,
					}}
				>
					{status.type === 'ok' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
					{status.text}
				</div>
			)}

			<div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: '16px', alignItems: 'start' }}>
				<LegalDocumentSidebar
					documents={documents}
					activeId={activeId}
					getTitle={title}
					onSelect={selectDocument}
				/>

				{draft ? (
					<LegalDocumentEditor
						draft={draft}
						activeDocument={activeDocument}
						versions={versions}
						isSaving={isSaving}
						getTitle={title}
						getBody={body}
						onChangeDraft={setDraft}
						onResetToActive={selectDocument}
						onSave={() => void save()}
					/>
				) : (
					<div style={{ ...legalCardStyle, fontSize: '12.5px', opacity: 0.6 }}>{t('legalSelectPrompt')}</div>
				)}
			</div>
		</div>
	);
}
