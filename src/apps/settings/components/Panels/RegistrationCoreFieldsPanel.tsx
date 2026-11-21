'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, Save } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useRegistrationCore } from './registrationCore/useRegistrationCore';
import { CoreSelectFieldCard } from './registrationCore/CoreSelectFieldCard';
import { MemberIdFieldCard } from './registrationCore/MemberIdFieldCard';

export function RegistrationCoreFieldsPanel() {
	const { t } = useI18n();
	const {
		draft,
		isLoading,
		isSaving,
		status,
		updateField,
		updateMemberId,
		updateOption,
		addOption,
		removeOption,
		save,
	} = useRegistrationCore();

	if (isLoading) {
		return <div style={{ padding: 20, textAlign: 'center', opacity: 0.55 }}>{t('loading')}</div>;
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
			<div>
				<h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>{t('regCoreTitle')}</h3>
				<p style={{ margin: '3px 0 0', fontSize: '11.5px', opacity: 0.6 }}>{t('regCoreDesc')}</p>
			</div>

			{status && (
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '7px',
						padding: '8px 10px',
						borderRadius: '8px',
						fontSize: '11.5px',
						background: status.type === 'ok' ? 'color-mix(in srgb, var(--success) 12%, transparent)' : 'color-mix(in srgb, var(--danger) 12%, transparent)',
						color: status.type === 'ok' ? 'var(--success)' : 'var(--danger)',
						border: `1px solid ${status.type === 'ok' ? 'color-mix(in srgb, var(--success) 30%, transparent)' : 'color-mix(in srgb, var(--danger) 30%, transparent)'}`,
					}}
				>
					{status.type === 'ok' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
					{status.text}
				</div>
			)}

			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
				<CoreSelectFieldCard
					fieldKey="track"
					field={draft.track}
					onUpdateField={updateField}
					onAddOption={addOption}
					onUpdateOption={updateOption}
					onRemoveOption={removeOption}
				/>
				<CoreSelectFieldCard
					fieldKey="level"
					field={draft.level}
					onUpdateField={updateField}
					onAddOption={addOption}
					onUpdateOption={updateOption}
					onRemoveOption={removeOption}
				/>
			</div>

			<MemberIdFieldCard memberId={draft.memberId} onUpdate={updateMemberId} />

			<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
				<button
					type="button"
					onClick={() => void save()}
					disabled={isSaving}
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: '6px',
						padding: '8px 16px',
						borderRadius: '8px',
						border: 'none',
						background: 'var(--accent)',
						color: '#fff',
						fontSize: '12px',
						fontWeight: 600,
						cursor: isSaving ? 'wait' : 'pointer',
						opacity: isSaving ? 0.7 : 1,
					}}
				>
					<Save size={13} />
					{isSaving ? t('saving') : t('regCoreSave')}
				</button>
			</div>
		</div>
	);
}
