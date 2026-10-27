'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import Image from 'next/image';

interface TwoFactorSetupFormProps {
	qrDataUrl: string;
	secret: string;
	code: string;
	busy: boolean;
	onCodeChange: (val: string) => void;
	onSubmit: (e: React.FormEvent) => void;
	onCancel: () => void;
}

const labelStyle: React.CSSProperties = {
	fontSize: '12px',
	opacity: 0.8,
	display: 'block',
	marginBottom: '6px',
	fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
	width: '100%',
	padding: '8px 12px',
	borderRadius: '8px',
	background: 'rgba(0, 0, 0, 0.25)',
	border: '1px solid var(--window-border)',
	color: 'inherit',
	fontSize: '13px',
};

export function TwoFactorSetupForm({
	qrDataUrl,
	secret,
	code,
	busy,
	onCodeChange,
	onSubmit,
	onCancel,
}: TwoFactorSetupFormProps) {
	const { t } = useI18n();
	return (
		<form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
			<div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
				{qrDataUrl && (
					<Image
						src={qrDataUrl}
						alt={t('twofactorQrAlt')}
						width={180}
						height={180}
						unoptimized
						style={{ borderRadius: '12px', background: '#fff', padding: '8px' }}
					/>
				)}
				<div style={{ flex: 1, minWidth: '220px' }}>
					<p style={{ fontSize: '13px', opacity: 0.75, lineHeight: 1.5, marginTop: 0 }}>
						{t('twofactorScanQr')}
					</p>
					<code
						style={{
							display: 'block',
							padding: '10px 12px',
							borderRadius: '8px',
							background: 'rgba(0, 0, 0, 0.25)',
							border: '1px solid var(--window-border)',
							fontSize: '12px',
							wordBreak: 'break-all',
							userSelect: 'all',
						}}
					>
						{secret}
					</code>
				</div>
			</div>

			<div>
				<label style={labelStyle}>{t('twofactorCodeInput')}</label>
				<input
					type="text"
					inputMode="numeric"
					autoComplete="one-time-code"
					maxLength={6}
					value={code}
					onChange={(e) => onCodeChange(e.target.value)}
					placeholder="123456"
					required
					style={{ ...inputStyle, letterSpacing: '4px', maxWidth: '180px' }}
				/>
			</div>

			<div style={{ display: 'flex', gap: '10px' }}>
				<button
					type="submit"
					disabled={busy}
					style={{
						padding: '10px 16px',
						borderRadius: '8px',
						border: 'none',
						background: 'var(--accent-blue)',
						color: '#fff',
						fontSize: '13px',
						fontWeight: 600,
						cursor: busy ? 'wait' : 'pointer',
					}}
				>
					{busy ? t('twofactorVerifying') : t('twofactorVerifyAndEnable')}
				</button>
				<button
					type="button"
					onClick={onCancel}
					style={{
						padding: '10px 16px',
						borderRadius: '8px',
						border: '1px solid var(--window-border)',
						background: 'transparent',
						color: 'inherit',
						fontSize: '13px',
						cursor: 'pointer',
					}}
				>
					{t('cancel')}
				</button>
			</div>
		</form>
	);
}
