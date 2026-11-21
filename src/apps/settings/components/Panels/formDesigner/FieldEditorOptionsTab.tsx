'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { FormField, FormFieldOption } from '@/lib/formFields';
import { inputStyle, type PresetOption } from './styles';

interface FieldEditorOptionsTabProps {
	draft: FormField;
	presets: Record<string, PresetOption>;
	applyPreset: (key: string) => void;
	updateOption: (index: number, patch: Partial<FormFieldOption>) => void;
	addOption: () => void;
	removeOption: (index: number) => void;
	t: (key: string, fallback?: string) => string;
}

export function FieldEditorOptionsTab({
	draft,
	presets,
	applyPreset,
	updateOption,
	addOption,
	removeOption,
	t,
}: FieldEditorOptionsTabProps) {
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
				<div style={{ fontSize: '11.5px', fontWeight: 600, opacity: 0.8 }}>{t('formPresetApply')}:</div>
				<div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
					{Object.entries(presets).map(([key, preset]) => (
						<button
							key={key}
							type="button"
							onClick={() => applyPreset(key)}
							style={{
								fontSize: '10.5px',
								padding: '4px 8px',
								borderRadius: '6px',
								border: '1px solid var(--window-border)',
								background: 'rgba(255,255,255,0.06)',
								color: 'inherit',
								cursor: 'pointer',
							}}
						>
							{preset.label}
						</button>
					))}
				</div>
			</div>

			<div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
				{draft.options.map((option, index) => (
					<div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '6px', alignItems: 'center' }}>
						<input
							style={inputStyle}
							value={option.value}
							placeholder={t('formOptionValue')}
							onChange={(e) => updateOption(index, { value: e.target.value })}
						/>
						<input
							style={inputStyle}
							value={option.labelTr}
							placeholder={t('formOptionTr')}
							onChange={(e) => updateOption(index, { labelTr: e.target.value })}
						/>
						<input
							style={inputStyle}
							value={option.labelEn}
							placeholder={t('formOptionEn')}
							onChange={(e) => updateOption(index, { labelEn: e.target.value })}
						/>
						<button
							type="button"
							onClick={() => removeOption(index)}
							title={t('delete')}
							style={{
								width: '28px',
								height: '28px',
								borderRadius: '6px',
								border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
								background: 'color-mix(in srgb, var(--danger) 8%, transparent)',
								color: 'var(--danger)',
								display: 'grid',
								placeItems: 'center',
								cursor: 'pointer',
							}}
						>
							<Trash2 size={12} />
						</button>
					</div>
				))}
				{draft.options.length === 0 && (
					<div style={{ fontSize: '11.5px', opacity: 0.55, textAlign: 'center', padding: '16px' }}>
						{t('formNoOptions')}
					</div>
				)}
			</div>

			<button
				type="button"
				onClick={addOption}
				style={{
					display: 'inline-flex',
					alignItems: 'center',
					justifyContent: 'center',
					gap: '6px',
					padding: '7px 12px',
					borderRadius: '7px',
					border: '1px dashed var(--window-border)',
					background: 'rgba(255,255,255,0.02)',
					color: 'inherit',
					fontSize: '11.5px',
					fontWeight: 600,
					cursor: 'pointer',
				}}
			>
				<Plus size={12} />
				{t('formAddOption')}
			</button>
		</div>
	);
}
