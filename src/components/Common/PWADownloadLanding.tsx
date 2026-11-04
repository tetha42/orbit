'use client';

import React, { useState } from 'react';
import { LOCALE_REGISTRY, useI18n } from '@/core/i18n';
import { ALLOW_BROWSER_LOGIN, enableDevBypass, promptInstall, useJustInstalled } from '@/lib/client/pwa';
import { detectBrowser, detectPlatform, type Platform } from '@/lib/client/pwaDetect';
import {
	Download,
	Laptop,
	Smartphone,
	Monitor,
	ArrowRight,
	Share,
	PlusSquare,
	Globe,
	Check,
} from 'lucide-react';

const OS_NAMES: Record<Platform, string> = {
	macos: 'macOS',
	windows: 'Windows',
	linux: 'Linux',
	ios: 'iOS',
	android: 'Android',
};

function getInitialPlatform(): { platform: Platform; osName: string } {
	if (typeof window === 'undefined') return { platform: 'windows', osName: OS_NAMES.windows };
	const platform = detectPlatform(window.navigator.userAgent, window.navigator.maxTouchPoints);
	return { platform, osName: OS_NAMES[platform] };
}

type InstallBlocker = 'insecure' | 'inapp' | 'firefox-desktop';

/** Reasons the browser will never offer an install here, explained up front. */
function detectBlocker(platform: Platform): InstallBlocker | null {
	if (typeof window === 'undefined') return null;
	if (!window.isSecureContext) return 'insecure';
	const browser = detectBrowser(window.navigator.userAgent);
	if (browser === 'inapp') return 'inapp';
	if (browser === 'firefox' && platform !== 'android' && platform !== 'ios') return 'firefox-desktop';
	return null;
}

