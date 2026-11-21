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
	const { t } = useI18n();
	const modalTitle = title || t('evScanModalTitle');
	const staffPlaceholder = t('evScanStaffPh');
	const memberPlaceholder = t('evScanMemberPh');
	const defaultPlaceholder = placeholder || (mode === 'staff' ? staffPlaceholder : memberPlaceholder);
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
			icon={<Camera size={18} color="var(--accent-blue, var(--accent))" />}
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
					<div style={{ padding: '24px', textAlign: 'center', color: 'var(--danger)' }}>
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
								border: '2px solid color-mix(in srgb, var(--success) 80%, transparent)',
								borderRadius: '16px',
								boxShadow: '0 0 0 4000px rgba(0, 0, 0, 0.4)',
								pointerEvents: 'none',
							}}
						>
							<div
								style={{
									width: '100%',
									height: '2px',
									background: 'var(--success)',
									boxShadow: '0 0 8px var(--success)',
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
