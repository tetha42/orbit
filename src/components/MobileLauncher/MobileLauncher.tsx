'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@/core/session';
import { useSound } from '@/core/sound';
import { useI18n } from '@/core/i18n';
import { APPS_CONFIG } from '@/configs/apps.config';
import { AppID } from '@/types/workspace';
import { ModernAppIcon } from '@/components/Common/ModernAppIcon';
import { ActiveMobileAppView } from './ActiveMobileAppView';
import { RoleBadge, roleGradient } from '@/core/ui/RoleBadge';
import { OnboardingTeamExplorer } from '@/components/Desktop/OnboardingTeamExplorer';
import { MobileBottomNav, MOBILE_NAV_HEIGHT, type MobileTab } from './MobileBottomNav';
import { MobileDashboard } from './MobileDashboard';
import { MobileProfile } from './MobileProfile';
import { useWindowActions } from '@/core/windows';
import { prefetchApp } from '@/core/apps/registry';
import type { FocusTargetInput } from '@/types/workspace';
import { AlertTriangle } from 'lucide-react';

export function MobileLauncher() {
	const { canUseApp, canManageApp, currentUser } = useSession();
	const { t } = useI18n();
	const { playSystemSound } = useSound();
	const { openApp: windowOpenApp } = useWindowActions();
	const [selectedMobileApp, setActiveMobileApp] = useState<AppID | null>(null);
	const [tab, setTab] = useState<MobileTab>('home');
	const [smtpMissing, setSmtpMissing] = useState(false);

	useEffect(() => {
		const handleOpenMobileApp = (e: Event) => {
			const customEvent = e as CustomEvent<{ appId: AppID; target?: FocusTargetInput }>;
			if (customEvent.detail?.appId) {
				setActiveMobileApp(customEvent.detail.appId);
			}
		};
		window.addEventListener('clubpanel:open-mobile-app', handleOpenMobileApp);
		return () => {
			window.removeEventListener('clubpanel:open-mobile-app', handleOpenMobileApp);
		};
	}, []);

	useEffect(() => {
		if (!currentUser || !canManageApp('settings')) return;
		let active = true;
		fetch('/api/settings/smtp')
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (active && data && !data.emailReady && !data.configured) {
					setSmtpMissing(true);
				}
			})
			.catch(() => {});
		return () => {
			active = false;
		};
	}, [currentUser, canManageApp]);

	useEffect(() => {
		// Idle prewarm top apps when mobile launcher mounts
		const prewarm = () => {
			const topApps: AppID[] = ['events', 'teams', 'members', 'chat'];
			for (const appId of topApps) {
				if (canUseApp(appId)) {
					prefetchApp(appId);
				}
			}
		};
		if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
			const handle = (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(prewarm);
			return () => (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(handle);
		} else {
			const timer = setTimeout(prewarm, 1200);
			return () => clearTimeout(timer);
		}
	}, [canUseApp]);

	// Only the apps the role opens; an open app whose permission was taken away closes.
	const appKeys = (Object.keys(APPS_CONFIG) as AppID[]).filter((appId) => canUseApp(appId));
	const activeMobileApp = selectedMobileApp && canUseApp(selectedMobileApp) ? selectedMobileApp : null;

	if (activeMobileApp) {
		return (
			<ActiveMobileAppView
				activeMobileApp={activeMobileApp}
				onClose={() => {
					playSystemSound();
					setActiveMobileApp(null);
				}}
			/>
		);
	}

	const openApp = (appId: AppID) => {
		playSystemSound();
		windowOpenApp(appId);
		setActiveMobileApp(appId);
	};

	// The phone launcher: cockpit, app grid, teams and profile behind a thumb bar.
	return (
		<div
			style={{
				position: 'relative',
				zIndex: 1,
				height: '100dvh',
				maxHeight: '100dvh',
				background: 'radial-gradient(ellipse at top, #1c1c1e 0%, #0a0a0c 100%)',
				color: '#ffffff',
				fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif',
				// Room for the fixed bottom bar, above the device's home indicator.
				padding: `24px 18px calc(${MOBILE_NAV_HEIGHT + 24}px + env(safe-area-inset-bottom)) 18px`,
				display: 'flex',
				flexDirection: 'column',
				gap: '20px',
				overflowY: 'auto',
				WebkitOverflowScrolling: 'touch',
				touchAction: 'pan-y',
				overscrollBehaviorY: 'contain',
			}}
		>
			{tab === 'home' && (
				<>
					{/* Top Branding & Profile Bar */}
					<div
						style={{
							background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02))',
							border: '1px solid rgba(255, 255, 255, 0.12)',
							borderRadius: '18px',
							padding: '16px',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							gap: '10px',
						}}
					>
						<div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
							<div
								style={{
									width: '44px',
									height: '44px',
									borderRadius: '50%',
									background: roleGradient(currentUser?.rolBilgi?.renk),
									display: 'grid',
									placeItems: 'center',
									fontWeight: 700,
									fontSize: '15px',
									flexShrink: 0,
								}}
							>
								{currentUser ? `${currentUser.ad[0] ?? ''}${currentUser.soyad[0] ?? ''}` : ''}
							</div>
							<div style={{ minWidth: 0 }}>
								<div style={{ fontSize: '15px', fontWeight: 700 }}>
									{currentUser ? `${currentUser.ad} ${currentUser.soyad}` : ''}
								</div>
								<div style={{ fontSize: '11.5px', opacity: 0.7 }}>
									{currentUser ? `${currentUser.bolum} • ${currentUser.xp || 0} XP` : ''}
								</div>
							</div>
						</div>

						<RoleBadge role={currentUser?.rolBilgi} bosMetin={t('roleNone')} />
					</div>

					{smtpMissing && (
						<div
							onClick={() => openApp('settings')}
							style={{
								background: 'linear-gradient(135deg, rgba(255, 189, 46, 0.15), rgba(255, 149, 0, 0.08))',
								border: '1px solid rgba(255, 189, 46, 0.35)',
								borderRadius: '14px',
								padding: '12px 14px',
								display: 'flex',
								alignItems: 'center',
								gap: '10px',
								cursor: 'pointer',
							}}
						>
							<AlertTriangle size={20} color="#ffbd2e" style={{ flexShrink: 0 }} />
							<div style={{ flex: 1, minWidth: 0 }}>
								<div style={{ fontWeight: 700, fontSize: '13px', color: '#ffbd2e' }}>SMTP Kurulumu Gerekli</div>
								<div style={{ fontSize: '11px', opacity: 0.8, color: '#fff' }}>E-posta ayarları henüz yapılmadı. Dokunarak yapılandırın.</div>
							</div>
						</div>
					)}

					<MobileDashboard onOpenApp={openApp} />
				</>
			)}

			{tab === 'apps' && (
				<>
					{/* Center Title */}
					<div style={{ textAlign: 'center' }}>
						<h1 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 4px 0', letterSpacing: '-0.3px' }}>
							Orbit Community OS
						</h1>
						<p style={{ margin: 0, fontSize: '12.5px', opacity: 0.65 }}>{t('mobAppsHint')}</p>
					</div>

					{/* Center Square Tile Grid (Launchpad style) */}
					<div
						style={{
							display: 'grid',
							gridTemplateColumns: 'repeat(auto-fill, minmax(136px, 1fr))',
							gap: '12px',
						}}
					>
						{appKeys.map((appId) => {
							const meta = APPS_CONFIG[appId];

							return (
								<button
									key={appId}
									data-launcher-app={appId}
									onClick={() => openApp(appId)}
									onTouchStart={() => prefetchApp(appId)}
									onPointerEnter={() => prefetchApp(appId)}
									style={{
										background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03))',
										border: '1px solid rgba(255, 255, 255, 0.1)',
										borderRadius: '20px',
										padding: '20px 14px',
										display: 'flex',
										flexDirection: 'column',
										alignItems: 'center',
										justifyContent: 'center',
										gap: '12px',
										color: '#fff',
										cursor: 'pointer',
										boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
										position: 'relative',
										textAlign: 'center',
										touchAction: 'manipulation',
										WebkitTapHighlightColor: 'transparent',
										transition: 'transform 100ms ease, background 120ms ease',
									}}
								>
									{/* Icon Box */}
									<div
										style={{
											width: '56px',
											height: '56px',
											position: 'relative',
											display: 'grid',
											placeItems: 'center',
										}}
									>
										<ModernAppIcon appId={appId} size={56} />
									</div>

									{/* Label */}
									<div>
										<div style={{ fontSize: '14px', fontWeight: 700 }}>
											{meta.shortTitle}
										</div>
										{meta.badge && (
											<div
												style={{
													fontSize: '10px',
													opacity: 0.7,
													marginTop: '2px',
													color: meta.accentColor,
													fontWeight: 600,
												}}
											>
												{meta.badge}
											</div>
										)}
									</div>
								</button>
							);
						})}
					</div>
				</>
			)}

			{tab === 'teams' && (
				<>
					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
						<h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>{t('mobTabTeams')}</h2>
						{canUseApp('teams') && (
							<button
								type="button"
								data-mobile-action="open-teams"
								onClick={() => openApp('teams')}
								style={{
									minHeight: '40px',
									padding: '0 14px',
									borderRadius: '12px',
									border: '1px solid rgba(255, 255, 255, 0.14)',
									background: 'rgba(255, 255, 255, 0.07)',
									color: '#fff',
									fontSize: '12.5px',
									fontWeight: 600,
									cursor: 'pointer',
								}}
							>
								{t('mobOpenTeamsApp')}
							</button>
						)}
					</div>
					{/* The explorer is themed for windows, so it sits on a window-coloured card. */}
					<div
						style={{
							background: 'var(--window-bg)',
							color: 'var(--text-primary)',
							borderRadius: '18px',
							padding: '16px',
							border: '1px solid var(--window-border)',
						}}
					>
						<OnboardingTeamExplorer compact />
					</div>
				</>
			)}

			{tab === 'profile' && <MobileProfile onOpenApp={openApp} />}

			<MobileBottomNav
				tab={tab}
				onChange={(next) => {
					playSystemSound();
					setTab(next);
				}}
			/>
		</div>
	);
}
