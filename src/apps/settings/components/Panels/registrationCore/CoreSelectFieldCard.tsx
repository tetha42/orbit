'use client';

import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type {
	RegistrationCoreConfig,
	RegistrationCoreField,
	RegistrationCoreFieldKey,
} from '@/lib/i18n/data/registrationConfig';
import type { FormFieldOption } from '@/lib/formFields';
import { coreCardStyle, coreInputStyle, coreLabelStyle } from './styles';
import { CoreFieldOptionsList } from './CoreFieldOptionsList';

interface CoreSelectFieldCardProps {
	fieldKey: RegistrationCoreFieldKey;
	field: RegistrationCoreField;
	onUpdateField: <K extends RegistrationCoreFieldKey>(
		key: K,
		patch: Partial<RegistrationCoreConfig[K]>
	) => void;
	onAddOption: (key: RegistrationCoreFieldKey) => void;
	onUpdateOption: (
		key: RegistrationCoreFieldKey,
		index: number,
		patch: Partial<FormFieldOption>
	) => void;
	onRemoveOption: (key: RegistrationCoreFieldKey, index: number) => void;
}

export function CoreSelectFieldCard({
	fieldKey,
	field,
	onUpdateField,
	onAddOption,
	onUpdateOption,
	onRemoveOption,
}: CoreSelectFieldCardProps) {
	const { t } = useI18n();
	const title = fieldKey === 'track' ? t('regCoreTrack') : t('regCoreLevel');

	return (
		<div style={coreCardStyle}>
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					gap: '10px',
					marginBottom: '10px',
				}}
			>
				<div>
					<div style={{ fontSize: '12.5px', fontWeight: 700 }}>{title}</div>
					<div style={{ fontSize: '11px', opacity: 0.55, marginTop: '2px' }}>
						{fieldKey === 'track' ? t('regCoreTrackHint') : t('regCoreLevelHint')}
					</div>
				</div>
				<button
					type="button"
					onClick={() => onUpdateField(fieldKey, { visible: !field.visible })}
					aria-pressed={field.visible}
					title={field.visible ? t('regCoreHide') : t('regCoreShow')}
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: '5px',
						padding: '5px 9px',
						borderRadius: '7px',
						border: `1px solid ${field.visible ? 'color-mix(in srgb, var(--success) 35%, transparent)' : 'var(--window-border)'}`,
						background: field.visible ? 'color-mix(in srgb, var(--success) 10%, transparent)' : 'transparent',
						color: field.visible ? 'var(--success)' : 'inherit',
						fontSize: '11px',
						fontWeight: 600,
						cursor: 'pointer',
						whiteSpace: 'nowrap',
					}}
				>
					{field.visible ? <Eye size={12} /> : <EyeOff size={12} />}
					{field.visible ? t('regCoreVisible') : t('regCoreHidden')}
				</button>
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
				<div>
					<label style={coreLabelStyle}>{t('formLabelTr')}</label>
					<input
						style={coreInputStyle}
						value={field.labelTr}
						onChange={(event) => onUpdateField(fieldKey, { labelTr: event.target.value })}
					/>
				</div>
				<div>
					<label style={coreLabelStyle}>{t('formLabelEn')}</label>
					<input
						style={coreInputStyle}
						value={field.labelEn}
						onChange={(event) => onUpdateField(fieldKey, { labelEn: event.target.value })}
					/>
				</div>
				<div>
					<label style={coreLabelStyle}>{t('formPlaceholderTr')}</label>
					<input
						style={coreInputStyle}
						value={field.placeholderTr}
						onChange={(event) =>
							onUpdateField(fieldKey, { placeholderTr: event.target.value })
						}
					/>
				</div>
				<div>
					<label style={coreLabelStyle}>{t('formPlaceholderEn')}</label>
					<input
						style={coreInputStyle}
						value={field.placeholderEn}
						onChange={(event) =>
							onUpdateField(fieldKey, { placeholderEn: event.target.value })
						}
					/>
				</div>
			</div>

			<CoreFieldOptionsList
				fieldKey={fieldKey}
				field={field}
				onAddOption={onAddOption}
				onUpdateOption={onUpdateOption}
				onRemoveOption={onRemoveOption}
			/>
		</div>
	);
}
