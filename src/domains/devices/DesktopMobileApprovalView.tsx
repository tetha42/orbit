'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { QrCode, Smartphone, KeyRound } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { LoginApprovalMode } from './types';

interface DesktopMobileApprovalViewProps {
	challengeToken: string;
	onError: (msg: string) => void;
}

const CARD_BOX_STYLE: React.CSSProperties = {
	background: 'rgba(255,255,255,0.05)',
	border: '1px solid rgba(255,255,255,0.12)',
	borderRadius: '12px',
	padding: '14px',
	textAlign: 'center',
};

export function DesktopMobileApprovalView({
	challengeToken,
	onError,
}: DesktopMobileApprovalViewProps) {
	const { t } = useI18n();
	const [activeMode, setActiveMode] = useState<LoginApprovalMode | null>(null);
	const [approvalId, setApprovalId] = useState<string | null>(null);
	const [pollSecret, setPollSecret] = useState<string | null>(null);
	const [challengeNumber, setChallengeNumber] = useState<number | null>(null);
	const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
	const [mobileCodeInput, setMobileCodeInput] = useState('');
	const [busy, setBusy] = useState(false);

	const startMode = useCallback(
		async (mode: LoginApprovalMode) => {
			setBusy(true);
			setActiveMode(mode);
			setQrDataUrl(null);
			try {
				const res = await fetch('/api/auth/devices/approval/start', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ challengeToken, mode }),
				});
				const data = (await res.json()) as {
					ok?: boolean;
					error?: string;
					approvalId?: string;
					pollSecret?: string;
					qrToken?: string;
					challengeNumber?: number;
				};
				if (!res.ok || !data.ok || !data.approvalId || !data.pollSecret) {
					onError(data.error || t('devicesApprovalStartErr'));
					setActiveMode(null);
					return;
				}
				setApprovalId(data.approvalId);
				setPollSecret(data.pollSecret);
				setChallengeNumber(data.challengeNumber ?? null);

				if (mode === 'qr' && data.qrToken) {
					const payload = JSON.stringify({
						orbitQrApproval: 1,
						approvalId: data.approvalId,
						qrToken: data.qrToken,
					});
					const qrMod = await import('qrcode');
					const QRCode = qrMod.default ?? qrMod;
					const url = await QRCode.toDataURL(payload, { width: 180, margin: 1 });
					setQrDataUrl(url);
				}
			} catch {
				onError(t('devicesApprovalNetErr'));
				setActiveMode(null);
			} finally {
				setBusy(false);
			}
		},
		[challengeToken, onError, t]
	);

	useEffect(() => {
		if (!approvalId || !pollSecret || (activeMode !== 'push' && activeMode !== 'qr')) return;
		let cancelled = false;
		const timer = setInterval(async () => {
			try {
				const res = await fetch('/api/auth/devices/approval/poll', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ approvalId, pollSecret }),
				});
				if (!res.ok || cancelled) return;
				const data = (await res.json()) as { status?: string };
				if (data.status === 'approved') {
					clearInterval(timer);
					window.location.reload();
				} else if (data.status === 'rejected' || data.status === 'expired') {
					clearInterval(timer);
					onError(
						data.status === 'rejected'
							? t('devicesApprovalDenied')
							: t('devicesApprovalExpired')
					);
					setActiveMode(null);
				}
			} catch {
				// ignore poll hiccup
			}
		}, 2000);
		return () => {
			cancelled = true;
			clearInterval(timer);
		};
	}, [approvalId, pollSecret, activeMode, onError, t]);

	const handleVerifyMobileCode = async () => {
		if (!approvalId || !pollSecret || mobileCodeInput.trim().length !== 6) return;
		setBusy(true);
		try {
			const res = await fetch('/api/auth/devices/approval/verify-code', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ approvalId, pollSecret, code: mobileCodeInput.trim() }),
			});
			const data = (await res.json()) as { ok?: boolean; error?: string };
			if (!res.ok || !data.ok) {
				onError(data.error || t('devicesApprovalInvalidCode'));
				return;
			}
			window.location.reload();
		} catch {
			onError(t('devicesApprovalVerifyErr'));
		} finally {
			setBusy(false);
		}
	};

	const tabBtnStyle = (active: boolean): React.CSSProperties => ({
		flex: 1,
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		gap: '5px',
		padding: '7px 8px',
		borderRadius: '8px',
		border: active ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.14)',
		background: active ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : 'rgba(255,255,255,0.04)',
		color: '#fff',
		fontSize: '11.5px',
		fontWeight: 600,
		cursor: 'pointer',
	});

	return (
		<div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
			<div style={{ fontSize: '12px', fontWeight: 600, color: '#d4d4d8' }}>{t('devicesDesktopVerifyTitle')}</div>

			<div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
				<button type="button" disabled={busy} onClick={() => void startMode('push')} style={tabBtnStyle(activeMode === 'push')}>
					<Smartphone size={13} />
					<span>{t('devicesDesktopTabPush')}</span>
				</button>
				<button type="button" disabled={busy} onClick={() => void startMode('code')} style={tabBtnStyle(activeMode === 'code')}>
					<KeyRound size={13} />
					<span>{t('devicesDesktopTabCode')}</span>
				</button>
				<button type="button" disabled={busy} onClick={() => void startMode('qr')} style={tabBtnStyle(activeMode === 'qr')}>
					<QrCode size={13} />
					<span>{t('devicesDesktopTabQr')}</span>
				</button>
			</div>

			{activeMode === 'push' && challengeNumber !== null && (
				<div style={CARD_BOX_STYLE}>
					<div style={{ fontSize: '12px', color: '#d4d4d8', marginBottom: '8px' }}>{t('devicesDesktopVerifyPushDesc')}</div>
					<div
						style={{
							display: 'inline-grid', placeItems: 'center', width: '68px', height: '68px', borderRadius: '16px',
							background: 'color-mix(in srgb, var(--accent) 22%, transparent)', border: '2px solid var(--accent)',
							fontSize: '28px', fontWeight: 800, color: '#fff',
						}}
					>
						{challengeNumber}
					</div>
				</div>
			)}

			{activeMode === 'code' && approvalId && (
				<div style={{ ...CARD_BOX_STYLE, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '8px' }}>
					<div style={{ fontSize: '12px', color: '#d4d4d8' }}>{t('devicesDesktopVerifyCodeDesc')}</div>
					<div style={{ display: 'flex', gap: '8px' }}>
						<input
							type="text"
							inputMode="numeric"
							maxLength={6}
							value={mobileCodeInput}
							onChange={(e) => setMobileCodeInput(e.target.value)}
							placeholder={t('devicesApprovalCodePh')}
							style={{
								flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.18)',
								background: 'rgba(0,0,0,0.35)', color: '#fff', fontSize: '14px', letterSpacing: '0.15em', textAlign: 'center',
							}}
						/>
						<button
							type="button"
							disabled={busy || mobileCodeInput.trim().length !== 6}
							onClick={() => void handleVerifyMobileCode()}
							style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
						>
							{t('auth2faVerifyBtn')}
						</button>
					</div>
				</div>
			)}

			{activeMode === 'qr' && qrDataUrl && (
				<div style={CARD_BOX_STYLE}>
					<div style={{ fontSize: '12px', color: '#d4d4d8', marginBottom: '10px' }}>{t('devicesDesktopVerifyQrDesc')}</div>
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img src={qrDataUrl} alt={t('devicesApprovalQrAlt')} style={{ width: '160px', height: '160px', borderRadius: '10px', background: '#fff', padding: '6px' }} />
				</div>
			)}
		</div>
	);
}
