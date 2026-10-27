'use client';

import { useRef, useEffect } from 'react';
import { useSession } from '@/core/session';
import { useSound } from '@/core/sound';
import { useI18n } from '@/core/i18n';
import { useShell } from '@/core/shell';
import { useTheme } from '@/core/theme';
import { RoleBadge, roleGradient } from '@/core/ui/RoleBadge';
import {
	SlidersHorizontal,
	Moon,
	Sun,
	Volume2,
	VolumeX,
	SunMedium,
	LogOut,
	Globe,
	Sparkles,
} from 'lucide-react';

export function ControlCenterApplet() {
	const { currentUser, logout } = useSession();
	const { language, setLanguage, t } = useI18n();
	const { volume, setVolume, isMuted, toggleMute, playSystemSound, isAmbientSfxEnabled, toggleAmbientSfx } = useSound();
	const { isControlCenterOpen, setIsControlCenterOpen, brightness, setBrightness } = useShell();
	const { isDark, toggleTheme } = useTheme();

	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handlePointerDown = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setIsControlCenterOpen(false);
			}
		};
		window.addEventListener('pointerdown', handlePointerDown);
		return () => window.removeEventListener('pointerdown', handlePointerDown);
	}, [setIsControlCenterOpen]);

	return (
		<div ref={ref} style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center' }}>
			<button
				onClick={() => setIsControlCenterOpen(!isControlCenterOpen)}
				title={t('controlCenterTitle')}
				style={{
					padding: '2px 6px',
					borderRadius: '4px',
					background: isControlCenterOpen ? 'var(--fill-strong)' : 'transparent',
					cursor: 'default',
					color: 'inherit',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
				}}
			>
				<SlidersHorizontal size={14} />
			</button>

			{isControlCenterOpen && (
				<div
					style={{
						position: 'absolute',
						top: '28px',
						right: 0,
						width: '300px',
						background: 'var(--menu-bg)',
						backdropFilter: 'var(--glass-blur-strong)',
						border: '1px solid var(--menu-border)',
						borderRadius: '14px',
						boxShadow: 'var(--menu-shadow)',
						padding: '14px',
						zIndex: 99999,
						fontSize: '13px',
						color: 'var(--text-primary)',
						display: 'flex',
						flexDirection: 'column',
						gap: '12px',
						userSelect: 'none',
						animation: 'modalSlideIn 150ms cubic-bezier(0.16, 1, 0.3, 1)',
					}}
				>
					{/* 1. Integrated User Account Card */}
					{currentUser && (
						<div
							style={{
								background: 'var(--card-bg)',
								border: '1px solid var(--card-border)',
								borderRadius: '10px',
								padding: '12px',
								display: 'flex',
								flexDirection: 'column',
								gap: '10px',
							}}
						>
							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
								<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
									<div
										style={{
											width: '36px',
											height: '36px',
											borderRadius: '50%',
											background: roleGradient(currentUser.rolBilgi?.renk),
											color: '#fff',
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
											fontWeight: 700,
											fontSize: '14px',
											boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
										}}
									>
										{currentUser.ad[0]}
										{currentUser.soyad[0]}
									</div>
									<div>
										<div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--window-text)' }}>
											{currentUser.ad} {currentUser.soyad}
										</div>
										<div style={{ fontSize: '11px', opacity: 0.7 }}>
											{currentUser.bolum}
										</div>
									</div>
								</div>

								<button
									onClick={() => {
										setIsControlCenterOpen(false);
										logout();
									}}
									title={t('signOut')}
									style={{
										padding: '6px',
										borderRadius: '6px',
										border: 'none',
										background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
										color: 'var(--danger)',
										cursor: 'pointer',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
									}}
								>
									<LogOut size={14} />
								</button>
							</div>

							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid var(--card-border)' }}>
								<RoleBadge role={currentUser.rolBilgi} bosMetin={t('roleNone')} />
								<span
									style={{
										fontSize: '11px',
										fontWeight: 700,
										color: 'var(--warning)',
										display: 'flex',
										alignItems: 'center',
										gap: '4px',
									}}
								>
									<Sparkles size={12} />
									<span>{currentUser.xp || 0} XP</span>
								</span>
							</div>
						</div>
					)}

					{/* 2. Tiles Row: Dark Mode & Language Switcher */}
					<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
						{/* Dark Mode Tile */}
						<button
							onClick={toggleTheme}
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: '8px',
								padding: '8px 10px',
								borderRadius: '8px',
								background: 'var(--card-bg)',
								border: '1px solid var(--card-border)',
								cursor: 'default',
								color: 'inherit',
							}}
						>
							<div
								style={{
									width: '26px',
									height: '26px',
									borderRadius: '50%',
									background: isDark ? 'var(--accent-blue)' : 'var(--fill-strong)',
									color: isDark ? '#fff' : 'inherit',
									display: 'grid',
									placeItems: 'center',
									flexShrink: 0,
								}}
							>
								{isDark ? <Moon size={14} /> : <Sun size={14} />}
							</div>
							<div style={{ textAlign: 'left', minWidth: 0 }}>
								<div style={{ fontWeight: 600, fontSize: '11.5px', lineHeight: 1.2 }}>{t('darkMode')}</div>
								<div style={{ fontSize: '10.5px', opacity: 0.6 }}>
									{isDark ? t('darkModeOn') : t('darkModeOff')}
								</div>
							</div>
						</button>

						{/* Language Toggle Tile */}
						<button
							onClick={() => setLanguage(language === 'tr' ? 'en' : 'tr')}
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: '8px',
								padding: '8px 10px',
								borderRadius: '8px',
								background: 'var(--card-bg)',
								border: '1px solid var(--card-border)',
								cursor: 'default',
								color: 'inherit',
							}}
						>
							<div
								style={{
									width: '26px',
									height: '26px',
									borderRadius: '50%',
									background: 'var(--accent-muted)',
									color: 'var(--accent-blue)',
									display: 'grid',
									placeItems: 'center',
									flexShrink: 0,
								}}
							>
								<Globe size={14} />
							</div>
							<div style={{ textAlign: 'left', minWidth: 0 }}>
								<div style={{ fontWeight: 600, fontSize: '11.5px', lineHeight: 1.2 }}>{t('language')}</div>
								<div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--accent-blue)' }}>
									{language === 'tr' ? 'TR (Türkçe)' : 'EN (English)'}
								</div>
							</div>
						</button>
					</div>

					{/* 3. Display Brightness Slider */}
					<div
						style={{
							background: 'var(--card-bg)',
							border: '1px solid var(--card-border)',
							borderRadius: '8px',
							padding: '10px 12px',
							display: 'flex',
							flexDirection: 'column',
							gap: '6px',
						}}
					>
						<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', fontWeight: 500 }}>
							<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
								<SunMedium size={14} />
								<span>{t('brightness')}</span>
							</div>
							<span style={{ opacity: 0.6, fontSize: '11px' }}>{brightness}%</span>
						</div>
						<input
							type="range"
							min={20}
							max={100}
							value={brightness}
							onChange={(e) => setBrightness(Number(e.target.value))}
							style={{ width: '100%', accentColor: 'var(--accent-blue)', height: '4px', cursor: 'pointer' }}
						/>
					</div>

					{/* 4. Sound Volume Slider & Mute Toggle */}
					<div
						style={{
							background: 'var(--card-bg)',
							border: '1px solid var(--card-border)',
							borderRadius: '8px',
							padding: '10px 12px',
							display: 'flex',
							flexDirection: 'column',
							gap: '6px',
						}}
					>
						<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', fontWeight: 500 }}>
							<div
								onClick={toggleMute}
								style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
								title="Sesi Aç / Kapat"
							>
								{isMuted ? <VolumeX size={14} color="var(--danger)" /> : <Volume2 size={14} />}
								<span>{t('soundVolume')}</span>
							</div>
							<span style={{ opacity: 0.6, fontSize: '11px' }}>{isMuted ? t('muted') : `${volume}%`}</span>
						</div>
						<input
							type="range"
							min={0}
							max={100}
							disabled={isMuted}
							value={isMuted ? 0 : volume}
							onChange={(e) => {
								const val = Number(e.target.value);
								setVolume(val);
								playSystemSound();
							}}
							style={{
								width: '100%',
								accentColor: 'var(--accent-blue)',
								height: '4px',
								cursor: isMuted ? 'not-allowed' : 'pointer',
								opacity: isMuted ? 0.4 : 1,
							}}
						/>
					</div>

					{/* 5. 3D Aurora Ambient SFX Toggle */}
					<div
						onClick={toggleAmbientSfx}
						style={{
							background: isAmbientSfxEnabled && !isMuted ? 'rgba(56, 189, 248, 0.15)' : 'var(--card-bg)',
							border: isAmbientSfxEnabled && !isMuted ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid var(--card-border)',
							borderRadius: '8px',
							padding: '8px 12px',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							cursor: 'pointer',
							transition: 'all 0.2s ease',
						}}
					>
						<div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 500 }}>
							<Sparkles size={14} color={isAmbientSfxEnabled && !isMuted ? '#38bdf8' : 'currentColor'} />
							<span>{t('ambientSound')}</span>
						</div>
						<span style={{ fontSize: '11px', color: isAmbientSfxEnabled && !isMuted ? '#38bdf8' : 'inherit', opacity: isAmbientSfxEnabled && !isMuted ? 1 : 0.6 }}>
							{isAmbientSfxEnabled && !isMuted ? t('darkModeOn') : t('darkModeOff')}
						</span>
					</div>
				</div>
			)}
		</div>
	);
}
