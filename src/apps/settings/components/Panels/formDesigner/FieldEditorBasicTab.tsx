'use client';

import React from 'react';
import { FORM_FIELD_TYPES, normalizeFieldKey, type FormField } from '@/lib/formFields';
import { FIELD_TYPE_ICONS, inputStyle, labelStyle } from './styles';

interface FieldEditorBasicTabProps {
	draft: FormField;
	setDraft: (field: FormField) => void;
	activeLangTab: 'tr' | 'en';
	t: (key: string, fallback?: string) => string;
}

export function FieldEditorBasicTab({ draft, setDraft, activeLangTab, t }: FieldEditorBasicTabProps) {
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
			<div>
				<label style={labelStyle}>{t('formType')}</label>
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
					{FORM_FIELD_TYPES.map((type) => {
						const isSelected = draft.type === type;
						return (
							<button
								key={type}
								type="button"
								onClick={() => setDraft({ ...draft, type })}
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: '6px',
									padding: '8px 10px',
									borderRadius: '8px',
									border: isSelected ? '1px solid var(--accent)' : '1px solid var(--window-border)',
									background: isSelected ? 'var(--accent-subtle, color-mix(in srgb, var(--indigo) 18%, transparent))' : 'rgba(0,0,0,0.15)',
									color: 'inherit',
									fontSize: '11.5px',
									fontWeight: isSelected ? 600 : 500,
									cursor: 'pointer',
									textAlign: 'left',
								}}
							>
								<span style={{ color: isSelected ? 'var(--accent)' : 'inherit', opacity: 0.85 }}>
									{FIELD_TYPE_ICONS[type]}
								</span>
								<span>{t(`formType_${type}`)}</span>
							</button>
						);
					})}
				</div>
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
				<div>
					<label style={labelStyle}>{activeLangTab === 'tr' ? t('formLabelTr') : t('formLabelEn')}</label>
					<input
						style={inputStyle}
						value={activeLangTab === 'tr' ? draft.labelTr : draft.labelEn}
						maxLength={120}
						placeholder={activeLangTab === 'tr' ? t('formLabelExampleTr') : t('formLabelExampleEn')}
						onChange={(e) => {
							const val = e.target.value;
							if (activeLangTab === 'tr') {
								setDraft({ ...draft, labelTr: val, fieldKey: draft.fieldKey || normalizeFieldKey(val, 'field') });
							} else {
								setDraft({ ...draft, labelEn: val, fieldKey: draft.fieldKey || normalizeFieldKey(val, 'field') });
							}
						}}
					/>
				</div>

				<div>
					<label style={labelStyle}>{t('formKey')}</label>
					<input
						style={inputStyle}
						value={draft.fieldKey}
						maxLength={48}
						placeholder="e.g. shirt_size"
						onChange={(e) => setDraft({ ...draft, fieldKey: normalizeFieldKey(e.target.value, '') })}
					/>
				</div>

				<div>
					<label style={labelStyle}>{activeLangTab === 'tr' ? t('formPlaceholderTr') : t('formPlaceholderEn')}</label>
					<input
						style={inputStyle}
						value={activeLangTab === 'tr' ? draft.placeholderTr : draft.placeholderEn}
						maxLength={160}
						placeholder={activeLangTab === 'tr' ? t('formPlaceholderExampleTr') : t('formPlaceholderExampleEn')}
						onChange={(e) => {
							if (activeLangTab === 'tr') setDraft({ ...draft, placeholderTr: e.target.value });
							else setDraft({ ...draft, placeholderEn: e.target.value });
						}}
					/>
				</div>

				<div>
					<label style={labelStyle}>{t('formSection')}</label>
					<input
						style={inputStyle}
						value={draft.section}
						maxLength={40}
						placeholder="custom"
						onChange={(e) => setDraft({ ...draft, section: e.target.value })}
					/>
				</div>
			</div>
		</div>
	);
}
