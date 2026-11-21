'use client';

import React from 'react';
import {
	Compass,
	Mountain,
	Orbit,
	Plus,
	Sparkles,
	SunMedium,
	Upload,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { WallpaperCategory, WallpaperCategoryItem } from './types';

interface WallpaperCategoryBarProps {
	selectedCategory: WallpaperCategory;
	counts: Record<WallpaperCategory, number>;
	canManage: boolean;
	busy: boolean;
	onSelectCategory: (category: WallpaperCategory) => void;
	onTriggerUpload: () => void;
}

export function WallpaperCategoryBar({
	selectedCategory,
	counts,
	canManage,
	busy,
	onSelectCategory,
	onTriggerUpload,
}: WallpaperCategoryBarProps) {
	const { t } = useI18n();

	const categories: WallpaperCategoryItem[] = [
		{ id: 'all', label: t('settingsWallpaperCategoryAll'), icon: <Compass size={13} />, count: counts.all },
		...(counts.space > 0
			? [{ id: 'space' as WallpaperCategory, label: t('settingsWallpaperCategorySpace'), icon: <Orbit size={13} />, count: counts.space }]
			: []),
		...(counts.dynamic > 0
			? [{ id: 'dynamic' as WallpaperCategory, label: t('settingsWallpaperCategoryDynamic'), icon: <Sparkles size={13} />, count: counts.dynamic }]
			: []),
		...(counts.landscape > 0
			? [{ id: 'landscape' as WallpaperCategory, label: t('settingsWallpaperCategoryLandscape'), icon: <Mountain size={13} />, count: counts.landscape }]
			: []),
		...(counts.abstract > 0
			? [{ id: 'abstract' as WallpaperCategory, label: t('settingsWallpaperCategoryAbstract'), icon: <SunMedium size={13} />, count: counts.abstract }]
			: []),
		...(counts.custom > 0
			? [{ id: 'custom' as WallpaperCategory, label: t('settingsWallpaperCategoryCustom'), icon: <Upload size={13} />, count: counts.custom }]
			: []),
	];

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
				<h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
					{t('settingsWallpaperCatalog')}
				</h3>
				{canManage && (
					<button
						type="button"
						disabled={busy}
						onClick={onTriggerUpload}
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '6px',
							padding: '6px 12px',
							borderRadius: '8px',
							border: '1px solid var(--accent)',
							background: 'var(--accent)',
							color: '#fff',
							fontSize: '12px',
							fontWeight: 600,
							cursor: busy ? 'not-allowed' : 'pointer',
							opacity: busy ? 0.6 : 1,
						}}
					>
						<Plus size={13} />
						{t('settingsWallpaperAdd')}
					</button>
				)}
			</div>

			<div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
				{categories.map((category) => {
					const active = selectedCategory === category.id;
					return (
						<button
							key={category.id}
							type="button"
							onClick={() => onSelectCategory(category.id)}
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: '6px',
								padding: '6px 11px',
								borderRadius: '999px',
								border: active ? '1px solid var(--accent)' : '1px solid var(--window-border)',
								background: active ? 'var(--accent)' : 'rgba(255,255,255,0.04)',
								color: active ? '#fff' : 'inherit',
								fontSize: '12px',
								fontWeight: active ? 600 : 500,
								cursor: 'pointer',
							}}
						>
							{category.icon}
							<span>{category.label}</span>
							<span style={{ opacity: active ? 0.85 : 0.55, fontSize: '11px' }}>
								{category.count}
							</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}