export function PWADownloadLanding() {
	const { language, setLanguage, t } = useI18n();
	const justInstalled = useJustInstalled();
	const [initialDetected] = useState(getInitialPlatform);
	const [activePlatform, setActivePlatform] = useState<Platform>(initialDetected.platform);
	const [detectedOS] = useState<string>(initialDetected.osName);
	const [blocker] = useState<InstallBlocker | null>(() => detectBlocker(initialDetected.platform));
	const [acceptedInstall, setAcceptedInstall] = useState(false);
	const [hint, setHint] = useState<string | null>(null);
	const isInstalled = acceptedInstall || justInstalled;

	const blockerMessage =
		blocker === 'insecure'
			? t(
					'pwaBlockerInsecure',
					'This address is not secure (HTTPS), and browsers do not allow installing apps from insecure pages. Open the portal over https:// or contact your administrator.'
				)
			: blocker === 'inapp'
				? t(
						'pwaBlockerInapp',
						'This is an embedded in-app browser, which cannot install web apps. Open the link in Chrome, Edge, or Safari.'
					)
				: blocker === 'firefox-desktop'
					? t(
							'pwaBlockerFirefoxDesktop',
							'Desktop Firefox does not support installing web apps. Open the portal in Chrome, Edge, or Brave.'
						)
					: null;

	const handleInstallClick = async () => {
		const outcome = await promptInstall();
		if (outcome === 'accepted') {
			setAcceptedInstall(true);
			setHint(null);
		} else if (outcome === 'unavailable') {
			setHint(
				t(
					'pwaInstallUnavailableHint',
					"The browser has not offered its install prompt yet. On {os}, use the 'Install' icon in the address bar or follow the steps below."
				).replace('{os}', detectedOS)
			);
		}
	};

	const platforms = [
		{ id: 'macos' as const, name: 'macOS', icon: <Laptop size={14} /> },
		{ id: 'windows' as const, name: 'Windows', icon: <Monitor size={14} /> },
		{ id: 'ios' as const, name: 'iOS', icon: <Smartphone size={14} /> },
		{ id: 'android' as const, name: 'Android', icon: <Smartphone size={14} /> },
		{ id: 'linux' as const, name: 'Linux', icon: <Laptop size={14} /> },
	];

	return (
		<div
			style={{
				position: 'fixed',
				inset: 0,
				zIndex: 10,
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'space-between',
				color: '#fafafa',
				fontFamily: 'var(--font-sans, Inter, system-ui, -apple-system, sans-serif)',
				overflowX: 'hidden',
				overflowY: 'auto',
				backgroundColor: '#09090b',
			}}
		>
			{/* Top Header Bar */}
			<header
				style={{
					position: 'relative',
					zIndex: 20,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					padding: '20px 32px',
					maxWidth: '1120px',
					width: '100%',
					margin: '0 auto',
					borderBottom: '1px solid #18181b',
				}}
			>
				{/* Brand */}
				<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img
						src="/assets/img/logo-girdap.svg"
						alt="Orbit Community OS"
						style={{
							width: '28px',
							height: '28px',
						}}
					/>
					<div style={{ display: 'flex', flexDirection: 'column' }}>
						<span
							style={{
								fontSize: '13px',
								fontWeight: 700,
								letterSpacing: '0.04em',
								lineHeight: 1.1,
								color: '#fafafa',
							}}
						>
							ORBIT COMMUNITY OS
						</span>
						<span
							style={{
								fontSize: '10px',
								color: '#a1a1aa',
								letterSpacing: '0.1em',
								fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
							}}
						>
							BY TETHA42
						</span>
					</div>
				</div>

				{/* Right Navigation & Language Switcher */}
				<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							backgroundColor: '#111113',
							borderRadius: '6px',
							padding: '2px',
							border: '1px solid #27272a',
						}}
					>
						{LOCALE_REGISTRY.map((loc) => {
							const active = language === loc.code;
							return (
								<button
									key={loc.code}
									type="button"
									onClick={() => setLanguage(loc.code as typeof language)}
									style={{
										padding: '4px 10px',
										borderRadius: '4px',
										border: 'none',
										backgroundColor: active ? '#fafafa' : 'transparent',
										color: active ? '#09090b' : '#a1a1aa',
										fontSize: '11px',
										fontWeight: 600,
										cursor: 'pointer',
									}}
								>
									{loc.code.toUpperCase()}
								</button>
							);
						})}
					</div>

					{ALLOW_BROWSER_LOGIN && (
						<button
							type="button"
							onClick={enableDevBypass}
							title={t('pwaDevBypassBtn')}
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: '6px',
								padding: '6px 12px',
								borderRadius: '6px',
								border: '1px solid #27272a',
								backgroundColor: '#18181b',
								color: '#fafafa',
								fontSize: '12px',
								fontWeight: 500,
								cursor: 'pointer',
							}}
						>
							<Globe size={13} />
							<span>{t('pwaDevBypassBtn')}</span>
						</button>
					)}
				</div>
			</header>

			{/* Main Center Stage: Flat Monochrome Structural Panel */}
			<main
				style={{
					position: 'relative',
					zIndex: 20,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					padding: '24px',
					maxWidth: '600px',
					width: '100%',
					margin: '0 auto',
				}}
			>
				<div
					style={{
						width: '100%',
						backgroundColor: '#111113',
						border: '1px solid #27272a',
						borderRadius: '8px',
						overflow: 'hidden',
						display: 'flex',
						flexDirection: 'column',
					}}
				>
					{/* Structural Monospace Header */}
					<div
						style={{
							padding: '12px 18px',
							borderBottom: '1px solid #27272a',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							backgroundColor: '#0c0c0e',
							fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
							fontSize: '11px',
							letterSpacing: '0.08em',
							color: '#a1a1aa',
							textTransform: 'uppercase',
						}}
					>
						<span>ORBIT // TETHA42</span>
						<span style={{ color: '#fafafa' }}>
							{t('pwaHeaderClientTag', '{os} CLIENT').replace('{os}', detectedOS)}
						</span>
					</div>

					{/* Content */}
					<div
						style={{
							padding: '32px 28px',
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							textAlign: 'center',
						}}
					>
						{/* Flat Structural Icon Container */}
						<div
							style={{
								width: '64px',
								height: '64px',
								borderRadius: '8px',
								backgroundColor: '#09090b',
								border: '1px solid #27272a',
								display: 'grid',
								placeItems: 'center',
								marginBottom: '20px',
							}}
						>
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img
								src="/assets/img/logo-girdap.svg"
								alt="Orbit Community OS"
								style={{ width: '36px', height: '36px' }}
							/>
						</div>

						<div
							style={{
								display: 'inline-block',
								padding: '4px 10px',
								borderRadius: '4px',
								backgroundColor: '#18181b',
								border: '1px solid #27272a',
								color: '#a1a1aa',
								fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
								fontSize: '11px',
								marginBottom: '14px',
							}}
						>
							{t('pwaStandaloneBadge', '{os} • STANDALONE PWA').replace('{os}', detectedOS)}
						</div>

						<h1
							style={{
								fontSize: '22px',
								fontWeight: 600,
								margin: '0 0 8px 0',
								letterSpacing: '-0.02em',
								color: '#fafafa',
							}}
						>
							Orbit Community OS
						</h1>

						<p
							style={{
								fontSize: '13.5px',
								lineHeight: 1.6,
								color: '#a1a1aa',
								maxWidth: '460px',
								margin: '0 0 24px 0',
							}}
						>
							{t(
								'pwaLandingDesc',
								'Install the Orbit workspace on your device for distraction-free window management, integrated shell terminal, instant QR check-in, and offline caching.'
							)}
						</p>

						{blockerMessage && (
							<div
								role="note"
								style={{
									width: '100%',
									maxWidth: '420px',
									marginBottom: '16px',
									padding: '12px 14px',
									borderRadius: '6px',
									backgroundColor: 'rgba(245, 158, 11, 0.08)',
									border: '1px solid rgba(245, 158, 11, 0.3)',
									color: '#fbbf24',
									fontSize: '12px',
									lineHeight: 1.5,
									textAlign: 'left',
								}}
							>
								{blockerMessage}
							</div>
						)}

						{/* Primary Flat Monochrome Action Button */}
						<button
							type="button"
							onClick={handleInstallClick}
							disabled={isInstalled}
							style={{
								width: '100%',
								maxWidth: '420px',
								padding: '12px 20px',
								borderRadius: '6px',
								backgroundColor: isInstalled ? '#18181b' : '#fafafa',
								border: isInstalled ? '1px solid #10b981' : '1px solid #fafafa',
								color: isInstalled ? '#34d399' : '#09090b',
								fontSize: '13.5px',
								fontWeight: 600,
								cursor: isInstalled ? 'default' : 'pointer',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								gap: '8px',
								marginBottom: hint ? '12px' : '24px',
							}}
						>
							{isInstalled ? <Check size={16} /> : <Download size={16} />}
							<span>
								{isInstalled
									? t('pwaInstalledBtn', 'Installed — Open App From Your Device')
									: t('pwaInstallBtn', 'Install Workspace App')}
							</span>
						</button>

						{hint && (
							<p
								role="status"
								style={{
									width: '100%',
									maxWidth: '420px',
									margin: '0 0 20px 0',
									fontSize: '12px',
									lineHeight: 1.5,
									color: '#a1a1aa',
								}}
							>
								{hint}
							</p>
						)}

						{/* Flat Segmented Platform Control */}
						<div
							style={{
								width: '100%',
								padding: '4px',
								backgroundColor: '#09090b',
								borderRadius: '6px',
								border: '1px solid #27272a',
								display: 'grid',
								gridTemplateColumns: 'repeat(5, 1fr)',
								gap: '4px',
								marginBottom: '14px',
							}}
						>
							{platforms.map((p) => {
								const active = activePlatform === p.id;
								return (
									<button
										type="button"
										key={p.id}
										onClick={() => setActivePlatform(p.id)}
										style={{
											padding: '7px 4px',
											borderRadius: '4px',
											border: active ? '1px solid #27272a' : '1px solid transparent',
											backgroundColor: active ? '#18181b' : 'transparent',
											color: active ? '#fafafa' : '#a1a1aa',
											fontSize: '11.5px',
											fontWeight: active ? 600 : 500,
											cursor: 'pointer',
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
											gap: '5px',
										}}
									>
										{p.icon}
										<span>{p.name}</span>
									</button>
								);
							})}
						</div>

						{/* Platform Specific 2-Step Guidance Box */}
						<div
							style={{
								width: '100%',
								padding: '14px 16px',
								borderRadius: '6px',
								backgroundColor: '#09090b',
								border: '1px solid #27272a',
								textAlign: 'left',
								fontSize: '12.5px',
								color: '#a1a1aa',
								lineHeight: 1.5,
								display: 'flex',
								flexDirection: 'column',
								gap: '8px',
							}}
						>
							{activePlatform === 'macos' && (
								<>
									<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
										<span style={{ color: '#fafafa', fontWeight: 700, fontFamily: 'monospace' }}>01</span>
										<span>
											{t('pwaMacStep1Prefix', 'In Chrome or Edge, click the')}{' '}
											<strong style={{ color: '#fafafa' }}>{t('pwaMacStep1Strong', 'Install')}</strong>{' '}
											{t('pwaMacStep1Suffix', 'icon in the address bar.')}
										</span>
									</div>
									<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
										<span style={{ color: '#fafafa', fontWeight: 700, fontFamily: 'monospace' }}>02</span>
										<span>
											{t('pwaMacStep2Prefix', 'In Safari, choose')}{' '}
											<strong style={{ color: '#fafafa' }}>{t('pwaMacStep2Strong', 'File → Add to Dock')}</strong>{' '}
											{t('pwaMacStep2Suffix', 'from the menu bar.')}
										</span>
									</div>
								</>
							)}

							{activePlatform === 'windows' && (
								<>
									<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
										<span style={{ color: '#fafafa', fontWeight: 700, fontFamily: 'monospace' }}>01</span>
										<span>
											{t('pwaWinStep1Prefix', 'In Edge or Chrome, click the')}{' '}
											<strong style={{ color: '#fafafa' }}>{t('pwaWinStep1Strong', 'Install App')}</strong>{' '}
											{t('pwaWinStep1Suffix', 'button in the address bar.')}
										</span>
									</div>
									<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
										<span style={{ color: '#fafafa', fontWeight: 700, fontFamily: 'monospace' }}>02</span>
										<span>
											{t('pwaWinStep2', 'The app is pinned directly to your Start Menu and Taskbar.')}
										</span>
									</div>
								</>
							)}

							{activePlatform === 'ios' && (
								<>
									<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
										<span style={{ color: '#fafafa', fontWeight: 700, fontFamily: 'monospace' }}>01</span>
										<Share size={13} style={{ color: '#fafafa' }} />
										<span>
											{t('pwaIosStep1Prefix', 'Tap the')}{' '}
											<strong style={{ color: '#fafafa' }}>{t('pwaIosStep1Strong', 'Share')}</strong>{' '}
											{t('pwaIosStep1Suffix', 'icon at the bottom of Safari.')}
										</span>
									</div>
									<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
										<span style={{ color: '#fafafa', fontWeight: 700, fontFamily: 'monospace' }}>02</span>
										<PlusSquare size={13} style={{ color: '#fafafa' }} />
										<span>
											{t('pwaIosStep2Prefix', 'Select')}{' '}
											<strong style={{ color: '#fafafa' }}>{t('pwaIosStep2Strong', 'Add to Home Screen')}</strong>{' '}
											{t('pwaIosStep2Suffix', 'from the menu.')}
										</span>
									</div>
								</>
							)}

							{activePlatform === 'android' && (
								<>
									<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
										<span style={{ color: '#fafafa', fontWeight: 700, fontFamily: 'monospace' }}>01</span>
										<span>
											{t('pwaAndroidStep1', 'Tap the three-dot menu in Chrome.')}
										</span>
									</div>
									<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
										<span style={{ color: '#fafafa', fontWeight: 700, fontFamily: 'monospace' }}>02</span>
										<span>
											<strong style={{ color: '#fafafa' }}>{t('pwaAndroidStep2Strong', 'Install App')}</strong>{' '}
											{t('pwaAndroidStep2Suffix', 'to add it to your home launcher.')}
										</span>
									</div>
								</>
							)}

							{activePlatform === 'linux' && (
								<>
									<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
										<span style={{ color: '#fafafa', fontWeight: 700, fontFamily: 'monospace' }}>01</span>
										<span>
											{t('pwaLinuxStep1Prefix', 'In Chromium, Brave, or Chrome, click the')}{' '}
											<strong style={{ color: '#fafafa' }}>{t('pwaLinuxStep1Strong', 'Install')}</strong>{' '}
											{t('pwaLinuxStep1Suffix', 'icon in the omnibox.')}
										</span>
									</div>
									<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
										<span style={{ color: '#fafafa', fontWeight: 700, fontFamily: 'monospace' }}>02</span>
										<span>
											{t('pwaLinuxStep2', 'Integrated as a native desktop (.desktop) window launcher.')}
										</span>
									</div>
								</>
							)}
						</div>
					</div>

					{/* Development only: continue without installing. */}
					{ALLOW_BROWSER_LOGIN && (
						<div
							style={{
								padding: '12px 20px',
								borderTop: '1px solid #27272a',
								backgroundColor: '#0c0c0e',
								display: 'flex',
								justifyContent: 'center',
								alignItems: 'center',
							}}
						>
							<button
								type="button"
								onClick={enableDevBypass}
								style={{
									background: 'transparent',
									border: 'none',
									color: '#a1a1aa',
									fontSize: '12px',
									cursor: 'pointer',
									display: 'inline-flex',
									alignItems: 'center',
									gap: '6px',
								}}
							>
								<span>
									{t(
										'pwaContinueInBrowserDev',
										'Continue in browser without installing (developer mode)'
									)}
								</span>
								<ArrowRight size={13} />
							</button>
						</div>
					)}
				</div>
			</main>

			{/* Minimalist Bottom Footer */}
			<footer
				style={{
					position: 'relative',
					zIndex: 20,
					padding: '20px 24px',
					textAlign: 'center',
					fontSize: '11px',
					color: '#71717a',
					fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
					letterSpacing: '0.04em',
				}}
			>
				<span>ORBIT COMMUNITY OS // TETHA42 • WEB STANDARDS PWA</span>
			</footer>
		</div>
	);
}
