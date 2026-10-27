'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { ShieldOff } from 'lucide-react';

interface TwoFactorDisableFormProps {
	required?: boolean;
	showDisable: boolean;
	disableCode: string;
	busy: boolean;
	onShowDisable: (show: boolean) => void;
	onCodeChange: (val: string) => void;
	onSubmit: (e: React.FormEvent) => void;
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

export function TwoFactorDisableForm({
	required,
	showDisable,
	disableCode,
	busy,
	onShowDisable,
	onCodeChange,
	onSubmit,
}: TwoFactorDisableFormProps) {
	const { t } = useI18n();
	if (required) {
		return (
			<p style={{ fontSize: '13px', opacity: 0.75, lineHeight: 1.5, margin: 0 }}>
				{t('twofactorRoleRequiredAlert')} {t('twofactorLostDeviceHint')}
			</p>
		);
	}

	if (!showDisable) {
		return (
			<button
				onClick={() => onShowDisable(true)}
				style={{
					display: 'inline-flex',
					alignItems: 'center',
					gap: '8px',
					padding: '10px 16px',
					borderRadius: '8px',
					border: '1px solid var(--window-border)',
					background: 'transparent',
					color: 'inherit',
					fontSize: '13px',
					cursor: 'pointer',
					alignSelf: 'flex-start',
				}}
			>
				<ShieldOff size={15} />
				{t('twofactorDisableTitle')}
			</button>
		);
	}

	return (
		<form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
			<div>
				<label style={labelStyle}>
					{t('twofactorDisableDesc')}
				</label>
				<input
					type="text"
					value={disableCode}
					onChange={(e) => onCodeChange(e.target.value)}
					required
					style={{ ...inputStyle, maxWidth: '220px' }}
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
						background: '#ff453a',
						color: '#fff',
						fontSize: '13px',
						fontWeight: 600,
						cursor: busy ? 'wait' : 'pointer',
					}}
				>
					{busy ? t('twofactorDisabling') : t('twofactorDisableBtn')}
				</button>
				<button
					type="button"
					onClick={() => {
						onShowDisable(false);
						onCodeChange('');
					}}
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
