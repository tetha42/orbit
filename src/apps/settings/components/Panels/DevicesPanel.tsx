'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Bell, Laptop, LogOut, Smartphone, Trash2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useLiveEvent } from '@/core/session';
import type { DeviceLoginApprovalRecord, UserSessionRecord } from '@/domains/devices/types';
import { DeviceQrScannerBox } from './DeviceQrScannerBox';

const ROW_CARD: React.CSSProperties = {
	display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px',
	borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--surface-hover)',
};
const BTN_BASE: React.CSSProperties = {
	display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
	borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
};
const BTN_ACCENT: React.CSSProperties = {
	...BTN_BASE, border: '1px solid var(--accent)', color: 'var(--text-primary)',
	background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
};
const CODE_CARD: React.CSSProperties = {
	...ROW_CARD, borderColor: 'var(--accent)', padding: '12px 14px', borderRadius: '12px',
	background: 'color-mix(in srgb, var(--accent) 12%, transparent)', flexWrap: 'wrap', gap: '10px',
};

type PushAlertStatus = 'idle' | 'enabled' | 'fallback' | 'denied' | 'unsupported';
const PUSH_KEYS: Record<Exclude<PushAlertStatus, 'idle'>, string> = {
	enabled: 'devicesPushEnabled', fallback: 'devicesPushFallback',
	denied: 'devicesPushDenied', unsupported: 'devicesPushUnsupported',
};

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
	const pad = '='.repeat((4 - (base64String.length % 4)) % 4);
	const raw = window.atob((base64String + pad).replace(/-/g, '+').replace(/_/g, '/'));
	const out = new Uint8Array(new ArrayBuffer(raw.length));
	for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
	return out;
}

async function resolvePushState(askPermission: boolean): Promise<PushAlertStatus> {
	if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
	const perm = askPermission ? await Notification.requestPermission() : Notification.permission;
	if (perm === 'denied') return 'denied';
	if (perm !== 'granted') return 'idle';
	const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
	if (!vapidKey || !('serviceWorker' in navigator)) return 'fallback';
	try {
		const reg = await navigator.serviceWorker.ready;
		if (!reg?.pushManager) return 'fallback';
		if (!askPermission) return (await reg.pushManager.getSubscription()) ? 'enabled' : 'idle';
		const sub = await reg.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(vapidKey),
		});
		const json = sub.toJSON();
		if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return 'fallback';
		const res = await fetch('/api/auth/devices/push/subscribe', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } }),
		});
		return res.ok ? 'enabled' : 'fallback';
	} catch {
		// Fall back to live SSE + Service Worker Notification when PushManager is unavailable
		return Notification.permission === 'denied' ? 'denied' : 'fallback';
	}
}

