'use client';

import React from 'react';
import { RotateCcw } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { WALLPAPERS } from '@/core/theme';

interface WallpaperHiddenListProps {
	hiddenBuiltins: readonly (typeof WALLPAPERS)[number][];
	busy: boolean;
	onRestore: (id: string, titleTr: string, titleEn: string) => void;
}

export function WallpaperHiddenList({
	hiddenBuiltins,
	busy,
	onRestore,
}: WallpaperHiddenListProps) {
	const { t } = useI18n();

	if (hiddenBuiltins.length === 0) return null;

	return (
		<div
			style={{
				padding: '12px 14px',
				borderRadius: '10px',
				border: '1px solid var(--window-border)',
				background: 'rgba(255,255,255,0.025)',
				display: 'flex',
				flexDirection: 'column',
				gap: '10px',
			}}
		>
			<div style={{ fontSize: '12.5px', fontWeight: 600 }}>{t('settingsWallpaperHiddenList')}</div>
			<div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
				{hiddenBuiltins.map((item) => {
					const title = t(
						item.titleKey || `wp_${item.id.replace(/-/g, '_')}`,
						item.title,
					);
					return (
						<div
							key={item.id}
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: '8px',
								padding: '5px 10px',
								borderRadius: '8px',
								border: '1px solid var(--window-border)',
								background: 'rgba(255,255,255,0.04)',
								fontSize: '12px',
							}}
						>
							<span>{title}</span>
							<button
								type="button"
								disabled={busy}
								onClick={() => onRestore(item.id, item.title, item.title)}
								style={{
									display: 'inline-flex',
									alignItems: 'center',
									gap: '4px',
									padding: '3px 8px',
									borderRadius: '6px',
									border: '1px solid var(--accent)',
									background: 'transparent',
									color: 'var(--accent)',
									fontSize: '11px',
									fontWeight: 600,
									cursor: busy ? 'not-allowed' : 'pointer',
								}}
							>
								<RotateCcw size={11} />
								{t('settingsWallpaperRestore')}
							</button>
						</div>
					);
				})}
			</div>
		</div>
	);
}
