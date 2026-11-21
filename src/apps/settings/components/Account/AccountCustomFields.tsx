'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import {
	fieldLabel,
	fieldPlaceholder,
	fieldRequiredForSelf,
	optionLabel,
	type FormField,
} from '@/lib/formFields';
import ui from '@/core/ui/ui.module.css';
import styles from './Account.module.css';

interface AccountCustomFieldsProps {
	fields: FormField[];
	customValues: Record<string, string>;
	customErrors: Record<string, string>;
	onChange: (fieldKey: string, value: string) => void;
}

export function AccountCustomFields({
	fields,
	customValues,
	customErrors,
	onChange,
}: AccountCustomFieldsProps) {
	const { t, language } = useI18n();
	if (fields.length === 0) return null;

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
			<h4 className={styles.cardTitle}>{t('membersAdditionalFields')}</h4>
			{fields.map((field) => {
				const value = customValues[field.fieldKey] ?? '';
				const errorText = customErrors[field.fieldKey];
				const required = fieldRequiredForSelf(field);
				return (
					<label key={field.id} className={ui.field}>
						<span className={ui.fieldLabel}>
							{fieldLabel(field, language)}
							{required ? ' *' : ''}
						</span>
						{field.type === 'textarea' ? (
							<textarea
								className={ui.textarea}
								rows={3}
								value={value}
								placeholder={fieldPlaceholder(field, language)}
								onChange={(event) => onChange(field.fieldKey, event.target.value)}
								aria-invalid={Boolean(errorText)}
							/>
						) : field.type === 'select' ? (
							<select
								className={ui.select}
								style={{ maxWidth: 'none' }}
								value={value}
								onChange={(event) => onChange(field.fieldKey, event.target.value)}
								aria-invalid={Boolean(errorText)}
							>
								<option value="">{t('authSelectOption')}</option>
								{field.options.map((option) => (
									<option key={option.value} value={option.value}>
										{optionLabel(option, language)}
									</option>
								))}
							</select>
						) : (
							<input
								className={ui.input}
								type={
									field.type === 'email'
										? 'email'
										: field.type === 'tel'
											? 'tel'
											: field.type === 'number'
												? 'number'
												: field.type === 'date'
													? 'date'
													: 'text'
								}
								value={value}
								placeholder={fieldPlaceholder(field, language)}
								onChange={(event) => onChange(field.fieldKey, event.target.value)}
								aria-invalid={Boolean(errorText)}
							/>
						)}
						{errorText && <span style={{ fontSize: 11, color: 'var(--danger)' }}>{errorText}</span>}
					</label>
				);
			})}
		</div>
	);
}
