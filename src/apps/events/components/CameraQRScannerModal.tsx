'use client';

import React from 'react';
import { Camera, AlertCircle } from 'lucide-react';
import { Sheet } from '@/core/ui/Sheet';
import ui from '@/core/ui/ui.module.css';
import { useI18n } from '@/core/i18n';
import { useCameraQRScanner } from '../hooks/useCameraQRScanner';

export interface CameraQRScannerModalProps {
	isOpen: boolean;
	onClose: () => void;
	onScan: (code: string) => void;
	title?: string;
	placeholder?: string;
	mode?: 'member' | 'staff';
	continuous?: boolean;
}

export function CameraQRScannerModal({
	isOpen,
	onClose,
	onScan,
	title,
	placeholder,
	mode = 'member',
	continuous = false,
}: CameraQRScannerModalProps) {
	const { t, language } = useI18n();
	const isEn = language === 'en';
	const modalTitle = title || t('evScanModalTitle');
	const defaultPlaceholder = placeholder || (mode === 'staff'
		? (isEn ? 'Ticket QR code, ticket number (BB1.…), or student ID' : 'Bilet QR kodu, bilet no (BB1.…) veya öğrenci no')
		: (isEn ? '6-digit short code (e.g. A8K3M9) or scan QR' : '6 haneli kısa kod (örn. A8K3M9) veya QR okutun'));
	const {
		videoRef,
		hasPermission,
		errorMsg,
		manualCode,
		setManualCode,
		handleManualSubmit,
	} = useCameraQRScanner({
		isOpen,
		onClose,
		onScan,
		continuous,
	});

	if (!isOpen) return null;

	return (
		<Sheet
			title={modalTitle}
			label={modalTitle}
			icon={<Camera size={18} color="var(--accent-blue, #0a84ff)" />}
			onClose={onClose}
			maxWidth={440}
			bodyStyle={{ padding: 0, gap: 0 }}
		>
			{/* Video Viewport / Reticle */}
			<div
				style={{
					position: 'relative',
					width: '100%',
					height: '280px',
					background: '#000000',
					display: 'grid',
					placeItems: 'center',
					overflow: 'hidden',
				}}
			>
				{hasPermission === false ? (
					<div style={{ padding: '24px', textAlign: 'center', color: '#ff453a' }}>
						<AlertCircle size={36} style={{ margin: '0 auto 12px auto' }} />
						<div style={{ fontSize: '13px', lineHeight: 1.5 }}>{errorMsg}</div>
					</div>
				) : (
					<>
						<video
							ref={videoRef}
							playsInline
							muted
							autoPlay
							style={{
								width: '100%',
								height: '100%',
								objectFit: 'cover',
							}}
						/>
						<div
							style={{
								position: 'absolute',
								width: '180px',
								height: '180px',
								border: '2px solid rgba(52, 199, 89, 0.8)',
								borderRadius: '16px',
								boxShadow: '0 0 0 4000px rgba(0, 0, 0, 0.4)',
								pointerEvents: 'none',
							}}
						>
							<div
								style={{
									width: '100%',
									height: '2px',
									background: '#34c759',
									boxShadow: '0 0 8px #34c759',
									animation: 'scanLine 2s linear infinite',
								}}
							/>
						</div>
					</>
				)}
			</div>

			{/* Footer: Manual code entry */}
			<div style={{ padding: '16px 20px' }}>
				<div style={{ fontSize: '11.5px', opacity: 0.7, marginBottom: '8px' }}>
					{t('evScanCameraNotice')}
				</div>
				<form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '8px' }}>
					<input
						type="text"
						className={ui.input}
						placeholder={defaultPlaceholder}
						value={manualCode}
						onChange={(e) => setManualCode(e.target.value)}
						style={{ flex: 1 }}
					/>
					<button type="submit" className={ui.primaryBtn}>
						{t('evScanSendBtn')}
					</button>
				</form>
			</div>
		</Sheet>
	);
}
