'use client';

import React from 'react';
import { Copy, Save, Trash2 } from 'lucide-react';
import type { FormField } from '@/lib/formFields';

interface FieldEditorActionsProps {
	draft: FormField;
	removeField: () => Promise<void>;
	duplicateField: (field: FormField) => void;
	save: () => Promise<void>;
	canSave: boolean;
	isSaving: boolean;
	t: (key: string, fallback?: string) => string;
}

export function FieldEditorActions({
	draft,
	removeField,
	duplicateField,
	save,
	canSave,
	isSaving,
	t,
}: FieldEditorActionsProps) {
	return (
		<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
			<div>
				{draft.id && (
					<button
						type="button"
						onClick={() => void removeField()}
						disabled={isSaving}
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '6px',
							padding: '8px 12px',
							borderRadius: '8px',
							border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
							background: 'color-mix(in srgb, var(--danger) 8%, transparent)',
							color: 'var(--danger)',
							fontSize: '12px',
							fontWeight: 600,
							cursor: 'pointer',
						}}
					>
						<Trash2 size={13} />
						{t('delete')}
					</button>
				)}
			</div>
			<div style={{ display: 'flex', gap: '8px' }}>
				{draft.id && (
					<button
						type="button"
						onClick={() => duplicateField(draft)}
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '6px',
							padding: '8px 12px',
							borderRadius: '8px',
							border: '1px solid var(--window-border)',
							background: 'rgba(255,255,255,0.06)',
							color: 'inherit',
							fontSize: '12px',
							cursor: 'pointer',
						}}
					>
						<Copy size={13} />
						{t('formDuplicate')}
					</button>
				)}
				<button
					type="button"
					onClick={() => void save()}
					disabled={!canSave || isSaving}
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: '6px',
						padding: '8px 16px',
						borderRadius: '8px',
						border: '1px solid var(--accent)',
						background: 'var(--accent)',
						color: '#fff',
						fontSize: '12px',
						fontWeight: 600,
						cursor: !canSave || isSaving ? 'default' : 'pointer',
						opacity: !canSave || isSaving ? 0.5 : 1,
						boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
					}}
				>
					<Save size={13} />
					{t('formSave')}
				</button>
			</div>
		</div>
	);
}
