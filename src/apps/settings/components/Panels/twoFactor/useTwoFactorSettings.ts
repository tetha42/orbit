'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/core/i18n';
import { useSession } from '@/core/session';

export type TwoFactorPanelStep = 'loading' | 'idle' | 'setup' | 'recovery';

export interface TwoFactorStatus {
	enabled: boolean;
	required: boolean;
	pendingSetup: boolean;
	mustSetup: boolean;
}

interface UseTwoFactorSettingsOptions {
	autoStart: boolean;
	onEnrolled?: () => void;
}

export function useTwoFactorSettings({ autoStart, onEnrolled }: UseTwoFactorSettingsOptions) {
	const { t } = useI18n();
	const tRef = useRef(t);
	useEffect(() => {
		tRef.current = t;
	}, [t]);
	const { refreshSession } = useSession();
	const [step, setStep] = useState<TwoFactorPanelStep>('loading');
	const [status, setStatus] = useState<TwoFactorStatus | null>(null);
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
				setFeedback({ type: 'err', text: data.error || tRef.current('twofactorSetupError') });
			}
		} catch {
			setFeedback({ type: 'err', text: tRef.current('twofactorSetupError') });
		} finally {
			setBusy(false);
		}
	}, []);

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
		if (busy) return;
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
				const errMsg =
					data.code === 'INVALID_2FA_CODE'
						? t('twofactorVerifyError')
						: data.code === 'SETUP_REQUIRED'
							? t('twofactorSetupError')
							: data.error || t('twofactorVerifyError');
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
		if (busy) return;
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
				const errMsg =
					data.code === 'ROLE_REQUIRED'
						? t('twofactorRoleRequiredAlert')
						: data.error || t('twofactorDisableFailed');
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

	const retryLoadStatus = () => {
		setStatusUnavailable(false);
		setStep('loading');
		void loadStatus().finally(() => setStep('idle'));
	};

	return {
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
	};
}
