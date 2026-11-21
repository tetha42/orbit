'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import ui from '@/core/ui/ui.module.css';
import {
	fieldLabel as getFieldLabel,
	fieldPlaceholder,
	optionLabel,
	type FormField,
} from '@/lib/formFields';
import { MEMBER_MAX_CUSTOM_FIELDS } from '../utils/memberContracts';

interface MemberCustomFieldsGroupProps {
	fields: FormField[];
	customValues: Record<string, string>;
	fieldErrors: Record<string, string>;
	onChange: (fieldKey: string, value: string) => void;
	isRequiredFn?: (field: FormField) => boolean;
	textareaClassName?: string;
}

export function MemberCustomFieldsGroup({
	fields,
	customValues,
	fieldErrors,
	onChange,
	isRequiredFn,
	textareaClassName = ui.textarea,
}: MemberCustomFieldsGroupProps) {
	const { t, language } = useI18n();
	const cappedFields = fields.slice(0, MEMBER_MAX_CUSTOM_FIELDS);

	if (cappedFields.length === 0) return null;

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
			<div style={{ fontSize: 11, fontWeight: 700, opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
				{t('membersAdditionalFields')}
			</div>
			{cappedFields.map((field) => {
				const value = customValues[field.fieldKey] ?? '';
				const errorText = fieldErrors[field.fieldKey];
				const required = isRequiredFn
					? isRequiredFn(field)
					: field.requiredAt === 'admin' || field.requiredAt === 'both';

				return (
					<label key={field.id} className={ui.field}>
						<span className={ui.fieldLabel}>
							{getFieldLabel(field, language)}
							{required ? ' *' : ''}
						</span>
						{field.type === 'select' ? (
							<select
								className={ui.select}
								style={{ maxWidth: 'none' }}
								value={value}
								onChange={(e) => onChange(field.fieldKey, e.target.value)}
								aria-invalid={Boolean(errorText)}
							>
								<option value="">{t('authSelectOption')}</option>
								{field.options.map((option) => (
									<option key={option.value} value={option.value}>
										{optionLabel(option, language)}
									</option>
								))}
							</select>
						) : field.type === 'textarea' ? (
							<textarea
								className={textareaClassName}
								rows={3}
								value={value}
								placeholder={fieldPlaceholder(field, language)}
								onChange={(e) => onChange(field.fieldKey, e.target.value)}
								aria-invalid={Boolean(errorText)}
							/>
						) : (
							<input
								className={ui.input}
								type={
									field.type === 'password'
										? 'password'
										: field.type === 'email'
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
								onChange={(e) => onChange(field.fieldKey, e.target.value)}
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
