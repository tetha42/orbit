'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
	ArrowRight,
	Check,
	Sparkles,
	Flag,
	SunMedium,
	Mountain,
	Compass,
	Orbit,
	Upload,
	Pencil,
	Trash2,
	Loader2,
	RotateCcw,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useShell } from '@/core/shell';
import { useSession } from '@/core/session';
import { useDialog } from '@/components/Common/DialogProvider';
import { errorMessage } from '@/lib/errors';
import { WALLPAPERS, wallpaperInfo, wallpaperPreview } from '@/core/theme';

type WallpaperCategory =
	| 'all'
	| 'space'
	| 'dynamic'
	| 'landscape'
	| 'abstract'
	| 'national'
	| 'custom';

interface CustomWallpaperItem {
	id: string;
	titleTr: string;
	titleEn: string;
	type: string;
	url: string;
}

interface DisplayWallpaper {
	id: string;
	title: string;
	type: string;
	src: string;
	custom?: boolean;
}

export function WallpaperPanel() {
	const { t, language } = useI18n();
	const { activeWallpaper, setWallpaper, cycleWallpaper } = useShell();
	const { canManageApp } = useSession();
	const dialog = useDialog();
	const canManage = canManageApp('settings');
	const currentWallpaperObj = wallpaperInfo(activeWallpaper);
	const [selectedCategory, setSelectedCategory] = useState<WallpaperCategory>('all');
	const [customWallpapers, setCustomWallpapers] = useState<CustomWallpaperItem[]>([]);
	const [overrides, setOverrides] = useState<
		Record<string, { titleTr?: string; titleEn?: string; hidden?: boolean }>
	>({});
	const [isLoadingCustom, setIsLoadingCustom] = useState(true);
	const [busy, setBusy] = useState(false);
	const [feedback, setFeedback] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const loadCustomWallpapers = React.useCallback(async () => {
		setIsLoadingCustom(true);
		try {
			const res = await fetch('/api/settings/wallpapers', { cache: 'no-store' });
			const data = await res.json();
			if (res.ok && data.ok) {
				setCustomWallpapers(data.wallpapers ?? []);
				setOverrides(data.overrides ?? {});
			}
		} catch {
			// Decorative: an unavailable catalogue never blocks the panel.
		} finally {
			setIsLoadingCustom(false);
		}
	}, []);

	useEffect(() => {
		void loadCustomWallpapers();
	}, [loadCustomWallpapers]);

	const displayWallpapers = useMemo<DisplayWallpaper[]>(
		() => [
			...WALLPAPERS.filter((wallpaper) => !overrides[wallpaper.id]?.hidden).map(
				(wallpaper) => {
					const override = overrides[wallpaper.id];
					return {
						id: wallpaper.id,
						title:
							(language === 'tr' ? override?.titleTr : override?.titleEn) ||
							t(
								wallpaper.titleKey || `wp_${wallpaper.id.replace(/-/g, '_')}`,
								wallpaper.title
							),
						type: t(
							wallpaper.typeKey ||
								`wptype_${wallpaper.type.toLowerCase().replace(/\s+/g, '_')}`,
							wallpaper.type
						),
						src: wallpaper.src,
					};
				}
			),
			...customWallpapers.map((wallpaper) => ({
				id: wallpaper.id,
				title: language === 'tr' ? wallpaper.titleTr : wallpaper.titleEn,
				type: wallpaper.type || t('settingsWallpaperCustomType'),
				src: wallpaper.url,
				custom: true,
			})),
		],
		[customWallpapers, language, overrides, t]
	);

	const getWallpaperType = (wp: DisplayWallpaper) => wp.type;

	const hiddenBuiltins = WALLPAPERS.filter((wallpaper) => overrides[wallpaper.id]?.hidden);

	const restoreWallpaper = async (id: string, titleTr: string, titleEn: string) => {
		if (busy) return;
		setBusy(true);
		try {
			const res = await fetch('/api/settings/wallpapers', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id, titleTr, titleEn, builtin: true, restore: true }),
			});
			const data = await res.json();
			if (!res.ok || !data.ok) throw new Error(data.error || t('settingsWallpaperSaveFailed'));
			setOverrides(data.overrides ?? {});
			setFeedback(t('settingsWallpaperRestored'));
		} catch (error) {
			setFeedback(errorMessage(error) || t('settingsWallpaperSaveFailed'));
		} finally {
			setBusy(false);
		}
	};

	const withUploaded = async (file: File) => {
		if (!canManage || busy) return;
		setFeedback(null);
		setBusy(true);
		try {
			const titleTr = await dialog.prompt({
				title: t('settingsWallpaperAdd'),
				message: t('settingsWallpaperNameTr'),
				defaultValue: file.name.replace(/\.[^.]+$/, ''),
				required: true,
			});
			if (titleTr === null) return;
			const titleEn = await dialog.prompt({
				title: t('settingsWallpaperAdd'),
				message: t('settingsWallpaperNameEn'),
				defaultValue: titleTr,
				required: true,
			});
			if (titleEn === null) return;

			const formData = new FormData();
			formData.set('file', file);
			formData.set('titleTr', titleTr);
			formData.set('titleEn', titleEn);
			formData.set('type', 'custom');
			const res = await fetch('/api/settings/wallpapers', { method: 'POST', body: formData });
			const data = await res.json();
			if (!res.ok || !data.ok) throw new Error(data.error || t('settingsWallpaperUploadFailed'));
			setCustomWallpapers((previous) => [...previous, data.wallpaper]);
			setFeedback(t('settingsWallpaperAdded'));
		} catch (error) {
			setFeedback(errorMessage(error) || t('settingsWallpaperUploadFailed'));
		} finally {
			setBusy(false);
			if (fileInputRef.current) fileInputRef.current.value = '';
		}
	};

	const renameWallpaper = async (wallpaper: DisplayWallpaper) => {
		if (busy) return;
		const source = customWallpapers.find((item) => item.id === wallpaper.id);
		const override = overrides[wallpaper.id];
		const titleTr = await dialog.prompt({
			title: t('settingsWallpaperRename'),
			message: t('settingsWallpaperNameTr'),
			defaultValue: source?.titleTr || override?.titleTr || wallpaper.title,
			required: true,
		});
		if (titleTr === null) return;
		const titleEn = await dialog.prompt({
			title: t('settingsWallpaperRename'),
			message: t('settingsWallpaperNameEn'),
			defaultValue: source?.titleEn || override?.titleEn || wallpaper.title,
			required: true,
		});
		if (titleEn === null) return;
		setBusy(true);
		try {
			const res = await fetch('/api/settings/wallpapers', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: wallpaper.id,
					titleTr,
					titleEn,
					...(wallpaper.custom ? {} : { builtin: true }),
				}),
			});
			const data = await res.json();
			if (!res.ok || !data.ok) throw new Error(data.error || t('settingsWallpaperSaveFailed'));
			if (wallpaper.custom) {
				setCustomWallpapers((previous) =>
					previous.map((item) =>
						item.id === wallpaper.id ? { ...item, titleTr, titleEn } : item
					)
				);
			} else {
				setOverrides(data.overrides ?? {});
			}
			setFeedback(t('settingsWallpaperRenamed'));
		} catch (error) {
			setFeedback(errorMessage(error) || t('settingsWallpaperSaveFailed'));
		} finally {
			setBusy(false);
		}
	};

	const deleteWallpaper = async (wallpaper: DisplayWallpaper) => {
		if (busy) return;
		const confirmed = await dialog.confirm({
			title: wallpaper.custom ? t('settingsWallpaperDelete') : t('settingsWallpaperHide'),
			message: wallpaper.custom
				? t('settingsWallpaperDeleteConfirm')
				: t('settingsWallpaperHideConfirm'),
			tone: 'danger',
		});
		if (!confirmed) return;
		setBusy(true);
		try {
			const suffix = wallpaper.custom ? '' : '&builtin=1';
			const res = await fetch(
				`/api/settings/wallpapers?id=${encodeURIComponent(wallpaper.id)}${suffix}`,
				{ method: 'DELETE' }
			);
			const data = await res.json();
			if (!res.ok || !data.ok) throw new Error(data.error || t('settingsWallpaperDeleteFailed'));
			if (wallpaper.custom) {
				setCustomWallpapers((previous) => previous.filter((item) => item.id !== wallpaper.id));
			} else {
				setOverrides(data.overrides ?? {});
			}
			if (activeWallpaper === wallpaper.src) setWallpaper('3d-aurora');
			setFeedback(wallpaper.custom ? t('settingsWallpaperDeleted') : t('settingsWallpaperHidden'));
		} catch (error) {
			setFeedback(errorMessage(error) || t('settingsWallpaperDeleteFailed'));
		} finally {
			setBusy(false);
		}
	};

	const counts = useMemo(() => {
		let national = 0;
		let space = 0;
		let dynamic = 0;
		let landscape = 0;
		let abstract = 0;

		let custom = 0;

		for (const wp of displayWallpapers) {
			if (wp.custom) custom++;
			else if (wp.type.includes('National') || wp.type.includes('Millî')) national++;
			else if (wp.type === 'Uzay' || wp.type === 'Space') space++;
			else if (wp.id === '3d-aurora' || wp.type.startsWith('Dynamic')) dynamic++;
			else if (wp.type === 'Landscape') landscape++;
			else if (wp.type === 'Abstract' || wp.type === 'Soyut') abstract++;
		}

		return {
			all: displayWallpapers.length,
			national,
			space,
			dynamic,
			landscape,
			abstract,
			custom,
		};
	}, [displayWallpapers]);

	const filteredWallpapers = useMemo(() => {
		switch (selectedCategory) {
			case 'national':
				return displayWallpapers.filter(
					(wp) => wp.type.includes('National') || wp.type.includes('Millî')
				);
			case 'space':
				return displayWallpapers.filter((wp) => wp.type === 'Uzay' || wp.type === 'Space');
			case 'dynamic':
				return displayWallpapers.filter(
					(wp) => wp.id === '3d-aurora' || wp.type.startsWith('Dynamic')
				);
			case 'landscape':
				return displayWallpapers.filter((wp) => wp.type === 'Landscape');
			case 'abstract':
				return displayWallpapers.filter(
					(wp) => (wp.type === 'Abstract' || wp.type === 'Soyut') && wp.id !== '3d-aurora'
				);
			case 'custom':
				return displayWallpapers.filter((wp) => wp.custom);
			case 'all':
			default:
				return displayWallpapers;
		}
	}, [selectedCategory, displayWallpapers]);

	const categories: Array<{ id: WallpaperCategory; label: string; icon: React.ReactNode; count: number }> = [
		{ id: 'all', label: t('settingsWallpaperCategoryAll'), icon: <Compass size={13} />, count: counts.all },
		...(counts.space > 0 ? [{ id: 'space' as WallpaperCategory, label: t('settingsWallpaperCategorySpace'), icon: <Orbit size={13} />, count: counts.space }] : []),
		...(counts.dynamic > 0 ? [{ id: 'dynamic' as WallpaperCategory, label: t('settingsWallpaperCategoryDynamic'), icon: <Sparkles size={13} />, count: counts.dynamic }] : []),
		...(counts.landscape > 0 ? [{ id: 'landscape' as WallpaperCategory, label: t('settingsWallpaperCategoryLandscape'), icon: <Mountain size={13} />, count: counts.landscape }] : []),
		...(counts.abstract > 0 ? [{ id: 'abstract' as WallpaperCategory, label: t('settingsWallpaperCategoryAbstract'), icon: <SunMedium size={13} />, count: counts.abstract }] : []),
		...(counts.national > 0 ? [{ id: 'national' as WallpaperCategory, label: t('settingsWallpaperCategoryNational'), icon: <Flag size={13} />, count: counts.national }] : []),
		...(counts.custom > 0 ? [{ id: 'custom' as WallpaperCategory, label: t('settingsWallpaperCategoryCustom'), icon: <Upload size={13} />, count: counts.custom }] : []),
	];

	return (
		<div data-focus-section="wallpaper" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
			<div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
				<div>
					<h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{t('settingsWallpaperTitle')}</h2>
					<p style={{ fontSize: '13px', opacity: 0.65, margin: '3px 0 0 0' }}>
						{t('settingsWallpaperDesc')}
					</p>
				</div>
				{canManage && (
					<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
						<input
							ref={fileInputRef}
							type="file"
							accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
							hidden
							onChange={(event) => {
								const file = event.target.files?.[0];
								if (file) void withUploaded(file);
							}}
						/>
						<button
							type="button"
							onClick={() => fileInputRef.current?.click()}
							disabled={busy || isLoadingCustom}
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: '6px',
								padding: '7px 12px',
								borderRadius: '8px',
								border: '1px solid var(--accent)',
								background: 'var(--accent)',
								color: '#fff',
								fontSize: '12px',
								fontWeight: 600,
								cursor: busy ? 'wait' : 'pointer',
								opacity: busy ? 0.7 : 1,
							}}
						>
							{busy ? <Loader2 size={14} /> : <Upload size={14} />}
							{t('settingsWallpaperAdd')}
						</button>
					</div>
				)}
			</div>

			{feedback && (
				<div
					role="status"
					style={{
						fontSize: '12px',
						padding: '9px 12px',
						borderRadius: '8px',
						border: '1px solid var(--window-border)',
						background: 'var(--fill-soft)',
					}}
				>
					{feedback}
				</div>
			)}

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
							<span style={{ fontSize: '14px', fontWeight: 700 }}>
							{(() => {
								const currentCustom = customWallpapers.find(
									(item) => item.url === activeWallpaper
								);
								if (currentCustom) {
									return language === 'tr' ? currentCustom.titleTr : currentCustom.titleEn;
								}
								const currentOverride = overrides[currentWallpaperObj.id];
								if (currentOverride) {
									return (
										(language === 'tr' ? currentOverride.titleTr : currentOverride.titleEn) ||
										currentWallpaperObj.title
									);
								}
								return t(
											currentWallpaperObj.titleKey ||
												`wp_${currentWallpaperObj.id.replace(/-/g, '_')}`,
									currentWallpaperObj.title
								);
							})()}
						</span>
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

									{canManage && (
										<div
											style={{
												position: 'absolute',
												top: '5px',
												right: '5px',
												display: 'flex',
												gap: '4px',
											}}
										>
											<button
												type="button"
												title={t('settingsWallpaperRename')}
												onClick={(event) => {
													event.stopPropagation();
													void renameWallpaper(wp);
												}}
												style={{
													width: '24px',
													height: '24px',
													borderRadius: '6px',
													border: '1px solid rgba(255,255,255,0.25)',
													background: 'rgba(9,9,11,0.7)',
													color: '#fff',
													display: 'grid',
													placeItems: 'center',
													cursor: 'pointer',
												}}
											>
												<Pencil size={12} />
											</button>
											<button
												type="button"
												title={wp.custom ? t('settingsWallpaperDelete') : t('settingsWallpaperHide')}
												onClick={(event) => {
													event.stopPropagation();
													void deleteWallpaper(wp);
												}}
												style={{
													width: '24px',
													height: '24px',
													borderRadius: '6px',
													border: '1px solid rgba(239,68,68,0.45)',
													background: 'rgba(9,9,11,0.7)',
													color: '#f87171',
													display: 'grid',
													placeItems: 'center',
													cursor: 'pointer',
												}}
											>
												<Trash2 size={12} />
											</button>
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
										title={wp.title}
									>
										{wp.title}
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

				{canManage && hiddenBuiltins.length > 0 && (
					<div
						style={{
							padding: '12px',
							borderRadius: '10px',
							border: '1px solid var(--window-border)',
							background: 'var(--fill-soft)',
							display: 'flex',
							flexDirection: 'column',
							gap: '8px',
						}}
					>
						<div style={{ fontSize: '11.5px', fontWeight: 600, opacity: 0.7 }}>
							{t('settingsWallpaperHiddenList')}
						</div>
						{hiddenBuiltins.map((wallpaper) => (
							<div key={wallpaper.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
								<span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
									{t(wallpaper.titleKey || `wp_${wallpaper.id.replace(/-/g, '_')}`, wallpaper.title)}
								</span>
								<button
									type="button"
									disabled={busy}
									onClick={() =>
										void restoreWallpaper(
											wallpaper.id,
											t(wallpaper.titleKey || `wp_${wallpaper.id.replace(/-/g, '_')}`, wallpaper.title),
											t(wallpaper.titleKey || `wp_${wallpaper.id.replace(/-/g, '_')}`, wallpaper.title)
										)
									}
									style={{
										display: 'inline-flex',
										alignItems: 'center',
										gap: '5px',
										padding: '5px 9px',
										borderRadius: '7px',
										border: '1px solid var(--window-border)',
										background: 'transparent',
										color: 'inherit',
										fontSize: '11px',
										fontWeight: 600,
										cursor: busy ? 'wait' : 'pointer',
									}}
								>
									<RotateCcw size={11} />
									{t('settingsWallpaperRestore')}
								</button>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
