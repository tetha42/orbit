'use client';

import { useI18n } from '@/core/i18n';
import { useIdentity } from '@/core/identity';
import { useShell } from '@/core/shell';
import { X, ShieldCheck } from 'lucide-react';

export function AboutPortalModal() {
	const { t, language } = useI18n();
	const { identity } = useIdentity();
	const { isAboutModalOpen, setIsAboutModalOpen } = useShell();

	if (!isAboutModalOpen) return null;

	return (
		<div
			data-about-modal=""
			onClick={() => setIsAboutModalOpen(false)}
			style={{
				position: 'fixed',
				inset: 0,
				background: 'var(--scrim)',
				backdropFilter: 'var(--glass-blur-scrim)',
				display: 'grid',
				placeItems: 'center',
				zIndex: 999999,
			}}
		>
			<div
				onClick={(e) => e.stopPropagation()}
				style={{
					width: '420px',
					background: 'var(--modal-bg, #ffffff)',
					backdropFilter: 'var(--glass-blur-strong)',
					border: '1px solid var(--window-border)',
					borderRadius: '16px',
					boxShadow: 'var(--shadow-panel)',
					padding: '28px',
					position: 'relative',
					color: 'var(--text-primary)',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					textAlign: 'center',
				}}
			>
				{/* Close button */}
				<button
					onClick={() => setIsAboutModalOpen(false)}
					style={{
						position: 'absolute',
						top: '14px',
						left: '14px',
						width: '16px',
						height: '16px',
						borderRadius: '50%',
						background: '#ff5f56',
						border: '0.5px solid #e0443e',
						display: 'grid',
						placeItems: 'center',
						cursor: 'pointer',
						boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
					}}
				>
					<X size={10} color="#4d0000" strokeWidth={3} />
				</button>

				{/* Portal Emblem (No emoji, sleek modern badge) */}
				<div
					style={{
						width: '68px',
						height: '68px',
						borderRadius: '18px',
						background: 'linear-gradient(135deg, #007aff, #5856d6)',
						display: 'grid',
						placeItems: 'center',
						color: '#fff',
						boxShadow: '0 10px 24px rgba(0, 122, 255, 0.4)',
						marginBottom: '16px',
						overflow: 'hidden',
					}}
				>
					{identity.iconUrl ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							src={identity.iconUrl}
							alt={identity.siteName}
							style={{ width: '100%', height: '100%', objectFit: 'cover' }}
						/>
					) : (
						<ShieldCheck size={36} strokeWidth={2} />
					)}
				</div>

				<h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 2px 0' }}>
					{identity.siteName}
				</h2>
				<span style={{ fontSize: '12px', opacity: 0.65, marginBottom: '4px' }}>
					{identity.appName} · {identity.studio}
				</span>
				<span style={{ fontSize: '11.5px', opacity: 0.55, marginBottom: '16px', textAlign: 'center', maxWidth: '330px' }}>
					{language === 'tr' ? identity.descriptionTr : identity.descriptionEn}
				</span>

				{/* Specs list */}
				<div
					style={{
						width: '100%',
						background: 'var(--fill-softer)',
						borderRadius: '10px',
						padding: '12px 14px',
						fontSize: '12px',
						display: 'flex',
						flexDirection: 'column',
						gap: '8px',
						textAlign: 'left',
						marginBottom: '18px',
					}}
				>
					<div style={{ display: 'flex', justifyContent: 'space-between' }}>
						<span style={{ fontWeight: 600 }}>{t('aboutArch')}</span>
						<span style={{ opacity: 0.8 }}>Next.js 16 • React 19 • PostgreSQL</span>
					</div>
					<div style={{ display: 'flex', justifyContent: 'space-between' }}>
						<span style={{ fontWeight: 600 }}>{t('aboutPurpose')}</span>
						<span style={{ opacity: 0.8 }}>{t('aboutPurposeValue')}</span>
					</div>
					<div style={{ display: 'flex', justifyContent: 'space-between' }}>
						<span style={{ fontWeight: 600 }}>{t('aboutModules')}</span>
						<span style={{ opacity: 0.8 }}>{t('aboutModulesValue')}</span>
					</div>
					<div style={{ display: 'flex', justifyContent: 'space-between' }}>
						<span style={{ fontWeight: 600 }}>{t('aboutDbStatus')}</span>
						<span style={{ color: 'var(--success)', fontWeight: 600 }}>{t('aboutDbConnected')}</span>
					</div>
				</div>

				<button
					onClick={() => setIsAboutModalOpen(false)}
					style={{
						padding: '7px 24px',
						borderRadius: '8px',
						background: 'var(--accent-blue)',
						color: '#fff',
						fontSize: '13px',
						fontWeight: 600,
						cursor: 'pointer',
					}}
				>
					{t('ok')}
				</button>
			</div>
		</div>
	);
}
