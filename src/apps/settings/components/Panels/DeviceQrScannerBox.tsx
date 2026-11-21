'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { QrCode } from 'lucide-react';
import { useI18n } from '@/core/i18n';

interface DeviceQrScannerBoxProps {
	onApproved: () => void;
}

export function DeviceQrScannerBox({ onApproved }: DeviceQrScannerBoxProps) {
	const { t } = useI18n();
	const [scanningQr, setScanningQr] = useState(false);
	const [qrFeedback, setQrFeedback] = useState<string | null>(null);
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const streamRef = useRef<MediaStream | null>(null);

	const stopScanner = useCallback(() => {
		setScanningQr(false);
		if (streamRef.current) {
			streamRef.current.getTracks().forEach((tr) => tr.stop());
			streamRef.current = null;
		}
	}, []);

	useEffect(() => () => stopScanner(), [stopScanner]);

	const startQrScanner = async () => {
		setQrFeedback(null);
		if (!navigator.mediaDevices?.getUserMedia) {
			setQrFeedback(t('devicesQrNoCamera'));
			return;
		}
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
			streamRef.current = stream;
			setScanningQr(true);
			setTimeout(() => {
				if (videoRef.current) {
					videoRef.current.srcObject = stream;
					void videoRef.current.play().catch(() => {
						/* Ignore autoplay rejection if user paused media */
					});
				}
			}, 50);
		} catch {
			setQrFeedback(t('devicesQrCameraDenied'));
		}
	};

	useEffect(() => {
		if (!scanningQr) return;
		let active = true;
		let timer: ReturnType<typeof setInterval> | null = null;
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d', { willReadFrequently: true });

		void import('jsqr')
			.then((mod) => {
				if (!active) return;
				const decodeQr =
					typeof mod.default === 'function'
						? mod.default
						: (mod as unknown as typeof mod.default);
				timer = setInterval(async () => {
					const video = videoRef.current;
					if (!active || !video || !ctx || video.readyState < 2) return;
					canvas.width = video.videoWidth || 320;
					canvas.height = video.videoHeight || 240;
					ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
					const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
					const code = decodeQr(img.data, img.width, img.height);
					if (!code?.data) return;
					try {
						const parsed = JSON.parse(code.data) as {
							orbitQrApproval?: number;
							approvalId?: string;
							qrToken?: string;
						};
						if (parsed.orbitQrApproval === 1 && parsed.approvalId && parsed.qrToken) {
							stopScanner();
							const res = await fetch('/api/auth/devices/approval/respond', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									approvalId: parsed.approvalId,
									decision: 'approve',
									qrToken: parsed.qrToken,
								}),
							});
							if (res.ok) {
								setQrFeedback(t('devicesQrApproved'));
								onApproved();
							}
						}
					} catch {
						// Ignore non-Orbit QR payloads
					}
				}, 400);
			})
			.catch((err) => {
				console.warn('[DeviceQrScanner] Failed to load QR decoder:', err);
				if (active) setQrFeedback(t('devicesQrNoCamera'));
			});

		return () => {
			active = false;
			if (timer) clearInterval(timer);
		};
	}, [scanningQr, stopScanner, onApproved, t]);

	return (
		<>
			<div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
				<button
					type="button"
					onClick={() => (scanningQr ? stopScanner() : void startQrScanner())}
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: '7px',
						padding: '7px 13px',
						borderRadius: '10px',
						border: '1px solid var(--accent)',
						background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
						color: 'var(--text-primary)',
						fontSize: '12.5px',
						fontWeight: 600,
						cursor: 'pointer',
					}}
				>
					<QrCode size={14} />
					{scanningQr ? t('devicesStopQrBtn') : t('devicesScanQrBtn')}
				</button>
				{qrFeedback && <span style={{ fontSize: '12px', color: 'var(--accent)' }}>{qrFeedback}</span>}
			</div>

			{scanningQr && (
				<video
					ref={videoRef}
					playsInline
					muted
					style={{
						width: '100%',
						maxWidth: '280px',
						borderRadius: '12px',
						border: '1px solid var(--window-border)',
					}}
				/>
			)}
		</>
	);
}
