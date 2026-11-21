'use client';

import { useState, useEffect, useLayoutEffect } from 'react';
import { useSession } from '@/core/session';
import { useSound } from '@/core/sound';
import { useI18n } from '@/core/i18n';
import { APPS_CONFIG } from '@/configs/apps.config';
import type { AppID, FocusTargetInput } from '@/types/workspace';
import { OnboardingTeamExplorer } from '@/components/shell/Desktop/OnboardingTeamExplorer';
import { useWindowActions, useWindowStore } from '@/core/windows';
import { prefetchApp } from '@/core/apps/registry';
import { ActiveMobileAppView } from './ActiveMobileAppView';
import { MobileBottomNav, MOBILE_NAV_HEIGHT, type MobileTab } from './MobileBottomNav';
import { MobileProfile } from './MobileProfile';
import { MobileHomeTab } from './MobileHomeTab';
import { MobileAppsGrid } from './MobileAppsGrid';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function MobileLauncher() {
	const { canUseApp, canManageApp, currentUser } = useSession();
	const { t } = useI18n();
	const { playSystemSound } = useSound();
	const windowStore = useWindowStore();
	const { openApp: windowOpenApp, closeApp: windowCloseApp } = useWindowActions();
	const [selectedMobileApp, setActiveMobileApp] = useState<AppID | null>(() => {
		const targetApp = windowStore.getState().focusTarget?.appId;
		return targetApp && canUseApp(targetApp) ? targetApp : null;
	});
	const [tab, setTab] = useState<MobileTab>('home');
	const [smtpMissing, setSmtpMissing] = useState(false);

	useIsomorphicLayoutEffect(() => {
		const handleOpenMobileApp = (e: Event) => {
			const customEvent = e as CustomEvent<{ appId: AppID; target?: FocusTargetInput }>;
			if (customEvent.detail?.appId) {
				setActiveMobileApp(customEvent.detail.appId);
			}
		};
		window.addEventListener('clubpanel:open-mobile-app', handleOpenMobileApp);
		return () => window.removeEventListener('clubpanel:open-mobile-app', handleOpenMobileApp);
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

	const appKeys = (Object.keys(APPS_CONFIG) as AppID[]).filter((appId) => canUseApp(appId));
	const activeMobileApp = selectedMobileApp && canUseApp(selectedMobileApp) ? selectedMobileApp : null;

	if (activeMobileApp) {
		return (
			<ActiveMobileAppView
				activeMobileApp={activeMobileApp}
				onClose={() => {
					playSystemSound();
					if (activeMobileApp) windowCloseApp(activeMobileApp);
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
				<MobileHomeTab currentUser={currentUser} smtpMissing={smtpMissing} onOpenApp={openApp} />
			)}

			{tab === 'apps' && <MobileAppsGrid appKeys={appKeys} onOpenApp={openApp} />}

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
