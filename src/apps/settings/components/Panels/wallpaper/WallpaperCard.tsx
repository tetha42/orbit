'use client';

import React from 'react';
import { Check, EyeOff, Orbit, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { wallpaperPreview } from '@/core/theme';
import type { DisplayWallpaper } from './types';

interface WallpaperCardProps {
	wallpaper: DisplayWallpaper;
	selected: boolean;
	canManage: boolean;
	busy: boolean;
	onSelect: (src: string) => void;
	onRename: (wallpaper: DisplayWallpaper) => void;
	onDelete: (wallpaper: DisplayWallpaper) => void;
}

export function WallpaperCard({
	wallpaper,
	selected,
	canManage,
	busy,
	onSelect,
	onRename,
	onDelete,
}: WallpaperCardProps) {
	const { t } = useI18n();
	const previewImg = wallpaperPreview(wallpaper.src);

	return (
		<div
			style={{
				position: 'relative',
				borderRadius: '12px',
				overflow: 'hidden',
				border: selected ? '2px solid var(--accent)' : '1px solid var(--window-border)',
				background: 'rgba(255,255,255,0.03)',
				transition: 'transform 120ms ease, border-color 120ms ease',
			}}
		>
			<button
				type="button"
				aria-label={wallpaper.title}
				aria-pressed={selected}
				onClick={() => onSelect(wallpaper.src)}
				style={{
					display: 'block',
					width: '100%',
					padding: 0,
					border: 'none',
					background: 'transparent',
					color: 'inherit',
					textAlign: 'left',
					cursor: 'pointer',
				}}
			>
				<span
					style={{
						display: 'block',
						height: '108px',
						backgroundImage: `url(${previewImg})`,
						backgroundSize: 'cover',
						backgroundPosition: 'center',
						position: 'relative',
					}}
				>
				<span
					style={{
						position: 'absolute',
						top: '8px',
						left: '8px',
						display: 'flex',
						gap: '4px',
						flexWrap: 'wrap',
					}}
				>
					{wallpaper.is3D && (
						<span
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: '3px',
								padding: '2px 7px',
								borderRadius: '999px',
								fontSize: '10px',
								fontWeight: 600,
								background: 'color-mix(in srgb, var(--accent) 85%, transparent)',
								color: '#fff',
							}}
						>
							<Sparkles size={10} />
							{t('settingsWallpaper3DLive')}
						</span>
					)}
					{wallpaper.isSpace && (
						<span
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: '3px',
								padding: '2px 7px',
								borderRadius: '999px',
								fontSize: '10px',
								fontWeight: 600,
								background: 'color-mix(in srgb, var(--indigo) 85%, transparent)',
								color: '#fff',
							}}
						>
							<Orbit size={10} />
							{t('wptype_space')}
						</span>
					)}
					{wallpaper.custom && (
						<span
							style={{
								padding: '2px 7px',
								borderRadius: '999px',
								fontSize: '10px',
								fontWeight: 600,
								background: 'rgba(0,0,0,0.6)',
								color: '#fff',
							}}
						>
							{t('settingsWallpaperCustom')}
						</span>
					)}
				</span>

				{selected && (
					<span
						style={{
							position: 'absolute',
							top: '8px',
							right: '8px',
							width: '22px',
							height: '22px',
							borderRadius: '50%',
							background: 'var(--accent)',
							color: '#fff',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
						}}
					>
						<Check size={13} />
					</span>
				)}
				</span>
			</button>

			<div style={{ padding: '9px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
				<div
					onClick={() => onSelect(wallpaper.src)}
					style={{ minWidth: 0, flex: 1, cursor: 'pointer' }}
				>
					<div style={{ fontSize: '12.5px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
						{wallpaper.title}
					</div>
					<div style={{ fontSize: '11px', opacity: 0.65, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
						{wallpaper.type}
					</div>
				</div>

				{canManage && (
					<div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
						<button
							type="button"
							disabled={busy}
							title={t('settingsWallpaperRename')}
							aria-label={t('settingsWallpaperRename')}
							onClick={() => onRename(wallpaper)}
							style={{
								width: '26px',
								height: '26px',
								borderRadius: '6px',
								border: '1px solid var(--window-border)',
								background: 'rgba(255,255,255,0.06)',
								color: 'inherit',
								display: 'inline-flex',
								alignItems: 'center',
								justifyContent: 'center',
								cursor: busy ? 'not-allowed' : 'pointer',
							}}
						>
							<Pencil size={12} />
						</button>
						<button
							type="button"
							disabled={busy}
							title={wallpaper.custom ? t('settingsWallpaperDelete') : t('settingsWallpaperHide')}
							aria-label={wallpaper.custom ? t('settingsWallpaperDelete') : t('settingsWallpaperHide')}
							onClick={() => onDelete(wallpaper)}
							style={{
								width: '26px',
								height: '26px',
								borderRadius: '6px',
								border: '1px solid color-mix(in srgb, var(--danger) 35%, transparent)',
								background: 'color-mix(in srgb, var(--danger) 10%, transparent)',
								color: 'var(--danger)',
								display: 'inline-flex',
								alignItems: 'center',
								justifyContent: 'center',
								cursor: busy ? 'not-allowed' : 'pointer',
							}}
						>
							{wallpaper.custom ? <Trash2 size={12} /> : <EyeOff size={12} />}
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
