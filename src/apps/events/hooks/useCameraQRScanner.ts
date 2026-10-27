import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { useI18n } from '@/core/i18n';
import { useSound } from '@/core/sound';
import { acquireModalLock } from '@/lib/client/modalLock';

interface UseCameraQRScannerOptions {
	isOpen: boolean;
	onClose: () => void;
	onScan: (code: string) => void;
	continuous?: boolean;
}

export function useCameraQRScanner({
	isOpen,
	onClose,
	onScan,
	continuous = false,
}: UseCameraQRScannerOptions) {
	const { t } = useI18n();
	const { playSystemSound } = useSound();
	const videoRef = useRef<HTMLVideoElement>(null);
	const [hasPermission, setHasPermission] = useState<boolean | null>(null);
	const [errorMsg, setErrorMsg] = useState('');
	const [manualCode, setManualCode] = useState('');
	const streamRef = useRef<MediaStream | null>(null);
	const onScanRef = useRef(onScan);
	const onCloseRef = useRef(onClose);
	const lastRead = useRef<{ code: string; at: number } | null>(null);

	useEffect(() => {
		onScanRef.current = onScan;
		onCloseRef.current = onClose;
	});

	useEffect(() => {
		if (!isOpen) return;
		const release = acquireModalLock();
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.stopPropagation();
				onCloseRef.current();
			}
		};
		window.addEventListener('keydown', onKey, true);
		return () => {
			release();
			window.removeEventListener('keydown', onKey, true);
		};
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) {
			if (streamRef.current) {
				streamRef.current.getTracks().forEach((track) => track.stop());
				streamRef.current = null;
			}
			return;
		}

		let active = true;

		const startCamera = async () => {
			try {
				setErrorMsg('');
				const stream = await navigator.mediaDevices.getUserMedia({
					video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
				});

				if (!active) {
					stream.getTracks().forEach((track) => track.stop());
					return;
				}

				streamRef.current = stream;
				if (videoRef.current) {
					videoRef.current.srcObject = stream;
					videoRef.current.play().catch(() => {});
				}
				setHasPermission(true);
			} catch (err) {
				if (!active) return;
				console.warn('Camera access denied or unavailable:', err);
				setHasPermission(false);
				setErrorMsg(t('evCameraPermissionError'));
			}
		};

		startCamera();

		const handleRead = (rawVal: string) => {
			const last = lastRead.current;
			if (rawVal && !(last && last.code === rawVal && Date.now() - last.at < 4000)) {
				lastRead.current = { code: rawVal, at: Date.now() };
				playSystemSound();
				onScanRef.current(rawVal);
				if (!continuous) onCloseRef.current();
			}
		};

		// Native detector where the browser has one (Chromium/Android). Safari and iOS
		// do not, so every other browser decodes frames in JavaScript with jsQR.
		let intervalId: ReturnType<typeof setInterval> | null = null;
		if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
			try {
				const barcodeDetector = new window.BarcodeDetector!({ formats: ['qr_code'] });
				intervalId = setInterval(async () => {
					if (videoRef.current && videoRef.current.readyState >= 2) {
						try {
							const barcodes = await barcodeDetector.detect(videoRef.current);
							if (barcodes.length > 0 && barcodes[0].rawValue) handleRead(barcodes[0].rawValue);
						} catch {}
					}
				}, 400);
			} catch {}
		} else {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d', { willReadFrequently: true });
			intervalId = setInterval(() => {
				const video = videoRef.current;
				if (!ctx || !video || video.readyState < 2 || !video.videoWidth) return;
				// Downscale to keep decoding cheap on phones; QR codes stay readable at this size.
				const scale = Math.min(1, 480 / video.videoWidth);
				canvas.width = Math.round(video.videoWidth * scale);
				canvas.height = Math.round(video.videoHeight * scale);
				ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
				const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
				const found = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' });
				if (found?.data) handleRead(found.data);
			}, 300);
		}

		return () => {
			active = false;
			if (intervalId) clearInterval(intervalId);
			if (streamRef.current) {
				streamRef.current.getTracks().forEach((track) => track.stop());
				streamRef.current = null;
			}
		};
	}, [isOpen, continuous, playSystemSound, t]);

	const handleManualSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const raw = manualCode.trim();
		if (!raw) return;
		let code = raw;
		if (code.includes('/yoklama/')) {
			const m = /\/yoklama\/([^/?#\s]+)/.exec(code);
			if (m) code = decodeURIComponent(m[1]);
		}
		// If short code (no period delimiters like BB1/BY1), strip spaces and dashes and uppercase
		if (!code.includes('.')) {
			code = code.replace(/[\s-]+/g, '').toUpperCase();
		}
		playSystemSound();
		onScan(code);
		setManualCode('');
		if (!continuous) onClose();
	};

	return {
		videoRef,
		hasPermission,
		errorMsg,
		manualCode,
		setManualCode,
		handleManualSubmit,
	};
}
