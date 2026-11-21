'use client';

import React from 'react';
import { Check, Download } from 'lucide-react';
import { useI18n } from '@/core/i18n';

interface PwaInstallCardProps {
	detectedOS: string;
	blockerMessage: string | null;
	isInstalled: boolean;
	hint: string | null;
	onInstallClick: () => void;
}

export function PwaInstallCard({
	detectedOS,
	blockerMessage,
	isInstalled,
	hint,
	onInstallClick,
}: PwaInstallCardProps) {
	const { t } = useI18n();

	return (
		<>
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
					src="/assets/img/logo-orbit.svg"
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
					fontFamily: 'var(--font-mono)',
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
						backgroundColor: 'color-mix(in srgb, var(--warning) 8%, transparent)',
						border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
						color: 'var(--warning)',
						fontSize: '12px',
						lineHeight: 1.5,
						textAlign: 'left',
					}}
				>
					{blockerMessage}
				</div>
			)}

			<button
				type="button"
				onClick={onInstallClick}
				disabled={isInstalled}
				style={{
					width: '100%',
					maxWidth: '420px',
					padding: '12px 20px',
					borderRadius: '6px',
					backgroundColor: isInstalled ? '#18181b' : '#fafafa',
					border: isInstalled ? '1px solid var(--success)' : '1px solid #fafafa',
					color: isInstalled ? 'var(--success)' : '#09090b',
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
		</>
	);
}
