'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { KeyRound, Loader2, Plus } from 'lucide-react';

interface PasskeyAddFormProps {
	supportsPasskeys: boolean;
	nickname: string;
	isBusy: boolean;
	onNicknameChange: (val: string) => void;
	onAddPasskey: () => void;
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

const primaryButton: React.CSSProperties = {
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
	gap: '8px',
	padding: '10px 16px',
	borderRadius: '8px',
	border: 'none',
	background: 'var(--accent-blue)',
	color: '#fff',
	fontSize: '13px',
	fontWeight: 600,
	cursor: 'pointer',
};

export function PasskeyAddForm({
	supportsPasskeys,
	nickname,
	isBusy,
	onNicknameChange,
	onAddPasskey,
}: PasskeyAddFormProps) {
	const { t } = useI18n();
	if (!supportsPasskeys) return null;

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				gap: '12px',
				padding: '14px',
				borderRadius: '10px',
				background: 'rgba(0, 0, 0, 0.18)',
				border: '1px solid var(--window-border)',
			}}
		>
			<div>
				<label style={labelStyle}>{t('passkeyDeviceName')}</label>
				<input
					type="text"
					value={nickname}
					onChange={(e) => onNicknameChange(e.target.value)}
					placeholder={t('passkeyDeviceNamePh')}
					maxLength={60}
					style={{ ...inputStyle, maxWidth: '260px' }}
				/>
			</div>
			<button
				type="button"
				onClick={onAddPasskey}
				disabled={isBusy}
				style={{ ...primaryButton, alignSelf: 'flex-start', cursor: isBusy ? 'wait' : 'pointer' }}
			>
				{isBusy ? <Loader2 size={15} /> : <Plus size={15} />}
				{isBusy ? t('passkeyAdding') : t('passkeyAddBtn')}
			</button>
			<div style={{ fontSize: '11.5px', opacity: 0.65, display: 'flex', alignItems: 'center', gap: '6px' }}>
				<KeyRound size={13} />
				{t('passkeyHint')}
			</div>
		</div>
	);
}
