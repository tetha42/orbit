'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useLiveEvent, useSession } from '@/core/session';
import { useWindowActions } from '@/core/windows';
import { useI18n } from '@/core/i18n';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

type DefconLevel = 1 | 2 | 3 | 4 | 5;

interface DefconVisual {
	labelKey: string;
	titleKey: string;
	color: string;
	bg: string;
	border: string;
	icon: typeof ShieldAlert;
	pulse?: boolean;
}

const DEFCON_STYLES: Record<DefconLevel, DefconVisual> = {
	1: {
		labelKey: 'socDefcon1Label',
		titleKey: 'socDefcon1Title',
		color: 'var(--danger)',
		bg: 'color-mix(in srgb, var(--danger) 20%, transparent)',
		border: '1px solid color-mix(in srgb, var(--danger) 50%, transparent)',
		icon: ShieldAlert,
		pulse: true,
	},
	2: {
		labelKey: 'socDefcon2Label',
		titleKey: 'socDefcon2Title',
		color: 'color-mix(in srgb, var(--warning) 45%, var(--danger))',
		bg: 'color-mix(in srgb, var(--warning) 18%, transparent)',
		border: '1px solid color-mix(in srgb, var(--warning) 45%, transparent)',
		icon: ShieldAlert,
	},
	3: {
		labelKey: 'socDefcon3Label',
		titleKey: 'socDefcon3Title',
		color: 'var(--warning)',
		bg: 'color-mix(in srgb, var(--warning) 16%, transparent)',
		border: '1px solid color-mix(in srgb, var(--warning) 40%, transparent)',
		icon: ShieldAlert,
	},
	4: {
		labelKey: 'socDefcon4Label',
		titleKey: 'socDefcon4Title',
		color: 'var(--cyan)',
		bg: 'color-mix(in srgb, var(--cyan) 14%, transparent)',
		border: '1px solid color-mix(in srgb, var(--cyan) 35%, transparent)',
		icon: ShieldCheck,
	},
	5: {
		labelKey: 'socDefcon5Label',
		titleKey: 'socDefcon5Title',
		color: 'var(--success)',
		bg: 'color-mix(in srgb, var(--success) 12%, transparent)',
		border: '1px solid color-mix(in srgb, var(--success) 28%, transparent)',
		icon: ShieldCheck,
	},
};

export function DefconStatusBadge() {
	const { currentUser, canUseApp } = useSession();
	const { openApp } = useWindowActions();
	const { t } = useI18n();
	const [defcon, setDefcon] = useState<DefconLevel>(5);
	const lastSyncedAtRef = useRef(0);
	const channelRef = useRef<BroadcastChannel | null>(null);
	const triggerFetchRef = useRef<((force?: boolean) => void) | null>(null);

	useLiveEvent((event) => {
		if (event === 'soc_updated') {
			triggerFetchRef.current?.(true);
		}
	});

	useEffect(() => {
		if (!currentUser || !canUseApp('soc')) return;

		let active = true;
		const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('orbit:soc-defcon') : null;
		channelRef.current = bc;
		if (bc) {
			bc.onmessage = (ev) => {
				const msg = ev.data as { defcon?: number; ts?: number } | null;
				if (!active || !msg || typeof msg.defcon !== 'number') return;
				lastSyncedAtRef.current = typeof msg.ts === 'number' ? msg.ts : Date.now();
				setDefcon(msg.defcon as DefconLevel);
			};
		}

		const checkStatus = (force = false) => {
			if (!force && typeof document !== 'undefined' && document.hidden) return;
			if (!force && Date.now() - lastSyncedAtRef.current < 150_000) return;
			fetch('/api/soc?action=defcon')
				.then((res) => (res.ok ? res.json() : null))
				.then((data) => {
					if (!active || !data) return;
					const ov = data.overview ?? data;
					if (ov && (typeof ov.defcon === 'number' || ov.lockdown)) {
						const nextLevel = (
							ov.lockdown?.active ? 1 : typeof ov.defcon === 'number' ? ov.defcon : 5
						) as DefconLevel;
						const now = Date.now();
						lastSyncedAtRef.current = now;
						setDefcon(nextLevel);
						bc?.postMessage({ defcon: nextLevel, ts: now });
					}
				})
				.catch(() => {});
		};

		triggerFetchRef.current = checkStatus;
		checkStatus(true);
		const timer = setInterval(() => checkStatus(false), 180_000);
		const onVisible = () => {
			if (typeof document !== 'undefined' && !document.hidden) checkStatus(false);
		};
		document.addEventListener('visibilitychange', onVisible);

		return () => {
			active = false;
			triggerFetchRef.current = null;
			clearInterval(timer);
			document.removeEventListener('visibilitychange', onVisible);
			bc?.close();
			channelRef.current = null;
		};
	}, [currentUser, canUseApp]);

	if (!currentUser || !canUseApp('soc')) return null;

	const style = DEFCON_STYLES[defcon] || DEFCON_STYLES[5];
	const Icon = style.icon;
	const label = t(style.labelKey);
	const title = t(style.titleKey);

	return (
		<button
			type="button"
			onClick={() => openApp('soc')}
			title={title}
			style={{
				display: 'inline-flex',
				alignItems: 'center',
				gap: '5px',
				background: style.bg,
				border: style.border,
				color: style.color,
				borderRadius: '12px',
				padding: '1px 8px',
				fontSize: '11px',
				fontWeight: defcon <= 2 ? 700 : 600,
				cursor: 'pointer',
				height: '20px',
				lineHeight: 1,
				animation: style.pulse ? 'pulse 2s infinite ease-in-out' : undefined,
			}}
		>
			<Icon size={12} />
			<span>{label}</span>
		</button>
	);
}

