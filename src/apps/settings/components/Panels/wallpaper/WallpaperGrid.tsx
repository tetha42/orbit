'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import type { DisplayWallpaper } from './types';
import { WallpaperCard } from './WallpaperCard';

interface WallpaperGridProps {
	wallpapers: DisplayWallpaper[];
	activeWallpaper: string;
	canManage: boolean;
	busy: boolean;
	isLoadingCustom: boolean;
	onSelect: (src: string) => void;
	onRename: (wallpaper: DisplayWallpaper) => void;
	onDelete: (wallpaper: DisplayWallpaper) => void;
}

export function WallpaperGrid({
	wallpapers,
	activeWallpaper,
	canManage,
	busy,
	isLoadingCustom,
	onSelect,
	onRename,
	onDelete,
}: WallpaperGridProps) {
	const { t } = useI18n();

	if (isLoadingCustom && wallpapers.length === 0) {
		return (
			<div style={{ padding: '24px', textAlign: 'center', opacity: 0.6, fontSize: '13px' }}>
				{t('loading')}
			</div>
		);
	}

	return (
		<div
			style={{
				display: 'grid',
				gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
				gap: '12px',
			}}
		>
			{wallpapers.map((wallpaper) => (
				<WallpaperCard
					key={wallpaper.id}
					wallpaper={wallpaper}
					selected={activeWallpaper === wallpaper.src}
					canManage={canManage}
					busy={busy}
					onSelect={onSelect}
					onRename={onRename}
					onDelete={onDelete}
				/>
			))}
		</div>
	);
}
