'use client';

import React, { useRef } from 'react';
import { ImageIcon } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useWallpapers } from './wallpaper/useWallpapers';
import { WallpaperHeroBanner } from './wallpaper/WallpaperHeroBanner';
import { WallpaperCategoryBar } from './wallpaper/WallpaperCategoryBar';
import { WallpaperGrid } from './wallpaper/WallpaperGrid';
import { WallpaperHiddenList } from './wallpaper/WallpaperHiddenList';

export function WallpaperPanel() {
	const { t } = useI18n();
	const state = useWallpapers();
	const fileInputRef = useRef<HTMLInputElement>(null);

	return (
		<div
			data-focus-section="wallpaper"
			style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}
		>
			<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
				<div
					style={{
						width: '36px',
						height: '36px',
						borderRadius: '10px',
						background: 'linear-gradient(135deg, var(--indigo), var(--accent))',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						color: '#fff',
						flexShrink: 0,
					}}
				>
					<ImageIcon size={18} />
				</div>
				<div>
					<h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
						{t('settingsWallpaperTitle')}
					</h2>
					<p style={{ fontSize: '12.5px', opacity: 0.7, margin: '3px 0 0 0' }}>
						{t('settingsWallpaperDesc')}
					</p>
				</div>
			</div>

			{state.feedback && (
				<div
					role="status"
					style={{
						padding: '9px 12px',
						borderRadius: '8px',
						fontSize: '12.5px',
						background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
						border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
						color: 'inherit',
					}}
				>
					{state.feedback}
				</div>
			)}

			<WallpaperHeroBanner
				activeWallpaper={state.activeWallpaper}
				currentWallpaperId={state.currentWallpaperObj.id}
				currentTitle={state.currentTitle}
				currentType={state.currentType}
				isSpace={state.currentWallpaperObj.type === 'Space'}
				onCycleWallpaper={state.cycleWallpaper}
			/>

			<input
				ref={fileInputRef}
				type="file"
				accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
				style={{ display: 'none' }}
				onChange={(event) => {
					const file = event.target.files?.[0];
					event.currentTarget.value = '';
					if (file) void state.uploadWallpaper(file);
				}}
			/>

			<WallpaperCategoryBar
				selectedCategory={state.selectedCategory}
				counts={state.counts}
				canManage={state.canManage}
				busy={state.busy || state.isLoadingCustom}
				onSelectCategory={state.setSelectedCategory}
				onTriggerUpload={() => fileInputRef.current?.click()}
			/>

			<WallpaperGrid
				wallpapers={state.filteredWallpapers}
				activeWallpaper={state.activeWallpaper}
				canManage={state.canManage}
				busy={state.busy}
				isLoadingCustom={state.isLoadingCustom}
				onSelect={state.setWallpaper}
				onRename={(wallpaper) => void state.renameWallpaper(wallpaper)}
				onDelete={(wallpaper) => void state.deleteWallpaper(wallpaper)}
			/>

			{state.canManage && (
				<WallpaperHiddenList
					hiddenBuiltins={state.hiddenBuiltins}
					busy={state.busy}
					onRestore={(id, titleTr, titleEn) => void state.restoreWallpaper(id, titleTr, titleEn)}
				/>
			)}
		</div>
	);
}
