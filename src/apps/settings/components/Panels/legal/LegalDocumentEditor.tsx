'use client';

import React from 'react';
import { Save, ShieldCheck } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import {
	LEGAL_DOCUMENT_SCOPES,
	LEGAL_DOCUMENT_TYPES,
	type LegalDocumentScope,
	type LegalDocumentType,
} from '@/lib/i18n/data/legalDefaults';
import {
	legalCardStyle,
	legalInputStyle,
	legalLabelStyle,
	type LegalDocument,
	type LegalDocumentVersion,
} from './types';
import { LegalVersionHistory } from './LegalVersionHistory';

interface LegalDocumentEditorProps {
	draft: LegalDocument;
	activeDocument: LegalDocument | null;
	versions: LegalDocumentVersion[];
	isSaving: boolean;
	getTitle: (doc: { titleTr: string; titleEn: string }) => string;
	getBody: (doc: { bodyTr: string; bodyEn: string }) => string;
	onChangeDraft: (next: LegalDocument) => void;
	onResetToActive: (doc: LegalDocument) => void;
	onSave: () => void;
}

export function LegalDocumentEditor({
	draft,
	activeDocument,
	versions,
	isSaving,
	getTitle,
	getBody,
	onChangeDraft,
	onResetToActive,
	onSave,
}: LegalDocumentEditorProps) {
	const { t } = useI18n();

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
			<div style={{ ...legalCardStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
				<div>
					<label style={legalLabelStyle}>{t('legalDocType')}</label>
					<select
						style={legalInputStyle}
						value={draft.docType}
						disabled={Boolean(draft.id)}
						onChange={(event) =>
							onChangeDraft({ ...draft, docType: event.target.value as LegalDocumentType })
						}
					>
						{LEGAL_DOCUMENT_TYPES.map((type) => (
							<option key={type} value={type}>
								{t(`legalType_${type}`)}
							</option>
						))}
					</select>
				</div>
				<div>
					<label style={legalLabelStyle}>{t('legalScope')}</label>
					<select
						style={legalInputStyle}
						value={draft.scope}
						onChange={(event) =>
							onChangeDraft({ ...draft, scope: event.target.value as LegalDocumentScope })
						}
					>
						{LEGAL_DOCUMENT_SCOPES.map((scope) => (
							<option key={scope} value={scope}>
								{t(`legalScope_${scope}`)}
							</option>
						))}
					</select>
				</div>
				<div>
					<label style={legalLabelStyle}>{t('legalTitleTr')}</label>
					<input
						style={legalInputStyle}
						value={draft.titleTr}
						maxLength={160}
						onChange={(event) => onChangeDraft({ ...draft, titleTr: event.target.value })}
					/>
				</div>
				<div>
					<label style={legalLabelStyle}>{t('legalTitleEn')}</label>
					<input
						style={legalInputStyle}
						value={draft.titleEn}
						maxLength={160}
						onChange={(event) => onChangeDraft({ ...draft, titleEn: event.target.value })}
					/>
				</div>
				<label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px' }}>
					<input
						type="checkbox"
						checked={draft.required}
						onChange={(event) => onChangeDraft({ ...draft, required: event.target.checked })}
					/>
					{t('legalRequired')}
				</label>
				<label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px' }}>
					<input
						type="checkbox"
						checked={draft.enabled}
						onChange={(event) => onChangeDraft({ ...draft, enabled: event.target.checked })}
					/>
					{t('legalEnabled')}
				</label>
			</div>

			<div style={{ ...legalCardStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
				<div>
					<label style={legalLabelStyle}>{t('legalBodyTr')}</label>
					<textarea
						style={{
							...legalInputStyle,
							minHeight: '260px',
							fontFamily: 'ui-monospace, monospace',
							lineHeight: 1.55,
							resize: 'vertical',
						}}
						value={draft.bodyTr}
						onChange={(event) => onChangeDraft({ ...draft, bodyTr: event.target.value })}
					/>
				</div>
				<div>
					<label style={legalLabelStyle}>{t('legalBodyEn')}</label>
					<textarea
						style={{
							...legalInputStyle,
							minHeight: '260px',
							fontFamily: 'ui-monospace, monospace',
							lineHeight: 1.55,
							resize: 'vertical',
						}}
						value={draft.bodyEn}
						onChange={(event) => onChangeDraft({ ...draft, bodyEn: event.target.value })}
					/>
				</div>
			</div>
			<div style={{ fontSize: '11px', opacity: 0.55, display: 'flex', alignItems: 'center', gap: '5px' }}>
				<ShieldCheck size={12} />
				{t('legalMarkdownHint')}
			</div>

			<LegalVersionHistory
				versions={versions}
				currentVersion={draft.version}
				getTitle={getTitle}
				getBody={getBody}
			/>

			<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
				<button
					type="button"
					onClick={() => activeDocument && onResetToActive(activeDocument)}
					disabled={isSaving}
					style={{
						padding: '8px 14px',
						borderRadius: '8px',
						border: '1px solid var(--window-border)',
						background: 'transparent',
						color: 'inherit',
						fontSize: '12px',
						fontWeight: 600,
						cursor: 'pointer',
					}}
				>
					{t('cancel')}
				</button>
				<button
					type="button"
					onClick={onSave}
					disabled={isSaving}
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: '6px',
						padding: '8px 16px',
						borderRadius: '8px',
						border: 'none',
						background: 'var(--accent)',
						color: '#fff',
						fontSize: '12px',
						fontWeight: 600,
						cursor: isSaving ? 'wait' : 'pointer',
						opacity: isSaving ? 0.7 : 1,
					}}
				>
					<Save size={13} />
					{isSaving ? t('saving') : t('legalSave')}
				</button>
			</div>
		</div>
	);
}
