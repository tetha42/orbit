'use client';

import React from 'react';
import { Info, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { RegistrationCoreField, RegistrationCoreFieldKey } from '@/lib/i18n/data/registrationConfig';
import type { FormFieldOption } from '@/lib/formFields';
import { coreInputStyle, coreLabelStyle } from './styles';

interface CoreFieldOptionsListProps {
	fieldKey: RegistrationCoreFieldKey;
	field: RegistrationCoreField;
	onAddOption: (key: RegistrationCoreFieldKey) => void;
	onUpdateOption: (
		key: RegistrationCoreFieldKey,
		index: number,
		patch: Partial<FormFieldOption>
	) => void;
	onRemoveOption: (key: RegistrationCoreFieldKey, index: number) => void;
}

export function CoreFieldOptionsList({
	fieldKey,
	field,
	onAddOption,
	onUpdateOption,
	onRemoveOption,
}: CoreFieldOptionsListProps) {
	const { t } = useI18n();

	return (
		<div style={{ marginTop: '10px' }}>
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					marginBottom: '6px',
				}}
			>
				<label style={{ ...coreLabelStyle, marginBottom: 0 }}>{t('regCoreOptions')}</label>
				<button
					type="button"
					onClick={() => onAddOption(fieldKey)}
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: '5px',
						padding: '5px 9px',
						borderRadius: '7px',
						border: '1px solid var(--window-border)',
						background: 'var(--fill-soft)',
						color: 'inherit',
						fontSize: '11px',
						fontWeight: 600,
						cursor: 'pointer',
					}}
				>
					<Plus size={11} />
					{t('regCoreAddOption')}
				</button>
			</div>
			<div
				style={{
					display: 'flex',
					alignItems: 'flex-start',
					gap: '5px',
					fontSize: '10.5px',
					lineHeight: 1.45,
					opacity: 0.55,
					marginBottom: '7px',
				}}
			>
				<Info size={12} style={{ marginTop: '1px', flexShrink: 0 }} />
				<span>
					{t('regCoreOptionsHint')}
					{fieldKey === 'level' ? ` ${t('regCoreLevelValueHint')}` : ''}
				</span>
			</div>
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: '0.8fr 1fr 1fr auto',
					gap: '6px',
					padding: '0 2px',
					marginBottom: '4px',
					fontSize: '9.5px',
					fontWeight: 700,
					letterSpacing: '0.045em',
					textTransform: 'uppercase',
					opacity: 0.48,
				}}
				aria-hidden="true"
			>
				<span title={t('regCoreValue')}>{t('regCoreValue')}</span>
				<span title={t('regCoreOptionTr')}>{t('regCoreOptionTr')}</span>
				<span title={t('regCoreOptionEn')}>{t('regCoreOptionEn')}</span>
				<span />
			</div>
			<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
				{field.options.map((option, index) => (
					<div
						key={index}
						style={{
							display: 'grid',
							gridTemplateColumns: '0.8fr 1fr 1fr auto',
							gap: '6px',
							alignItems: 'center',
						}}
					>
						<input
							style={coreInputStyle}
							value={option.value}
							aria-label={`${t('regCoreValue')} ${index + 1}`}
							inputMode={fieldKey === 'level' ? 'numeric' : undefined}
							onChange={(event) =>
								onUpdateOption(fieldKey, index, { value: event.target.value })
							}
							placeholder={t('regCoreValue')}
						/>
						<input
							style={coreInputStyle}
							value={option.labelTr}
							aria-label={`${t('regCoreOptionTr')} ${index + 1}`}
							onChange={(event) =>
								onUpdateOption(fieldKey, index, { labelTr: event.target.value })
							}
							placeholder={t('regCoreOptionTr')}
						/>
						<input
							style={coreInputStyle}
							value={option.labelEn}
							aria-label={`${t('regCoreOptionEn')} ${index + 1}`}
							onChange={(event) =>
								onUpdateOption(fieldKey, index, { labelEn: event.target.value })
							}
							placeholder={t('regCoreOptionEn')}
						/>
						<button
							type="button"
							onClick={() => onRemoveOption(fieldKey, index)}
							disabled={field.options.length <= 1}
							title={t('delete')}
							style={{
								width: '27px',
								height: '27px',
								borderRadius: '6px',
								border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
								background: 'color-mix(in srgb, var(--danger) 8%, transparent)',
								color: 'var(--danger)',
								display: 'grid',
								placeItems: 'center',
								cursor: field.options.length <= 1 ? 'not-allowed' : 'pointer',
								opacity: field.options.length <= 1 ? 0.4 : 1,
							}}
						>
							<Trash2 size={12} />
						</button>
					</div>
				))}
			</div>
			{!field.visible && (
				<div style={{ fontSize: '10.5px', opacity: 0.55, marginTop: '6px' }}>
					{t('regCoreHiddenHint')}
				</div>
			)}
		</div>
	);
}
