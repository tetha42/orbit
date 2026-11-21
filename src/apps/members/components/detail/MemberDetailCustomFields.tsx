'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { fieldLabel, optionLabel, type FormField } from '@/lib/formFields';

interface MemberDetailCustomFieldsProps {
	fields: FormField[];
	customFields: Record<string, string>;
	canEdit: boolean;
}

export function MemberDetailCustomFields({
	fields,
	customFields,
	canEdit,
}: MemberDetailCustomFieldsProps) {
	const { t, language } = useI18n();

	const entries = Object.entries(customFields)
		.map(([key, rawValue]) => {
			if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
				return null;
			}
			const definition = fields.find((field) => field.fieldKey === key);
			let displayValue = String(rawValue);
			if (definition?.type === 'select' && definition.options?.length) {
				const matched = definition.options.find((option) => option.value === displayValue);
				if (matched) displayValue = optionLabel(matched, language);
			}
			return { key, definition, displayValue };
		})
		.filter(
			(entry): entry is { key: string; definition: FormField | undefined; displayValue: string } =>
				entry !== null,
		);

	if (entries.length === 0) return null;

	return (
		<div
			style={{
				padding: '10px 12px',
				borderRadius: '10px',
				background: 'rgba(255, 255, 255, 0.03)',
				border: '1px solid var(--window-border)',
				display: 'flex',
				flexDirection: 'column',
				gap: '8px',
			}}
		>
			<div style={{ fontSize: '11px', opacity: 0.6 }}>{t('membersAdditionalFields')}</div>
			{entries.map(({ key, definition, displayValue }) => {
				const isHidden = definition?.directoryVisibility === 'hidden';
				const isManagersOnly = definition?.directoryVisibility === 'managers';

				return (
					<div
						key={key}
						style={{
							display: 'flex',
							flexDirection: 'column',
							gap: '3px',
							paddingBottom: '6px',
							borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
						}}
					>
						<div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '11px', opacity: 0.7 }}>
							<span>{definition ? fieldLabel(definition, language) : key}</span>
							{canEdit && isHidden && (
								<span
									title={t('formVisibilityHiddenAdminTooltip')}
									style={{
										padding: '1px 6px',
										borderRadius: '999px',
										background: 'color-mix(in srgb, var(--danger) 14%, transparent)',
										color: 'var(--danger)',
										fontSize: '10px',
										fontWeight: 600,
									}}
								>
									{t('formVisibilityHiddenAdmin')}
								</span>
							)}
							{canEdit && isManagersOnly && (
								<span
									title={t('formVisibilityManagersTooltip')}
									style={{
										padding: '1px 6px',
										borderRadius: '999px',
										background: 'color-mix(in srgb, var(--warning) 14%, transparent)',
										color: 'var(--warning)',
										fontSize: '10px',
										fontWeight: 600,
									}}
								>
									{t('formDirectory_managers')}
								</span>
							)}
						</div>
						<div style={{ fontSize: '12.5px', fontWeight: 500, wordBreak: 'break-word' }}>
							{displayValue}
						</div>
					</div>
				);
			})}
		</div>
	);
}
