'use client';

import React from 'react';
import { Orbit, Shuffle, Sparkles } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { wallpaperPreview } from '@/core/theme';

interface WallpaperHeroBannerProps {
	activeWallpaper: string;
	currentWallpaperId: string;
	currentTitle: string;
	currentType: string;
	isSpace: boolean;
	onCycleWallpaper: () => void;
}

export function WallpaperHeroBanner({
	activeWallpaper,
	currentWallpaperId,
	currentTitle,
	currentType,
	isSpace,
	onCycleWallpaper,
}: WallpaperHeroBannerProps) {
	const { t } = useI18n();
	const is3D = currentWallpaperId === '3d-aurora';

	return (
		<div
			style={{
				position: 'relative',
				height: '170px',
				borderRadius: '14px',
				overflow: 'hidden',
				border: '1px solid var(--window-border)',
				backgroundImage: `url(${wallpaperPreview(activeWallpaper)})`,
				backgroundSize: 'cover',
				backgroundPosition: 'center',
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'space-between',
				padding: '16px',
				boxSizing: 'border-box',
			}}
		>
			<div
				style={{
					position: 'absolute',
					inset: 0,
					background:
						'linear-gradient(180deg, color-mix(in srgb, var(--ink-bg) 35%, transparent) 0%, color-mix(in srgb, var(--ink-bg) 78%, transparent) 100%)',
					pointerEvents: 'none',
				}}
			/>

			<div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
				<span
					style={{
						padding: '4px 10px',
						borderRadius: '999px',
						fontSize: '11px',
						fontWeight: 600,
						background: 'rgba(0,0,0,0.45)',
						color: '#fff',
						backdropFilter: 'blur(8px)',
						border: '1px solid rgba(255,255,255,0.18)',
					}}
				>
					{t('settingsWallpaperCurrent')}
				</span>

				<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
					{is3D && (
						<span
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: '4px',
								padding: '4px 9px',
								borderRadius: '999px',
								fontSize: '11px',
								fontWeight: 600,
								background: 'color-mix(in srgb, var(--accent) 28%, transparent)',
								color: '#93c5fd',
								border: '1px solid color-mix(in srgb, var(--accent) 45%, transparent)',
							}}
						>
							<Sparkles size={11} />
							{t('settingsWallpaper3DLive')}
						</span>
					)}
					{isSpace && (
						<span
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: '4px',
								padding: '4px 9px',
								borderRadius: '999px',
								fontSize: '11px',
								fontWeight: 600,
								background: 'color-mix(in srgb, var(--indigo) 28%, transparent)',
								color: '#c4b5fd',
								border: '1px solid color-mix(in srgb, var(--indigo) 45%, transparent)',
							}}
						>
							<Orbit size={11} />
							{t('wptype_space')}
						</span>
					)}
				</div>
			</div>

			<div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
				<div>
					<div style={{ fontSize: '17px', fontWeight: 700, color: '#fff' }}>{currentTitle}</div>
					<div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', marginTop: '2px' }}>
						{currentType}
					</div>
				</div>

				<button
					type="button"
					onClick={onCycleWallpaper}
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: '6px',
						padding: '7px 12px',
						borderRadius: '8px',
						border: '1px solid rgba(255,255,255,0.22)',
						background: 'rgba(0,0,0,0.5)',
						color: '#fff',
						fontSize: '12px',
						fontWeight: 600,
						cursor: 'pointer',
						backdropFilter: 'blur(8px)',
					}}
				>
					<Shuffle size={13} />
					{t('settingsWallpaperNext')}
				</button>
			</div>
		</div>
	);
}
