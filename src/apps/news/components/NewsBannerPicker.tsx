'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';

interface NewsBannerPickerProps {
	imageUrl: string;
	onChangeImageUrl: (val: string) => void;
}

export function NewsBannerPicker({ imageUrl, onChangeImageUrl }: NewsBannerPickerProps) {
	const { t } = useI18n();

	const bannerPresets = [
		{ label: 'TEKNOFEST', url: '/app-icons/vscode/256.png' },
		{ label: t('newsSourceRectorate'), url: '/app-icons/appstore/256.png' },
		{ label: t('newsCatWorkshopShort'), url: '/app-icons/calendar/256.png' },
		{ label: t('invTitle', 'R&D / Inventory'), url: '/app-icons/system-preferences/256.png' },
	];

	return (
		<div>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
				<label style={{ fontSize: '11.5px', fontWeight: 600, opacity: 0.8 }}>{t('newsBannerLabel')}</label>
				<span style={{ fontSize: '11px', opacity: 0.6 }}>{t('newsBannerHint')}</span>
			</div>

			<div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
				{bannerPresets.map((preset) => (
					<button
						key={preset.url}
						type="button"
						onClick={() => onChangeImageUrl(preset.url)}
						style={{
							padding: '4px 10px',
							borderRadius: '6px',
							border: imageUrl === preset.url ? '1px solid var(--accent)' : '1px solid rgba(255, 255, 255, 0.1)',
							background: imageUrl === preset.url ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : 'rgba(255, 255, 255, 0.05)',
							color: imageUrl === preset.url ? 'var(--accent)' : 'inherit',
							fontSize: '11px',
							cursor: 'pointer',
						}}
					>
						{preset.label}
					</button>
				))}
			</div>

			<input
				type="text"
				placeholder={t('newsIconUrlPh')}
				value={imageUrl}
				onChange={(e) => onChangeImageUrl(e.target.value)}
				style={{
					width: '100%',
					padding: '8px 12px',
					borderRadius: '8px',
					background: 'rgba(0, 0, 0, 0.3)',
					border: '1px solid rgba(255, 255, 255, 0.15)',
					color: 'inherit',
					fontSize: '12.5px',
				}}
			/>
		</div>
	);
}
