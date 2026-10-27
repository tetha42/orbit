'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSound } from '@/core/sound';
import { useI18n } from '@/core/i18n';
import { isEditableElement } from '@/lib/client/dom';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

export function DevToolsGuard() {
	const { language } = useI18n();
	const { playSystemSound } = useSound();
	const [alertOpen, setAlertOpen] = useState(false);
	const [blockedShortcut, setBlockedShortcut] = useState<string>('');
	const [shake, setShake] = useState(false);

	const triggerBlock = useCallback(
		(shortcutLabel: string) => {
			playSystemSound();
			setBlockedShortcut(shortcutLabel);
			setAlertOpen(true);
			setShake(true);
			setTimeout(() => setShake(false), 400);
		},
		[playSystemSound]
	);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (isEditableElement(document.activeElement) || (e.target as Element)?.closest?.('.xterm')) return;
			// Chrome fires keydown without a `key` when it autofills a saved password.
			const key = (e.key ?? '').toUpperCase();
			const isCmdOrCtrl = e.metaKey || e.ctrlKey;

			// 1. F12 (Standard DevTools)
			if (e.key === 'F12') {
				e.preventDefault();
				e.stopPropagation();
				triggerBlock('F12 (Developer Tools)');
				return;
			}

			// 2. Ctrl+Shift+I / Cmd+Option+I (Inspect)
			if ((isCmdOrCtrl && e.shiftKey && key === 'I') || (isCmdOrCtrl && e.altKey && key === 'I')) {
				e.preventDefault();
				e.stopPropagation();
				triggerBlock('⌥⌘I / Ctrl+Shift+I (Inspect Element)');
				return;
			}

			// 3. Ctrl+Shift+J / Cmd+Option+J (Console)
			if ((isCmdOrCtrl && e.shiftKey && key === 'J') || (isCmdOrCtrl && e.altKey && key === 'J')) {
				e.preventDefault();
				e.stopPropagation();
				triggerBlock('⌥⌘J / Ctrl+Shift+J (Console)');
				return;
			}

			// 4. Ctrl+Shift+C / Cmd+Option+C (Element Selector)
			if ((isCmdOrCtrl && e.shiftKey && key === 'C') || (isCmdOrCtrl && e.altKey && key === 'C')) {
				e.preventDefault();
				e.stopPropagation();
				triggerBlock('⌥⌘C / Ctrl+Shift+C (Inspect Selector)');
				return;
			}

			// 5. Ctrl+U / Cmd+Option+U (View Source)
			if ((isCmdOrCtrl && key === 'U') || (isCmdOrCtrl && e.altKey && key === 'U')) {
				e.preventDefault();
				e.stopPropagation();
				triggerBlock('⌘U / Ctrl+U (View Source)');
				return;
			}

			// 6. Ctrl+Shift+K (Firefox Web Console)
			if (isCmdOrCtrl && e.shiftKey && key === 'K') {
				e.preventDefault();
				e.stopPropagation();
				triggerBlock('Ctrl+Shift+K (Web Console)');
				return;
			}

			// 7. Ctrl+Shift+E (Network / Extension inspection)
			if (isCmdOrCtrl && e.shiftKey && key === 'E') {
				e.preventDefault();
				e.stopPropagation();
				triggerBlock('Ctrl+Shift+E (Extensions & Network)');
				return;
			}
		};

		// Global capture phase to intercept before browser or extensions handle it
		window.addEventListener('keydown', handleKeyDown, true);

		return () => {
			window.removeEventListener('keydown', handleKeyDown, true);
		};
	}, [triggerBlock]);

	// Handle dismissing alert with Enter or Escape
	useEffect(() => {
		if (!alertOpen) return;

		const handleDismissKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape' || e.key === 'Enter') {
				e.preventDefault();
				setAlertOpen(false);
			}
		};

		// Capture phase, like the listener above: the 3D wallpaper swallows bubbling keydowns.
		window.addEventListener('keydown', handleDismissKey, true);
		return () => window.removeEventListener('keydown', handleDismissKey, true);
	}, [alertOpen]);

	if (!alertOpen) return null;

	return (
		<div
			onClick={() => setAlertOpen(false)}
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
					background: 'rgba(38, 42, 54, 0.88)',
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
				{/* Apple macOS Alert Caution Icon */}
				<div
					style={{
						width: '52px',
						height: '52px',
						borderRadius: '14px',
						background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
						boxShadow: '0 6px 18px rgba(245, 158, 11, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.35)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						margin: '0 auto 14px auto',
						color: '#ffffff',
					}}
				>
					<ShieldAlert size={30} strokeWidth={2.2} />
				</div>

				{/* Title */}
				<h3
					style={{
						fontSize: '14px',
						fontWeight: 700,
						lineHeight: 1.3,
						margin: '0 0 8px 0',
						color: '#ffffff',
					}}
				>
					{language === 'tr' ? '“Geliştirici Araçları” Kısıtlandı' : '“Developer Tools” Restricted'}
				</h3>

				{/* Message */}
				<p
					style={{
						fontSize: '11.5px',
						color: '#cbd5e1',
						lineHeight: 1.45,
						margin: '0 0 12px 0',
					}}
				>
					{language === 'tr'
						? 'Club Portal OS korumalı bir PWA çalışma ortamında çalışmaktadır. Güvenlik politikaları gereğince geliştirici konsoluna, sayfa kaynağına ve web eklentilerine erişim sınırlandırılmıştır.'
						: 'Club Portal OS runs in an isolated, secure PWA environment. Security policy bars access to the developer console, page source inspection, and web extensions.'}
				</p>

				{/* Shortcut badge */}
				{blockedShortcut && (
					<div
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '5px',
							padding: '3px 8px',
							borderRadius: '6px',
							background: 'rgba(239, 68, 68, 0.15)',
							border: '1px solid rgba(239, 68, 68, 0.3)',
							color: '#f87171',
							fontSize: '10.5px',
							fontWeight: 600,
							marginBottom: '16px',
						}}
					>
						<AlertTriangle size={12} />
						<span>{blockedShortcut}</span>
					</div>
				)}

				{/* Action button */}
				<button
					onClick={() => setAlertOpen(false)}
					autoFocus
					style={{
						width: '100%',
						padding: '8px 16px',
						borderRadius: '8px',
						background: '#0a84ff',
						border: 'none',
						color: '#ffffff',
						fontSize: '13px',
						fontWeight: 600,
						cursor: 'pointer',
						boxShadow: '0 2px 8px rgba(10, 132, 255, 0.4)',
						transition: 'background 120ms ease',
					}}
					onMouseOver={(e) => (e.currentTarget.style.background = '#0071e3')}
					onMouseOut={(e) => (e.currentTarget.style.background = '#0a84ff')}
				>
					{language === 'tr' ? 'Tamam' : 'OK'}
				</button>
			</div>
		</div>
	);
}
