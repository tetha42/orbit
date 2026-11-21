'use client';

import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { ALLOW_BROWSER_LOGIN, enableDevBypass, promptInstall, useJustInstalled } from '@/lib/client/pwa';
import type { Platform } from '@/lib/client/pwaDetect';
import { PwaLandingHeader } from './pwaLanding/PwaLandingHeader';
import { PwaInstallCard } from './pwaLanding/PwaInstallCard';
import { PwaPlatformGuide } from './pwaLanding/PwaPlatformGuide';
import { detectBlocker, getBlockerMessage, getInitialPlatform, type InstallBlocker } from './pwaLanding/pwaPlatforms';

export function PWADownloadLanding() {
	const { t } = useI18n();
	const justInstalled = useJustInstalled();
	const [initialDetected] = useState(getInitialPlatform);
	const [activePlatform, setActivePlatform] = useState<Platform>(initialDetected.platform);
	const [detectedOS] = useState<string>(initialDetected.osName);
	const [blocker] = useState<InstallBlocker | null>(() => detectBlocker(initialDetected.platform));
	const [acceptedInstall, setAcceptedInstall] = useState(false);
	const [hint, setHint] = useState<string | null>(null);
	const isInstalled = acceptedInstall || justInstalled;
	const blockerMessage = getBlockerMessage(blocker, t);

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
				fontFamily: 'var(--font-sans)',
				overflowX: 'hidden',
				overflowY: 'auto',
				backgroundColor: '#09090b',
			}}
		>
			<PwaLandingHeader />

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
					<div
						style={{
							padding: '12px 18px',
							borderBottom: '1px solid #27272a',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							backgroundColor: '#0c0c0e',
							fontFamily: 'var(--font-mono)',
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

					<div
						style={{
							padding: '32px 28px',
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							textAlign: 'center',
						}}
					>
						<PwaInstallCard
							detectedOS={detectedOS}
							blockerMessage={blockerMessage}
							isInstalled={isInstalled}
							hint={hint}
							onInstallClick={handleInstallClick}
						/>
						<PwaPlatformGuide activePlatform={activePlatform} onSelectPlatform={setActivePlatform} />
					</div>

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

			<footer
				style={{
					position: 'relative',
					zIndex: 20,
					padding: '20px 24px',
					textAlign: 'center',
					fontSize: '11px',
					color: '#71717a',
					fontFamily: 'var(--font-mono)',
					letterSpacing: '0.04em',
				}}
			>
				<span>ORBIT COMMUNITY OS // TETHA42 • WEB STANDARDS PWA</span>
			</footer>
		</div>
	);
}
