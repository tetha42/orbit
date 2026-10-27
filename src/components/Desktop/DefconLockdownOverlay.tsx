'use client';

import React, { useState } from 'react';
import { useSession } from '@/core/session';
import { ShieldAlert, RefreshCw, Lock } from 'lucide-react';

export function DefconLockdownOverlay() {
	const { isLockdownActive, lockdownMessage, isAdmin, refreshSession } = useSession();
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
				background: 'rgba(10, 10, 15, 0.88)',
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
					background: 'var(--card-bg, rgba(24, 24, 27, 0.95))',
					border: '1px solid rgba(239, 68, 68, 0.45)',
					boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.25), 0 0 40px rgba(239, 68, 68, 0.15)',
					borderRadius: '16px',
					padding: '32px 28px',
					color: 'var(--text-primary, #ffffff)',
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
						background: 'rgba(239, 68, 68, 0.15)',
						border: '2px solid rgba(239, 68, 68, 0.5)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						color: '#ef4444',
						boxShadow: '0 0 24px rgba(239, 68, 68, 0.4)',
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
							background: 'rgba(239, 68, 68, 0.2)',
							color: '#f87171',
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
						DEFCON 1 HARD LOCKDOWN
					</div>
					<h2
						id="lockdown-title"
						style={{
							margin: 0,
							fontSize: '22px',
							fontWeight: 750,
							letterSpacing: '-0.02em',
							color: 'var(--text-primary, #ffffff)',
						}}
					>
						Sistem Siber Kalkan Korumasında
					</h2>
				</div>

				{/* Description */}
				<p
					style={{
						margin: 0,
						fontSize: '14px',
						lineHeight: '1.6',
						color: 'var(--text-secondary, rgba(255, 255, 255, 0.72))',
					}}
				>
					{lockdownMessage ||
						'Sistem otomatik siber savunma kalkanı ve acil status izolasyon modundadır. Kulüp altyapısı ve veri güvenliği gereği yönetici harici tüm erişimler geçici olarak askıya alınmıştır.'}
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
						color: 'var(--text-secondary, rgba(255, 255, 255, 0.75))',
						display: 'flex',
						flexDirection: 'column',
						gap: '6px',
					}}
				>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						<span style={{ color: '#ef4444', fontWeight: 'bold' }}>•</span>
						<span>Tüm genel ve korumalı API servisleri kilitlendi (HTTP 503).</span>
					</div>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						<span style={{ color: '#ef4444', fontWeight: 'bold' }}>•</span>
						<span>Oturum güvenliği gereği aktif üye bağlantıları sonlandırıldı.</span>
					</div>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						<span style={{ color: '#ef4444', fontWeight: 'bold' }}>•</span>
						<span>SoC Siber Savunma Operatörleri inceleme yapmaktadır.</span>
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
						color: 'var(--text-primary, #ffffff)',
						fontSize: '14px',
						fontWeight: 600,
						cursor: checking ? 'not-allowed' : 'pointer',
						opacity: checking ? 0.7 : 1,
						transition: 'all 0.2s ease',
					}}
				>
					<RefreshCw size={16} className={checking ? 'animate-spin' : ''} />
					<span>{checking ? 'Güvenlik Durumu Kontrol Ediliyor...' : 'Güvenlik Durumunu Yeniden Kontrol Et'}</span>
				</button>
			</div>
		</div>
	);
}
