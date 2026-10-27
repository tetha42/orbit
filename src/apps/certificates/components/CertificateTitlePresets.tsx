import React from 'react';
import { useI18n } from '@/core/i18n';

export const PRESET_OPTIONS = [
	{ key: 'certsPresetTeknofest', category: 'achievement' },
	{ key: 'certsPresetIot', category: 'participation' },
	{ key: 'certsPresetAi', category: 'participation' },
	{ key: 'certsPresetService', category: 'service' },
	{ key: 'certsPresetHonor', category: 'honor' },
];

interface CertificateTitlePresetsProps {
	onSelect: (preset: string, category?: string) => void;
}

export function CertificateTitlePresets({ onSelect }: CertificateTitlePresetsProps) {
	const { t } = useI18n();
	return (
		<div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
			{PRESET_OPTIONS.map((item) => {
				const label = t(item.key);
				return (
					<button
						key={item.key}
						type="button"
						onClick={() => onSelect(label, item.category)}
						style={{
							fontSize: '10.5px',
							padding: '3px 8px',
							borderRadius: '6px',
							background: 'rgba(255, 255, 255, 0.06)',
							border: '1px solid rgba(255, 255, 255, 0.1)',
							color: 'inherit',
							cursor: 'pointer',
						}}
					>
						{label}
					</button>
				);
			})}
		</div>
	);
}
