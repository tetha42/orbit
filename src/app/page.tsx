'use client';

import React from 'react';
import { useSession } from '@/core/session';
import { useShellState } from '@/core/shell';
import { useHasWindow } from '@/core/windows';
import { Desktop } from '@/components/shell/Desktop/Desktop';
import { MobileLauncher } from '@/components/shell/MobileLauncher/MobileLauncher';
import { AuthPortal } from '@/components/Auth/AuthPortal';
import { TwoFactorEnforcementModal } from '@/components/Admin/TwoFactorEnforcementModal';
import { LockScreen } from '@/components/shell/Desktop/LockScreen';
import { DefconLockdownOverlay } from '@/components/shell/Desktop/DefconLockdownOverlay';
import { useIsMounted } from '@/lib/client/useClientValue';
import { usePwaGate } from '@/lib/client/pwa';
import { AmbientSoundPlayer } from '@/components/Common/AmbientSoundPlayer';
import { PWADownloadLanding } from '@/components/Common/PWADownloadLanding';
import { isAuroraWallpaper } from '@/core/theme';
import { DevToolsGuard } from '@/components/Common/DevToolsGuard';
import dynamic from 'next/dynamic';

const Background3D = dynamic(
	() => import('@/components/Common/Background3D').then((mod) => mod.Background3D),
	{ ssr: false }
);

export default function Home() {
	const { isAuthenticated, isAuthLoading, isLocked } = useSession();
	const { activeWallpaper } = useShellState();
	const hasMaximizedWindow = useHasWindow((w) => w.isOpen && !w.isMinimized && w.isMaximized);
	const hasMounted = useIsMounted();

	const [isMobile, setIsMobile] = React.useState<boolean>(() => {
		if (typeof window !== 'undefined') return window.innerWidth < 768;
		return false;
	});

	React.useEffect(() => {
		const onResize = () => setIsMobile(window.innerWidth < 768);
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);

	const [isSetupPending, setIsSetupPending] = React.useState<boolean | null>(null);

	React.useEffect(() => {
		fetch('/api/setup', { cache: 'no-store' })
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (data && data.hazir === false) {
					setIsSetupPending(true);
				} else {
					setIsSetupPending(false);
				}
			})
			.catch(() => setIsSetupPending(false));
	}, []);

	// Outside development the portal only runs as an installed app; a browser tab
	// gets the download page. The display mode is not known during server rendering
	// or the hydration pass, so the first decision is 'checking' — a neutral splash.
	// When setup is pending (hazir === false), the PWA wall is bypassed so the admin
	// can complete zero-touch setup directly in any desktop/mobile browser.
	const gate = usePwaGate({ allowSetup: isSetupPending === true });

	if (gate === 'checking' || isSetupPending === null) {
		return (
			<div className="boot-splash" aria-hidden="true">
				<span className="boot-splash__spinner" />
			</div>
		);
	}

	if (gate === 'wall' && !isSetupPending) {
		return (
			<>
				<PWADownloadLanding />
				<DevToolsGuard />
			</>
		);
	}

	// The 3D scene backs the login portal always on desktop, and the desktop whenever the
	// member has it selected as their wallpaper. NEVER loaded on mobile devices (<768px).
	const is3DActive = isAuroraWallpaper(activeWallpaper);
	const show3DBackground = !isMobile && (!isAuthenticated || is3DActive);

	return (
		<>
			{hasMounted && !isMobile && (
				<Background3D
					mode={
						!show3DBackground || (isAuthenticated && hasMaximizedWindow)
							? 'off'
							: isAuthenticated && isLocked
								? 'freeze'
								: 'run'
					}
				/>
			)}

			{/* Hold the login form back until the session probe resolves, otherwise a
			    signed-in member sees the login screen flash on every page load. */}
			{isAuthLoading ? (
				<div className="boot-splash" aria-hidden="true">
					<span className="boot-splash__spinner" />
				</div>
			) : !isAuthenticated ? (
				<AuthPortal />
			) : isMobile ? (
				<>
					<MobileLauncher />
					<TwoFactorEnforcementModal />
					{isLocked && <LockScreen />}
				</>
			) : (
				<>
					<Desktop />
					<TwoFactorEnforcementModal />
					{/* Mounted at the app level so it also covers the mobile launcher.
					    Rendered only while locked, so the password field starts empty on
					    every lock without an effect resetting it. */}
					{isLocked && <LockScreen />}
				</>
			)}
			{/* Authentic 3D Landing Ambient SFX: strictly restricted to desktop to conserve mobile battery/CPU */}
			{!isMobile && <AmbientSoundPlayer showButton={true} />}
			<DefconLockdownOverlay />
			<DevToolsGuard />
		</>
	);
}
