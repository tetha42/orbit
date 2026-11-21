'use client';

import React from 'react';
import { Eye } from 'lucide-react';
import type { FormField } from '@/lib/formFields';
import { FormPreview } from '../FormPreview';

interface FieldPreviewPaneProps {
	isMobile: boolean;
	previewContext: 'registration' | 'profile';
	setPreviewContext: (ctx: 'registration' | 'profile') => void;
	previewFields: FormField[];
	activeDraftKey?: string;
	t: (key: string, fallback?: string) => string;
}

export function FieldPreviewPane({
	isMobile,
	previewContext,
	setPreviewContext,
	previewFields,
	activeDraftKey,
	t,
}: FieldPreviewPaneProps) {
	return (
		<div style={{ position: isMobile ? 'static' : 'sticky', top: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					padding: '6px 8px',
					borderRadius: '8px',
					background: 'var(--card-bg, rgba(255,255,255,0.03))',
					border: '1px solid var(--window-border)',
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, opacity: 0.8 }}>
					<Eye size={13} />
					<span>{t('formPreview')}</span>
				</div>
				<div style={{ display: 'flex', background: 'rgba(0,0,0,0.25)', borderRadius: '6px', padding: '2px' }}>
					<button
						type="button"
						onClick={() => setPreviewContext('registration')}
						style={{
							border: 'none',
							background: previewContext === 'registration' ? 'var(--accent)' : 'transparent',
							color: previewContext === 'registration' ? '#fff' : 'inherit',
							fontSize: '10.5px',
							fontWeight: 600,
							padding: '3px 8px',
							borderRadius: '4px',
							cursor: 'pointer',
						}}
					>
						{t('formPreviewModeReg')}
					</button>
					<button
						type="button"
						onClick={() => setPreviewContext('profile')}
						style={{
							border: 'none',
							background: previewContext === 'profile' ? 'var(--accent)' : 'transparent',
							color: previewContext === 'profile' ? '#fff' : 'inherit',
							fontSize: '10.5px',
							fontWeight: 600,
							padding: '3px 8px',
							borderRadius: '4px',
							cursor: 'pointer',
						}}
					>
						{t('formPreviewModeProfile')}
					</button>
				</div>
			</div>
			<FormPreview fields={previewFields} previewMode={previewContext} activeDraftKey={activeDraftKey} />
		</div>
	);
}