export function DevicesPanel() {
	const { t } = useI18n();
	const [sessions, setSessions] = useState<UserSessionRecord[]>([]);
	const [pendingApprovals, setPendingApprovals] = useState<DeviceLoginApprovalRecord[]>([]);
	const [busy, setBusy] = useState(false);
	const [pushBusy, setPushBusy] = useState(false);
	const [pushStatus, setPushStatus] = useState<PushAlertStatus>('idle');

	const loadDevices = useCallback(async () => {
		try {
			const [devRes, appRes] = await Promise.all([
				fetch('/api/auth/devices', { cache: 'no-store' }),
				fetch('/api/auth/devices/approval/pending', { cache: 'no-store' }),
			]);
			const devJson = devRes.ok ? ((await devRes.json()) as { sessions?: UserSessionRecord[] }) : null;
			if (Array.isArray(devJson?.sessions)) setSessions(devJson.sessions);
			const appJson = appRes.ok ? ((await appRes.json()) as { approvals?: DeviceLoginApprovalRecord[] }) : null;
			if (Array.isArray(appJson?.approvals)) setPendingApprovals(appJson.approvals);
		} catch {
			// Ignore transient network errors during device refresh
		}
	}, []);

	useEffect(() => {
		void loadDevices();
		let cancelled = false;
		void resolvePushState(false).then((status) => { if (!cancelled) setPushStatus(status); });
		return () => { cancelled = true; };
	}, [loadDevices]);

	useLiveEvent((event) => { if (event === 'login_approval' || event === 'notification') void loadDevices(); });

	const handleEnablePushAlerts = async () => {
		setPushBusy(true);
		try { setPushStatus(await resolvePushState(true)); } finally { setPushBusy(false); }
	};
	const runDeviceAction = async (url: string, method: 'DELETE' | 'POST') => {
		setBusy(true);
		try { await fetch(url, { method }); await loadDevices(); } finally { setBusy(false); }
	};

	const codeApproval = pendingApprovals.find((a) => a.mobileDisplayCode);
	const groups = [
		{ title: t('devicesPrimaryMobile'), empty: t('devicesNoMobile'), items: sessions.filter((s) => s.deviceClass === 'mobile'), Icon: Smartphone },
		{ title: t('devicesLinkedDesktops'), empty: t('devicesNoDesktops'), items: sessions.filter((s) => s.deviceClass === 'desktop'), Icon: Laptop },
	];

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
				<div>
					<h3 style={{ fontSize: '15px', fontWeight: 650, margin: 0 }}>{t('devicesTitle')}</h3>
					<p style={{ fontSize: '12.5px', opacity: 0.65, margin: '2px 0 0 0' }}>{t('devicesDesc')}</p>
				</div>
				{sessions.length > 1 && (
					<button
						type="button" disabled={busy} onClick={() => void runDeviceAction('/api/auth/devices/revoke-others', 'POST')}
						style={{ ...BTN_BASE, border: '1px solid var(--border-subtle)', background: 'var(--surface-hover)', color: 'var(--danger)' }}
					>
						<Trash2 size={13} /> {t('devicesRevokeOthersBtn')}
					</button>
				)}
			</div>

			{codeApproval?.mobileDisplayCode && (
				<div style={CODE_CARD}>
					<div>
						<div style={{ fontSize: '12px', fontWeight: 700 }}>{t('devicesMobileCodeLabel')}</div>
						<div style={{ fontSize: '11.5px', opacity: 0.75 }}>{codeApproval.desktopDeviceName} • {codeApproval.desktopIp}</div>
					</div>
					<div style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '0.18em', color: 'var(--accent)' }}>{codeApproval.mobileDisplayCode}</div>
				</div>
			)}

			<div style={{ ...ROW_CARD, flexWrap: 'wrap', gap: '10px' }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
					<Bell size={16} color="var(--accent)" />
					<div>
						<div style={{ fontSize: '12.5px', fontWeight: 600 }}>{t('devicesPushTitle')}</div>
						{pushStatus !== 'idle' && <div style={{ fontSize: '11.5px', opacity: 0.75 }}>{t(PUSH_KEYS[pushStatus])}</div>}
					</div>
				</div>
				{pushStatus === 'idle' && (
					<button type="button" disabled={pushBusy} onClick={() => void handleEnablePushAlerts()} style={BTN_ACCENT}>
						{t('devicesPushEnable')}
					</button>
				)}
			</div>

			<DeviceQrScannerBox onApproved={() => void loadDevices()} />

			{groups.map(({ title, empty, items, Icon }) => (
				<div key={title} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
					<div style={{ fontSize: '12px', fontWeight: 700, opacity: 0.75 }}>{title}</div>
					{items.length === 0 ? <div style={{ fontSize: '12.5px', opacity: 0.6 }}>{empty}</div> : items.map((s) => (
						<div key={s.id} style={ROW_CARD}>
							<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
								<Icon size={16} color="var(--accent)" />
								<div>
									<div style={{ fontSize: '13px', fontWeight: 600 }}>{s.deviceName} {s.isCurrent ? `(${t('devicesCurrentBadge')})` : ''}</div>
									<div style={{ fontSize: '11.5px', opacity: 0.65 }}>{s.ipAddress} • {s.authMethod}</div>
								</div>
							</div>
							{!s.isCurrent && (
								<button
									type="button" disabled={busy} onClick={() => void runDeviceAction(`/api/auth/devices/${encodeURIComponent(s.id)}`, 'DELETE')}
									style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
								>
									<LogOut size={14} />
								</button>
							)}
						</div>
					))}
				</div>
			))}
		</div>
	);
}
