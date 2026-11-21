'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import ui from '@/core/ui/ui.module.css';
import styles from './Account.module.css';

interface AccountEmailChangeBoxProps {
	currentEmail: string;
	emailStep: 'request' | 'verify';
	newEmail: string;
	emailCode: string;
	emailBusy: boolean;
	emailMsg: { text: string; tone: 'ok' | 'err' } | null;
	onNewEmailChange: (value: string) => void;
	onEmailCodeChange: (value: string) => void;
	onRequestCode: () => void;
	onConfirmCode: () => void;
	onClose: () => void;
}

export function AccountEmailChangeBox({
	currentEmail,
	emailStep,
	newEmail,
	emailCode,
	emailBusy,
	emailMsg,
	onNewEmailChange,
	onEmailCodeChange,
	onRequestCode,
	onConfirmCode,
	onClose,
}: AccountEmailChangeBoxProps) {
	const { t } = useI18n();

	return (
		<div
			style={{
				border: '1px solid var(--window-border)',
				borderRadius: '10px',
				padding: '12px',
				display: 'flex',
				flexDirection: 'column',
				gap: '10px',
				background: 'var(--fill-soft, rgba(255,255,255,0.04))',
			}}
		>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
				<div style={{ fontSize: '12.5px', fontWeight: 700 }}>{t('acChangeEmail')}</div>
				<button type="button" className={ui.btn} onClick={onClose} disabled={emailBusy}>
					{t('acEmailChangeCancel')}
				</button>
			</div>
			{emailMsg && (
				<div className={emailMsg.tone === 'ok' ? styles.ok : ui.error} role={emailMsg.tone === 'ok' ? 'status' : 'alert'}>
					{emailMsg.text}
				</div>
			)}
			{emailStep === 'request' ? (
				<div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
					<label className={ui.field} style={{ flex: 1, minWidth: '200px' }}>
						<span className={ui.fieldLabel}>{t('acNewEmail')}</span>
						<input
							className={ui.input}
							type="email"
							autoComplete="email"
							value={newEmail}
							onChange={(event) => onNewEmailChange(event.target.value)}
							placeholder="new@example.com"
						/>
					</label>
					<button type="button" className={ui.primaryBtn} onClick={onRequestCode} disabled={emailBusy}>
						{emailBusy ? t('saving') : t('acSendCode')}
					</button>
				</div>
			) : (
				<div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
					<label className={ui.field} style={{ flex: 1, minWidth: '200px' }}>
						<span className={ui.fieldLabel}>{t('acVerificationCode')}</span>
						<input
							className={ui.input}
							inputMode="numeric"
							maxLength={6}
							value={emailCode}
							onChange={(event) => onEmailCodeChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
							placeholder="123456"
						/>
					</label>
					<button type="button" className={ui.primaryBtn} onClick={onConfirmCode} disabled={emailBusy}>
						{emailBusy ? t('saving') : t('acVerifyCode')}
					</button>
				</div>
			)}
			<div style={{ fontSize: '11px', opacity: 0.6 }}>{newEmail || currentEmail}</div>
		</div>
	);
}
