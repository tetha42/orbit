'use client';

import React from 'react';
import { Plus, Sliders } from 'lucide-react';
import type { FormField, FormFieldOption } from '@/lib/formFields';
import { cardStyle, type PresetOption } from './styles';
import { FieldEditorBasicTab } from './FieldEditorBasicTab';
import { FieldEditorRulesTab } from './FieldEditorRulesTab';
import { FieldEditorOptionsTab } from './FieldEditorOptionsTab';
import { FieldEditorActions } from './FieldEditorActions';

interface FieldEditorPaneProps {
	draft: FormField | null;
	setDraft: (field: FormField) => void;
	activeTab: 'basic' | 'rules' | 'options';
	setActiveTab: (tab: 'basic' | 'rules' | 'options') => void;
	activeLangTab: 'tr' | 'en';
	setActiveLangTab: (lang: 'tr' | 'en') => void;
	presets: Record<string, PresetOption>;
	applyPreset: (key: string) => void;
	updateOption: (index: number, patch: Partial<FormFieldOption>) => void;
	addOption: () => void;
	removeOption: (index: number) => void;
	removeField: () => Promise<void>;
	duplicateField: (field: FormField) => void;
	save: () => Promise<void>;
	startNew: () => void;
	canSave: boolean;
	isSaving: boolean;
	t: (key: string, fallback?: string) => string;
}

export function FieldEditorPane({
	draft,
	setDraft,
	activeTab,
	setActiveTab,
	activeLangTab,
	setActiveLangTab,
	presets,
	applyPreset,
	updateOption,
	addOption,
	removeOption,
	removeField,
	duplicateField,
	save,
	startNew,
	canSave,
	isSaving,
	t,
}: FieldEditorPaneProps) {
	if (!draft) {
		return (
			<div
				style={{
					...cardStyle,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					padding: '60px 20px',
					textAlign: 'center',
					gap: '12px',
				}}
			>
				<Sliders size={32} style={{ opacity: 0.35 }} />
				<div style={{ fontSize: '13px', opacity: 0.65 }}>{t('formSelectPrompt')}</div>
				<button
					type="button"
					onClick={startNew}
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: '6px',
						padding: '7px 14px',
						borderRadius: '8px',
						border: '1px solid var(--accent)',
						background: 'var(--accent)',
						color: '#fff',
						fontSize: '12px',
						fontWeight: 600,
						cursor: 'pointer',
					}}
				>
					<Plus size={13} />
					{t('formAdd')}
				</button>
			</div>
		);
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
			<div style={cardStyle}>
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						borderBottom: '1px solid var(--window-border)',
						paddingBottom: '10px',
						marginBottom: '14px',
					}}
				>
					<div style={{ display: 'flex', gap: '6px' }}>
						{(['basic', 'rules'] as const).map((tab) => (
							<button
								key={tab}
								type="button"
								onClick={() => setActiveTab(tab)}
								style={{
									padding: '6px 12px',
									borderRadius: '6px',
									border: 'none',
									background: activeTab === tab ? 'var(--accent)' : 'transparent',
									color: activeTab === tab ? '#fff' : 'inherit',
									fontSize: '12px',
									fontWeight: 600,
									cursor: 'pointer',
								}}
							>
								{t(tab === 'basic' ? 'formTabBasic' : 'formTabRules')}
							</button>
						))}
						{draft.type === 'select' && (
							<button
								type="button"
								onClick={() => setActiveTab('options')}
								style={{
									padding: '6px 12px',
									borderRadius: '6px',
									border: 'none',
									background: activeTab === 'options' ? 'var(--accent)' : 'transparent',
									color: activeTab === 'options' ? '#fff' : 'inherit',
									fontSize: '12px',
									fontWeight: 600,
									cursor: 'pointer',
									display: 'flex',
									alignItems: 'center',
									gap: '5px',
								}}
							>
								{t('formTabOptions')}
								<span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '10px', background: 'rgba(255,255,255,0.2)' }}>
									{draft.options.length}
								</span>
							</button>
						)}
					</div>
					{activeTab === 'basic' && (
						<div
							style={{
								display: 'flex',
								background: 'rgba(0,0,0,0.2)',
								padding: '2px',
								borderRadius: '6px',
								border: '1px solid var(--window-border)',
							}}
						>
							{(['tr', 'en'] as const).map((tabCode) => (
								<button
									key={tabCode}
									type="button"
									onClick={() => setActiveLangTab(tabCode)}
									style={{
										padding: '3px 8px',
										borderRadius: '4px',
										border: 'none',
										background: activeLangTab === tabCode ? 'var(--accent)' : 'transparent',
										color: activeLangTab === tabCode ? '#fff' : 'inherit',
										fontSize: '11px',
										cursor: 'pointer',
										fontWeight: 600,
									}}
								>
									{tabCode.toUpperCase()}
								</button>
							))}
						</div>
					)}
				</div>

				{activeTab === 'basic' && <FieldEditorBasicTab draft={draft} setDraft={setDraft} activeLangTab={activeLangTab} t={t} />}
				{activeTab === 'rules' && <FieldEditorRulesTab draft={draft} setDraft={setDraft} t={t} />}
				{activeTab === 'options' && draft.type === 'select' && (
					<FieldEditorOptionsTab
						draft={draft}
						presets={presets}
						applyPreset={applyPreset}
						updateOption={updateOption}
						addOption={addOption}
						removeOption={removeOption}
						t={t}
					/>
				)}
			</div>

			<FieldEditorActions
				draft={draft}
				removeField={removeField}
				duplicateField={duplicateField}
				save={save}
				canSave={canSave}
				isSaving={isSaving}
				t={t}
			/>
		</div>
	);
}
