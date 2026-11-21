'use client';

import React from 'react';
import { Laptop, Monitor, PlusSquare, Share, Smartphone } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { Platform } from '@/lib/client/pwaDetect';

interface PwaPlatformGuideProps {
	activePlatform: Platform;
	onSelectPlatform: (platform: Platform) => void;
}

const PLATFORMS: { id: Platform; name: string; icon: React.ReactNode }[] = [
	{ id: 'macos', name: 'macOS', icon: <Laptop size={14} /> },
	{ id: 'windows', name: 'Windows', icon: <Monitor size={14} /> },
	{ id: 'ios', name: 'iOS', icon: <Smartphone size={14} /> },
	{ id: 'android', name: 'Android', icon: <Smartphone size={14} /> },
	{ id: 'linux', name: 'Linux', icon: <Laptop size={14} /> },
];

export function PwaPlatformGuide({ activePlatform, onSelectPlatform }: PwaPlatformGuideProps) {
	const { t } = useI18n();

	return (
		<>
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
				{PLATFORMS.map((p) => {
					const active = activePlatform === p.id;
					return (
						<button
							type="button"
							key={p.id}
							onClick={() => onSelectPlatform(p.id)}
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
							<span>{t('pwaWinStep2', 'The app is pinned directly to your Start Menu and Taskbar.')}</span>
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
							<span>{t('pwaAndroidStep1', 'Tap the three-dot menu in Chrome.')}</span>
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
							<span>{t('pwaLinuxStep2', 'Integrated AS a native desktop (.desktop) window launcher.')}</span>
						</div>
					</>
				)}
			</div>
		</>
	);
}
