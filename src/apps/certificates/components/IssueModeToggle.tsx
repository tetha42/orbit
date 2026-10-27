'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';

interface IssueModeToggleProps {
	mode: 'single' | 'bulk';
	onChange: (mode: 'single' | 'bulk') => void;
}

export function IssueModeToggle({ mode, onChange }: IssueModeToggleProps) {
	const { t } = useI18n();

	return (
		<div style={{ display: 'flex', gap: 4, padding: 2, borderRadius: 8, background: 'color-mix(in srgb, var(--text-primary) 6%, transparent)' }} role="group">
			{(['single', 'bulk'] as const).map((m) => (
				<button
					key={m}
					type="button"
					aria-pressed={mode === m}
					onClick={() => onChange(m)}
					style={{
						flex: 1,
						padding: '6px 10px',
						borderRadius: 6,
						border: 'none',
						cursor: 'pointer',
						fontSize: 12,
						fontWeight: 650,
						color: 'inherit',
						background: mode === m ? 'var(--window-bg)' : 'transparent',
					}}
				>
					{t(m === 'single' ? 'crtModeSingle' : 'crtModeBulk')}
				</button>
			))}
		</div>
	);
}
