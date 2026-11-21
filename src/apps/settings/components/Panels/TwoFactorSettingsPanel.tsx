'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { AlertCircle, Loader2, QrCode } from 'lucide-react';
import { TwoFactorStatusBanner } from './TwoFactorStatusBanner';
import { TwoFactorSetupForm } from './TwoFactorSetupForm';
import { TwoFactorRecoveryCodes } from './TwoFactorRecoveryCodes';
import { TwoFactorDisableForm } from './TwoFactorDisableForm';
import { useTwoFactorSettings } from './twoFactor/useTwoFactorSettings';

export function TwoFactorSettingsPanel({
	autoStart = false,
	onEnrolled,
	onRecoveryAcknowledged,
}: {
	autoStart?: boolean;
	onEnrolled?: () => void;
	onRecoveryAcknowledged?: () => void;
} = {}) {
	const { t } = useI18n();
	const {
		step,
		setStep,
		status,
		statusUnavailable,
		qrDataUrl,
		secret,
		code,
		setCode,
		recoveryCodes,
		busy,
		feedback,
		showDisable,
		setShowDisable,
		disableCode,
		setDisableCode,
		startSetup,
		confirmSetup,
		disable,
		copyRecoveryCodes,
		retryLoadStatus,
	} = useTwoFactorSettings({ autoStart, onEnrolled });

	if (step === 'loading') {
		return (
			<div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.6, fontSize: '13px' }}>
				<Loader2 size={16} />
				<span>{t('loading')}</span>
			</div>
		);
	}

	if (statusUnavailable && !status) {
		return (
			<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
				<div
					style={{
						padding: '12px 16px',
						borderRadius: '10px',
						background: 'color-mix(in srgb, var(--danger) 15%, transparent)',
						border: '1px solid color-mix(in srgb, var(--danger) 40%, transparent)',
						color: 'var(--danger)',
						fontSize: '13px',
						display: 'flex',
						alignItems: 'center',
						gap: '8px',
					}}
				>
					<AlertCircle size={16} />
					<span>{t('twofactorStatusLoadFailed')}</span>
				</div>
				<button
					onClick={retryLoadStatus}
					style={{
						alignSelf: 'flex-start',
						padding: '8px 14px',
						borderRadius: '8px',
						border: '1px solid var(--window-border)',
						background: 'transparent',
						color: 'inherit',
						fontSize: '13px',
						cursor: 'pointer',
					}}
				>
					{t('retry')}
				</button>
			</div>
		);
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
			<TwoFactorStatusBanner status={status} feedback={feedback} />

			{step === 'idle' && !status?.enabled && (
				<>
					<p style={{ fontSize: '13px', opacity: 0.75, lineHeight: 1.5, margin: 0 }}>
						{t('twofactorDescription')}
					</p>
					<button
						onClick={startSetup}
						disabled={busy}
						style={{
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
							cursor: busy ? 'wait' : 'pointer',
							alignSelf: 'flex-start',
						}}
					>
						{busy ? <Loader2 size={15} /> : <QrCode size={15} />}
						{status?.pendingSetup ? t('twofactorRestartSetup') : t('twofactorSetupBtn')}
					</button>
				</>
			)}

			{step === 'setup' && (
				<TwoFactorSetupForm
					qrDataUrl={qrDataUrl}
					secret={secret}
					code={code}
					busy={busy}
					onCodeChange={setCode}
					onSubmit={confirmSetup}
					onCancel={() => setStep('idle')}
				/>
			)}

			{step === 'recovery' && (
				<TwoFactorRecoveryCodes
					recoveryCodes={recoveryCodes}
					onCopy={copyRecoveryCodes}
					onAcknowledge={() => {
						setStep('idle');
						onRecoveryAcknowledged?.();
					}}
				/>
			)}

			{step === 'idle' && status?.enabled && (
				<TwoFactorDisableForm
					required={status.required}
					showDisable={showDisable}
					disableCode={disableCode}
					busy={busy}
					onShowDisable={setShowDisable}
					onCodeChange={setDisableCode}
					onSubmit={disable}
				/>
			)}
		</div>
	);
}
