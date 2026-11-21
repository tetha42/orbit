'use client';

import React from 'react';
import {
	FORM_FIELD_COLLECT_AT,
	FORM_FIELD_DIRECTORY_VISIBILITY,
	FORM_FIELD_REQUIRED_AT,
	type FormField,
	type FormFieldCollectAt,
	type FormFieldDirectoryVisibility,
	type FormFieldRequiredAt,
} from '@/lib/formFields';
import { inputStyle, labelStyle } from './styles';

interface FieldEditorRulesTabProps {
	draft: FormField;
	setDraft: (field: FormField) => void;
	t: (key: string, fallback?: string) => string;
}

export function FieldEditorRulesTab({ draft, setDraft, t }: FieldEditorRulesTabProps) {
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
				<div>
					<label style={labelStyle}>{t('formCollectAt')}</label>
					<select
						style={inputStyle}
						value={draft.collectAt}
						onChange={(e) => {
							const collectAt = e.target.value as FormFieldCollectAt;
							setDraft({ ...draft, collectAt, scope: collectAt === 'admin' ? 'member' : collectAt });
						}}
					>
						{FORM_FIELD_COLLECT_AT.map((v) => (
							<option key={v} value={v}>
								{t(`formCollectAt_${v}`)}
							</option>
						))}
					</select>
				</div>

				<div>
					<label style={labelStyle}>{t('formRequiredAt')}</label>
					<select
						style={inputStyle}
						value={draft.requiredAt}
						onChange={(e) => {
							const requiredAt = e.target.value as FormFieldRequiredAt;
							setDraft({ ...draft, requiredAt, required: requiredAt !== 'none' });
						}}
					>
						{FORM_FIELD_REQUIRED_AT.map((v) => (
							<option key={v} value={v}>
								{t(`formRequiredAt_${v}`)}
							</option>
						))}
					</select>
				</div>

				<div>
					<label style={labelStyle}>{t('formDirectoryVisibility')}</label>
					<select
						style={inputStyle}
						value={draft.directoryVisibility}
						onChange={(e) =>
							setDraft({ ...draft, directoryVisibility: e.target.value as FormFieldDirectoryVisibility })
						}
					>
						{FORM_FIELD_DIRECTORY_VISIBILITY.map((v) => (
							<option key={v} value={v}>
								{t(`formDirectory_${v}`)}
							</option>
						))}
					</select>
				</div>

				<div style={{ gridColumn: 'span 2' }}>
					<p style={{ margin: 0, fontSize: '11px', opacity: 0.65, lineHeight: 1.4 }}>
						{draft.directoryVisibility === 'hidden'
							? t('formDirectoryHint_hidden')
							: draft.directoryVisibility === 'managers'
							? t('formDirectoryHint_managers')
							: t('formDirectoryHint_members')}
					</p>
				</div>
			</div>

			<div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.14)' }}>
				<label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
					<input
						type="checkbox"
						checked={draft.selfEditable}
						onChange={(e) => setDraft({ ...draft, selfEditable: e.target.checked })}
					/>
					<span>{t('formSelfEditable')}</span>
				</label>
				<label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
					<input
						type="checkbox"
						checked={draft.adminEditable}
						onChange={(e) => setDraft({ ...draft, adminEditable: e.target.checked })}
					/>
					<span>{t('formAdminEditable')}</span>
				</label>
				<label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
					<input
						type="checkbox"
						checked={draft.enabled}
						onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
					/>
					<span>{t('formEnabled')}</span>
				</label>
			</div>
		</div>
	);
}
