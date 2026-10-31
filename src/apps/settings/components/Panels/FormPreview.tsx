'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import type { FormField } from '@/lib/formFields';

interface FormPreviewProps {
	fields: FormField[];
}

const inputStyle: React.CSSProperties = {
	width: '100%',
	padding: '7px 9px',
	borderRadius: '7px',
	border: '1px solid var(--window-border)',
	background: 'rgba(0,0,0,0.22)',
	color: 'inherit',
	fontSize: '12px',
	boxSizing: 'border-box',
};

/**
 * Read-only rendering of the public registration form. It uses the same field
 * definitions (including the unsaved draft) so a designer sees the real result
 * instead of a second, drifting copy of the form.
 */
export function FormPreview({ fields }: FormPreviewProps) {
	const { t, language } = useI18n();
	const visible = fields.filter(
		(field) => field.enabled && (field.collectAt === 'registration' || field.collectAt === 'both')
	);

	if (visible.length === 0) {
		return (
			<div style={{ padding: '12px', fontSize: '11.5px', opacity: 0.55 }}>
				{t('formPreviewEmpty')}
			</div>
		);
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
			{visible.map((field) => {
				const label = language === 'tr' ? field.labelTr || field.labelEn : field.labelEn || field.labelTr;
				const placeholder =
					language === 'tr'
						? field.placeholderTr || field.placeholderEn
						: field.placeholderEn || field.placeholderTr;
				const required = field.requiredAt === 'registration' || field.requiredAt === 'both' || field.required;
				const id = `preview-${field.id || field.fieldKey || 'draft'}`;
				return (
					<label key={id} htmlFor={id} style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px' }}>
						<span style={{ fontWeight: 600, opacity: 0.8 }}>
							{label}
							{required && <span style={{ color: '#ff453a' }}> *</span>}
						</span>
						{field.type === 'textarea' ? (
							<textarea id={id} style={{ ...inputStyle, minHeight: '52px' }} placeholder={placeholder} disabled />
						) : field.type === 'select' ? (
							<select id={id} style={inputStyle} disabled>
								<option value="">{placeholder || t('formPreviewSelect')}</option>
								{field.options.map((option) => (
									<option key={option.value} value={option.value}>
										{language === 'tr' ? option.labelTr || option.labelEn : option.labelEn || option.labelTr}
									</option>
								))}
							</select>
						) : (
							<input
								id={id}
								type={
									field.type === 'email'
										? 'email'
										: field.type === 'number'
											? 'number'
											: field.type === 'date'
												? 'date'
												: field.type === 'tel'
													? 'tel'
													: field.type === 'password'
														? 'password'
														: 'text'
								}
								style={inputStyle}
								placeholder={placeholder}
								disabled
							/>
						)}

					</label>
				);
			})}
		</div>
	);
}
