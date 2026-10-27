'use client';

import React, { useMemo, useState } from 'react';
import { ArrowRight, Check, Sparkles, Flag, SunMedium, Mountain, Compass, Orbit } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useShell } from '@/core/shell';
import { WALLPAPERS, wallpaperInfo, wallpaperPreview } from '@/core/theme';

type WallpaperCategory = 'all' | 'space' | 'dynamic' | 'landscape' | 'abstract' | 'national';

export function WallpaperPanel() {
	const { t } = useI18n();
	const { activeWallpaper, setWallpaper, cycleWallpaper } = useShell();
	const currentWallpaperObj = wallpaperInfo(activeWallpaper);
	const [selectedCategory, setSelectedCategory] = useState<WallpaperCategory>('all');

	const getWallpaperTitle = (wp: { id: string; title: string; titleKey?: string }) => {
		const key = wp.titleKey || `wp_${wp.id.replace(/-/g, '_')}`;
		return t(key, wp.title);
	};

	const getWallpaperType = (wp: { type: string; typeKey?: string }) => {
		const key = wp.typeKey || `wptype_${wp.type.toLowerCase().replace(/\s+/g, '_')}`;
		return t(key, wp.type);
	};

	const counts = useMemo(() => {
		let national = 0;
		let space = 0;
		let dynamic = 0;
		let landscape = 0;
		let abstract = 0;

		for (const wp of WALLPAPERS) {
			if (wp.type === 'Millî Koleksiyon') national++;
			else if (wp.type === 'Uzay' || wp.type === 'Space') space++;
			else if (wp.id === '3d-aurora' || wp.type.startsWith('Dynamic')) dynamic++;
			else if (wp.type === 'Landscape') landscape++;
			else if (wp.type === 'Abstract' || wp.type === 'Soyut') abstract++;
		}

		return {
			all: WALLPAPERS.length,
			national,
			space,
			dynamic,
			landscape,
			abstract,
		};
	}, []);

	const filteredWallpapers = useMemo(() => {
		switch (selectedCategory) {
			case 'national':
				return WALLPAPERS.filter((wp) => wp.type === 'Millî Koleksiyon');
			case 'space':
				return WALLPAPERS.filter((wp) => wp.type === 'Uzay' || wp.type === 'Space');
			case 'dynamic':
				return WALLPAPERS.filter((wp) => wp.id === '3d-aurora' || wp.type.startsWith('Dynamic'));
			case 'landscape':
				return WALLPAPERS.filter((wp) => wp.type === 'Landscape');
			case 'abstract':
				return WALLPAPERS.filter((wp) => (wp.type === 'Abstract' || wp.type === 'Soyut') && wp.id !== '3d-aurora');
			case 'all':
			default:
				return WALLPAPERS;
		}
	}, [selectedCategory]);

	const categories: Array<{ id: WallpaperCategory; label: string; icon: React.ReactNode; count: number }> = [
		{ id: 'all', label: t('settingsWallpaperCategoryAll'), icon: <Compass size={13} />, count: counts.all },
		...(counts.space > 0 ? [{ id: 'space' as WallpaperCategory, label: t('settingsWallpaperCategorySpace'), icon: <Orbit size={13} />, count: counts.space }] : []),
		...(counts.dynamic > 0 ? [{ id: 'dynamic' as WallpaperCategory, label: t('settingsWallpaperCategoryDynamic'), icon: <Sparkles size={13} />, count: counts.dynamic }] : []),
		...(counts.landscape > 0 ? [{ id: 'landscape' as WallpaperCategory, label: t('settingsWallpaperCategoryLandscape'), icon: <Mountain size={13} />, count: counts.landscape }] : []),
		...(counts.abstract > 0 ? [{ id: 'abstract' as WallpaperCategory, label: t('settingsWallpaperCategoryAbstract'), icon: <SunMedium size={13} />, count: counts.abstract }] : []),
		...(counts.national > 0 ? [{ id: 'national' as WallpaperCategory, label: t('settingsWallpaperCategoryNational'), icon: <Flag size={13} />, count: counts.national }] : []),
	];

	return (
		<div data-focus-section="wallpaper" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
			<div>
				<h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{t('settingsWallpaperTitle')}</h2>
				<p style={{ fontSize: '13px', opacity: 0.65, margin: '3px 0 0 0' }}>
					{t('settingsWallpaperDesc')}
				</p>
			</div>

			{/* Active Wallpaper Preview Hero Banner */}
			<div
				style={{
					position: 'relative',
					height: '144px',
					borderRadius: '12px',
					overflow: 'hidden',
					border: '1px solid var(--window-border)',
					boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
					backgroundImage: `url(${wallpaperPreview(activeWallpaper)})`,
					backgroundSize: 'cover',
					backgroundPosition: 'center',
					display: 'flex',
					alignItems: 'flex-end',
					padding: '14px',
				}}
			>
				<div
					style={{
						background: 'rgba(15, 17, 23, 0.78)',
						backdropFilter: 'var(--glass-blur, blur(16px))',
						WebkitBackdropFilter: 'var(--glass-blur, blur(16px))',
						padding: '10px 14px',
						borderRadius: '10px',
						color: '#fff',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						width: '100%',
						border: '1px solid rgba(255,255,255,0.12)',
					}}
				>
					<div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
							<span style={{ fontSize: '14px', fontWeight: 700 }}>{getWallpaperTitle(currentWallpaperObj)}</span>
							{(currentWallpaperObj.type === 'Uzay' || currentWallpaperObj.type === 'Space') && (
								<span
									style={{
										fontSize: '10px',
										fontWeight: 700,
										padding: '2px 7px',
										borderRadius: '999px',
										background: 'rgba(14, 165, 233, 0.25)',
										color: '#38bdf8',
										border: '1px solid rgba(14, 165, 233, 0.4)',
									}}
								>
									{t('wptype_space')}
								</span>
							)}
							{currentWallpaperObj.id === '3d-aurora' && (
								<span
									style={{
										fontSize: '10px',
										fontWeight: 700,
										padding: '2px 7px',
										borderRadius: '999px',
										background: 'rgba(99, 102, 241, 0.25)',
										color: '#a5b4fc',
										border: '1px solid rgba(99, 102, 241, 0.4)',
									}}
								>
									{t('settingsWallpaper3DLive')}
								</span>
							)}
						</div>
						<div style={{ fontSize: '11px', opacity: 0.75 }}>
							{t('settingsWallpaperCurrent')} • {getWallpaperType(currentWallpaperObj)}
						</div>
					</div>
					<button
						type="button"
						onClick={cycleWallpaper}
						style={{
							background: 'rgba(255,255,255,0.18)',
							padding: '6px 12px',
							borderRadius: '8px',
							fontSize: '11.5px',
							fontWeight: 600,
							color: '#fff',
							border: '1px solid rgba(255,255,255,0.2)',
							cursor: 'pointer',
							display: 'flex',
							alignItems: 'center',
							gap: '6px',
							transition: 'background 0.15s ease',
						}}
					>
						<span>{t('settingsWallpaperNext')}</span>
						<ArrowRight size={13} />
					</button>
				</div>
			</div>

			{/* Category Filter Pills */}
			<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
					<div style={{ fontSize: '13px', fontWeight: 600 }}>
						{t('settingsWallpaperCatalog')}
					</div>
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '4px',
							flexWrap: 'wrap',
						}}
					>
						{categories.map((cat) => {
							const isActive = selectedCategory === cat.id;
							return (
								<button
									key={cat.id}
									type="button"
									onClick={() => setSelectedCategory(cat.id)}
									style={{
										display: 'inline-flex',
										alignItems: 'center',
										gap: '5px',
										padding: '4px 9px',
										borderRadius: '7px',
										fontSize: '11px',
										fontWeight: isActive ? 600 : 500,
										cursor: 'pointer',
										border: isActive
											? '1px solid var(--accent)'
											: '1px solid var(--window-border)',
										background: isActive
											? 'var(--accent)'
											: 'var(--subtle-bg, rgba(255,255,255,0.04))',
										color: isActive ? '#ffffff' : 'inherit',
										opacity: isActive ? 1 : 0.8,
										transition: 'all 0.15s ease',
									}}
								>
									{cat.icon}
									<span>{cat.label}</span>
									<span
										style={{
											fontSize: '10px',
											padding: '0 4px',
											borderRadius: '999px',
											background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(128,128,128,0.2)',
											color: isActive ? '#ffffff' : 'inherit',
										}}
									>
										{cat.count}
									</span>
								</button>
							);
						})}
					</div>
				</div>

				{/* Wallpaper Grid */}
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(auto-fill, minmax(136px, 1fr))',
						gap: '12px',
					}}
				>
					{filteredWallpapers.map((wp) => {
						const isSelected = activeWallpaper === wp.src;
						const previewImg = wallpaperPreview(wp.src);
						const isSpace = wp.type === 'Uzay' || wp.type === 'Space';
						const is3D = wp.id === '3d-aurora';

						return (
							<div
								key={wp.id}
								onClick={() => setWallpaper(wp.src)}
								style={{
									display: 'flex',
									flexDirection: 'column',
									gap: '6px',
									cursor: 'pointer',
								}}
							>
								<div
									style={{
										position: 'relative',
										aspectRatio: '16/10',
										borderRadius: '9px',
										overflow: 'hidden',
										border: isSelected
											? '2.5px solid var(--accent)'
											: '1px solid var(--window-border)',
										backgroundImage: `url(${previewImg})`,
										backgroundSize: 'cover',
										backgroundPosition: 'center',
										boxShadow: isSelected
											? '0 0 0 2px rgba(var(--accent-rgb, 59, 130, 246), 0.3), 0 4px 12px rgba(0,0,0,0.25)'
											: '0 2px 6px rgba(0,0,0,0.1)',
										transition: 'transform 0.15s ease, border-color 0.15s ease',
									}}
								>
									{/* Category badges */}
									{isSpace && (
										<div
											style={{
												position: 'absolute',
												top: '5px',
												left: '5px',
												background: 'rgba(14, 165, 233, 0.92)',
												backdropFilter: 'blur(4px)',
												padding: '2px 6px',
												borderRadius: '4px',
												fontSize: '9px',
												fontWeight: 700,
												color: '#ffffff',
												letterSpacing: '0.2px',
												boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
											}}
										>
											{t('wptype_space')}
										</div>
									)}
									{is3D && (
										<div
											style={{
												position: 'absolute',
												top: '5px',
												left: '5px',
												background: 'linear-gradient(135deg, rgba(99,102,241,0.95), rgba(168,85,247,0.95))',
												backdropFilter: 'blur(4px)',
												padding: '2px 6px',
												borderRadius: '4px',
												fontSize: '9px',
												fontWeight: 700,
												color: '#ffffff',
												letterSpacing: '0.2px',
												boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
											}}
										>
											{t('settingsWallpaper3DLive')}
										</div>
									)}

									{/* Selected Checkmark */}
									{isSelected && (
										<div
											style={{
												position: 'absolute',
												bottom: '5px',
												right: '5px',
												background: 'var(--accent)',
												borderRadius: '50%',
												width: '20px',
												height: '20px',
												display: 'flex',
												alignItems: 'center',
												justifyContent: 'center',
												color: '#fff',
												boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
											}}
										>
											<Check size={13} strokeWidth={3} />
										</div>
									)}
								</div>

								<div style={{ display: 'flex', flexDirection: 'column', gap: '1px', textAlign: 'center' }}>
									<div
										style={{
											fontSize: '11.5px',
											fontWeight: isSelected ? 700 : 500,
											whiteSpace: 'nowrap',
											overflow: 'hidden',
											textOverflow: 'ellipsis',
										}}
										title={getWallpaperTitle(wp)}
									>
										{getWallpaperTitle(wp)}
									</div>
									<div
										style={{
											fontSize: '10px',
											opacity: isSelected ? 0.85 : 0.6,
										}}
									>
										{getWallpaperType(wp)}
									</div>
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
