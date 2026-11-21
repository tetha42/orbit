'use client';

import React, { useState } from 'react';
import { useSession } from '@/core/session';
import { useI18n } from '@/core/i18n';
import { ShieldAlert, RefreshCw, Lock } from 'lucide-react';

export function DefconLockdownOverlay() {
	const { isLockdownActive, lockdownMessage, isAdmin, refreshSession } = useSession();
	const { t } = useI18n();
	const [checking, setChecking] = useState<boolean>(false);

	// Admins are exempt from the lockdown overlay so they can access the SoC and remediate.
	if (!isLockdownActive || isAdmin) {
		return null;
	}

	const handleRefresh = async () => {
		setChecking(true);
		try {
			await refreshSession();
		} finally {
			setTimeout(() => setChecking(false), 800);
		}
	};

	return (
		<div
			role="alertdialog"
			aria-modal="true"
			aria-labelledby="lockdown-title"
			style={{
				position: 'fixed',
				inset: 0,
				zIndex: 9999999,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				background: 'color-mix(in srgb, var(--ink-bg) 88%, transparent)',
				backdropFilter: 'blur(24px)',
				padding: '24px',
				fontFamily: 'var(--system-font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
				userSelect: 'none',
			}}
		>
			<div
				style={{
					maxWidth: '520px',
					width: '100%',
					background: 'var(--card-bg, color-mix(in srgb, var(--ink-card) 95%, transparent))',
					border: '1px solid color-mix(in srgb, var(--danger) 45%, transparent)',
					boxShadow: '0 25px 50px -12px color-mix(in srgb, var(--danger) 25%, transparent), 0 0 40px color-mix(in srgb, var(--danger) 15%, transparent)',
					borderRadius: '16px',
					padding: '32px 28px',
					color: 'var(--text-primary)',
					textAlign: 'center',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					gap: '20px',
				}}
			>
				{/* Pulsing Shield Icon Container */}
				<div
					style={{
						width: '72px',
						height: '72px',
						borderRadius: '50%',
						background: 'color-mix(in srgb, var(--danger) 15%, transparent)',
						border: '2px solid color-mix(in srgb, var(--danger) 50%, transparent)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						color: 'var(--danger)',
						boxShadow: '0 0 24px color-mix(in srgb, var(--danger) 40%, transparent)',
					}}
				>
					<ShieldAlert size={38} strokeWidth={2.2} />
				</div>

				{/* Title & Status */}
				<div>
					<div
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '6px',
							background: 'color-mix(in srgb, var(--danger) 20%, transparent)',
							color: 'var(--danger)',
							padding: '3px 12px',
							borderRadius: '999px',
							fontSize: '11px',
							fontWeight: 700,
							letterSpacing: '0.08em',
							textTransform: 'uppercase',
							marginBottom: '8px',
						}}
					>
						<Lock size={12} />
						{t('socDefconLockdownBadge')}
					</div>
					<h2
						id="lockdown-title"
						style={{
							margin: 0,
							fontSize: '22px',
							fontWeight: 750,
							letterSpacing: '-0.02em',
							color: 'var(--text-primary)',
						}}
					>
						{t('socDefconLockdownTitle')}
					</h2>
				</div>

				{/* Description */}
				<p
					style={{
						margin: 0,
						fontSize: '14px',
						lineHeight: '1.6',
						color: 'var(--text-secondary))',
					}}
				>
					{lockdownMessage || t('socDefconLockdownBody')}
				</p>

				{/* Bullet Status Box */}
				<div
					style={{
						width: '100%',
						background: 'var(--fill-soft, rgba(255, 255, 255, 0.04))',
						border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
						borderRadius: '10px',
						padding: '14px 16px',
						textAlign: 'left',
						fontSize: '12.5px',
						lineHeight: '1.5',
						color: 'var(--text-secondary))',
						display: 'flex',
						flexDirection: 'column',
						gap: '6px',
					}}
				>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						<span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>•</span>
						<span>{t('socDefconLockdownApiLocked')}</span>
					</div>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						<span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>•</span>
						<span>{t('socDefconLockdownSessionsEnded')}</span>
					</div>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						<span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>•</span>
						<span>{t('socDefconLockdownSocReview')}</span>
					</div>
				</div>

				{/* Action Button */}
				<button
					type="button"
					onClick={handleRefresh}
					disabled={checking}
					style={{
						width: '100%',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						gap: '8px',
						padding: '10px 18px',
						borderRadius: '10px',
						background: 'var(--card-bg, rgba(255, 255, 255, 0.08))',
						border: '1px solid var(--card-border, rgba(255, 255, 255, 0.16))',
						color: 'var(--text-primary)',
						fontSize: '14px',
						fontWeight: 600,
						cursor: checking ? 'not-allowed' : 'pointer',
						opacity: checking ? 0.7 : 1,
						transition: 'all 0.2s ease',
					}}
				>
					<RefreshCw size={16} className={checking ? 'animate-spin' : ''} />
					<span>{checking ? t('socDefconLockdownChecking') : t('socDefconLockdownRecheck')}</span>
				</button>
			</div>
		</div>
	);
}
