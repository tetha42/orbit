'use client';

import React from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';
import { useI18n } from '@/core/i18n';

interface DevToolsAlertModalProps {
	blockedShortcut: string;
	shake: boolean;
	onClose: () => void;
}

export function DevToolsAlertModal({ blockedShortcut, shake, onClose }: DevToolsAlertModalProps) {
	const { t } = useI18n();

	return (
		<div
			onClick={onClose}
			style={{
				position: 'fixed',
				inset: 0,
				zIndex: 9999999,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				background: 'rgba(0, 0, 0, 0.45)',
				backdropFilter: 'var(--glass-blur-scrim)',
				animation: 'macosAlertFadeIn 150ms ease-out',
			}}
		>
			<style>{`
				@keyframes macosAlertFadeIn {
					from { opacity: 0; transform: scale(0.95); }
					to { opacity: 1; transform: scale(1); }
				}
				@keyframes macosAlertShake {
					0%, 100% { transform: translateX(0); }
					20%, 60% { transform: translateX(-8px); }
					40%, 80% { transform: translateX(8px); }
				}
			`}</style>

			<div
				onClick={(e) => e.stopPropagation()}
				style={{
					width: '100%',
					maxWidth: '310px',
					background: 'color-mix(in srgb, var(--ink-card) 88%, transparent)',
					border: '1px solid rgba(255, 255, 255, 0.2)',
					borderRadius: '18px',
					boxShadow: '0 25px 60px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(0, 0, 0, 0.25)',
					backdropFilter: 'var(--glass-blur-strong)',
					padding: '22px 20px 18px 20px',
					color: '#ffffff',
					textAlign: 'center',
					animation: shake ? 'macosAlertShake 380ms ease' : 'none',
					userSelect: 'none',
				}}
			>
				<div
					style={{
						width: '52px',
						height: '52px',
						borderRadius: '14px',
						background: 'linear-gradient(135deg, var(--warning) 0%, #d97706 100%)',
						boxShadow: '0 6px 18px color-mix(in srgb, var(--warning) 35%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.35)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						margin: '0 auto 14px auto',
						color: '#ffffff',
					}}
				>
					<ShieldAlert size={30} strokeWidth={2.2} />
				</div>

				<h3
					style={{
						fontSize: '14px',
						fontWeight: 700,
						lineHeight: 1.3,
						margin: '0 0 8px 0',
						color: '#ffffff',
					}}
				>
					{t('devToolsRestrictedTitle', '“Developer Tools” Restricted')}
				</h3>

				<p
					style={{
						fontSize: '11.5px',
						color: '#cbd5e1',
						lineHeight: 1.45,
						margin: '0 0 12px 0',
					}}
				>
					{t(
						'devToolsRestrictedBody',
						'Orbit Community OS runs in an isolated, secure PWA environment. Security policy bars access to the developer console, page source inspection, and web extensions.'
					)}
				</p>

				{blockedShortcut && (
					<div
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '5px',
							padding: '3px 8px',
							borderRadius: '6px',
							background: 'color-mix(in srgb, var(--danger) 15%, transparent)',
							border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
							color: 'var(--danger)',
							fontSize: '10.5px',
							fontWeight: 600,
							marginBottom: '16px',
						}}
					>
						<AlertTriangle size={12} />
						<span>{blockedShortcut}</span>
					</div>
				)}

				<button
					onClick={onClose}
					autoFocus
					style={{
						width: '100%',
						padding: '8px 16px',
						borderRadius: '8px',
						background: 'var(--accent)',
						border: 'none',
						color: '#ffffff',
						fontSize: '13px',
						fontWeight: 600,
						cursor: 'pointer',
						boxShadow: '0 2px 8px color-mix(in srgb, var(--accent) 40%, transparent)',
						transition: 'background 120ms ease',
					}}
					onMouseOver={(e) => (e.currentTarget.style.background = '#0071e3')}
					onMouseOut={(e) => (e.currentTarget.style.background = 'var(--accent)')}
				>
					{t('ok', 'OK')}
				</button>
			</div>
		</div>
	);
}
