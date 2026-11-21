'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';

interface ImportStepProgressProps {
	step: 1 | 2 | 3;
}

const STEPS: Array<{ id: 1 | 2 | 3; labelKey: string }> = [
	{ id: 1, labelKey: 'dbImportStepFile' },
	{ id: 2, labelKey: 'dbImportStepMapping' },
	{ id: 3, labelKey: 'dbImportStepConflict' },
];

export function ImportStepProgress({ step }: ImportStepProgressProps) {
	const { t } = useI18n();

	return (
		<div
			style={{
				display: 'flex',
				padding: '10px 20px',
				background: 'var(--fill-softer)',
				borderBottom: '1px solid var(--window-border)',
				gap: '12px',
				fontSize: '11.5px',
			}}
		>
			{STEPS.map((item, idx) => {
				const isActive = step === item.id;
				return (
					<React.Fragment key={item.id}>
						{idx > 0 && <span>›</span>}
						<div
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: '6px',
								fontWeight: isActive ? 700 : 400,
								color: isActive ? 'var(--accent)' : 'inherit',
							}}
						>
							<span
								style={{
									width: '18px',
									height: '18px',
									borderRadius: '50%',
									background: isActive ? 'var(--accent)' : 'var(--fill-strong)',
									color: isActive ? 'var(--accent-contrast)' : 'var(--text-secondary)',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									fontSize: '10px',
								}}
							>
								{item.id}
							</span>
							<span>{t(item.labelKey)}</span>
						</div>
					</React.Fragment>
				);
			})}
		</div>
	);
}
