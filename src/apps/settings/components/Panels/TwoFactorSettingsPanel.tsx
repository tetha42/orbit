'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/core/i18n';
import { AlertCircle, Loader2, QrCode } from 'lucide-react';
import { useSession } from '@/core/session';
import { TwoFactorStatusBanner } from './TwoFactorStatusBanner';
import { TwoFactorSetupForm } from './TwoFactorSetupForm';
import { TwoFactorRecoveryCodes } from './TwoFactorRecoveryCodes';
import { TwoFactorDisableForm } from './TwoFactorDisableForm';

type PanelStep = 'loading' | 'idle' | 'setup' | 'recovery';

interface Status {
	enabled: boolean;
	required: boolean;
	pendingSetup: boolean;
	mustSetup: boolean;
}

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
	const { refreshSession } = useSession();
	const [step, setStep] = useState<PanelStep>('loading');
	const [status, setStatus] = useState<Status | null>(null);
	const [statusUnavailable, setStatusUnavailable] = useState(false);
	const [qrDataUrl, setQrDataUrl] = useState('');
	const [secret, setSecret] = useState('');
	const [code, setCode] = useState('');
	const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
	const [busy, setBusy] = useState(false);
	const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
	const [showDisable, setShowDisable] = useState(false);
	const [disableCode, setDisableCode] = useState('');

	const loadStatus = useCallback(async (): Promise<boolean> => {
		try {
			const res = await fetch('/api/auth/2fa/status');
			const data = await res.json();
			if (res.ok && data.success) {
				setStatus({
					enabled: data.enabled,
					required: data.required,
					pendingSetup: data.pendingSetup,
					mustSetup: data.mustSetup,
				});
				return true;
			}
			setStatusUnavailable(true);
			return false;
		} catch {
			setStatusUnavailable(true);
			return false;
		}
	}, []);

	const startSetup = useCallback(async () => {
		setBusy(true);
		setFeedback(null);
		try {
			const res = await fetch('/api/auth/2fa/setup', { method: 'POST' });
			const data = await res.json();
			if (res.ok && data.success) {
				setQrDataUrl(data.qrDataUrl);
				setSecret(data.secret);
				setCode('');
				setStep('setup');
			} else {
				setFeedback({ type: 'err', text: data.error || t('twofactorSetupError') });
			}
		} catch {
			setFeedback({ type: 'err', text: t('twofactorSetupError') });
		} finally {
			setBusy(false);
		}
	}, [t]);

	useEffect(() => {
		let isMounted = true;
		(async () => {
			const ok = await loadStatus();
			if (!isMounted) return;
			if (autoStart && ok) {
				await startSetup();
			} else {
				setStep('idle');
			}
		})();
		return () => {
			isMounted = false;
		};
	}, [loadStatus, autoStart, startSetup]);

	const confirmSetup = async (e: React.FormEvent) => {
		e.preventDefault();
		setBusy(true);
		setFeedback(null);
		try {
			const res = await fetch('/api/auth/2fa/enable', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code }),
			});
			const data = await res.json();
			if (res.ok && data.success) {
				setRecoveryCodes(data.recoveryCodes);
				setStep('recovery');
				onEnrolled?.();
				await loadStatus();
				await refreshSession();
			} else {
				const errMsg = data.code === 'INVALID_2FA_CODE'
					? t('twofactorVerifyError')
					: data.code === 'SETUP_REQUIRED'
					? t('twofactorSetupError')
					: (data.error || t('twofactorVerifyError'));
				setFeedback({ type: 'err', text: errMsg });
			}
		} catch {
			setFeedback({ type: 'err', text: t('twofactorVerifyError') });
		} finally {
			setBusy(false);
		}
	};

	const disable = async (e: React.FormEvent) => {
		e.preventDefault();
		setBusy(true);
		setFeedback(null);
		try {
			const res = await fetch('/api/auth/2fa/disable', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code: disableCode }),
			});
			const data = await res.json();
			if (res.ok && data.success) {
				setShowDisable(false);
				setDisableCode('');
				setFeedback({ type: 'ok', text: t('twofactorDisabledSuccess') });
				await loadStatus();
				await refreshSession();
			} else {
				const errMsg = data.code === 'ROLE_REQUIRED'
					? t('twofactorRoleRequiredAlert')
					: (data.error || t('twofactorDisableFailed'));
				setFeedback({ type: 'err', text: errMsg });
			}
		} catch {
			setFeedback({ type: 'err', text: t('twofactorDisableFailed') });
		} finally {
			setBusy(false);
		}
	};

	const copyRecoveryCodes = () => {
		navigator.clipboard?.writeText(recoveryCodes.join('\n'));
		setFeedback({ type: 'ok', text: t('twofactorRecoveryCopied') });
	};

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
				<div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(255, 69, 58, 0.15)', border: '1px solid rgba(255, 69, 58, 0.4)', color: '#ff453a', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
					<AlertCircle size={16} />
					<span>{t('twofactorStatusLoadFailed')}</span>
				</div>
				<button
					onClick={() => {
						setStatusUnavailable(false);
						setStep('loading');
						void loadStatus().finally(() => setStep('idle'));
					}}
					style={{ alignSelf: 'flex-start', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--window-border)', background: 'transparent', color: 'inherit', fontSize: '13px', cursor: 'pointer' }}
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
						style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', border: 'none', background: 'var(--accent-blue)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: busy ? 'wait' : 'pointer', alignSelf: 'flex-start' }}
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
