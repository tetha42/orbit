'use client';

import { useDialog } from '@/components/Common/DialogProvider';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { errorMessage } from '@/lib/errors';
import { PasskeyList, type PasskeySummary } from './PasskeyList';
import { PasskeyAddForm } from './PasskeyAddForm';

export function PasskeySettingsPanel() {
	const { t } = useI18n();
	const dialog = useDialog();
	const [passkeys, setPasskeys] = useState<PasskeySummary[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isBusy, setIsBusy] = useState(false);
	const [nickname, setNickname] = useState('');
	const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

	const load = useCallback(async () => {
		try {
			const res = await fetch('/api/auth/passkey');
			const data = await res.json();
			if (res.ok && data.success) {
				setPasskeys(data.passkeys ?? []);
			} else {
				setFeedback({ type: 'err', text: data.error || t('passkeyLoadError') });
			}
		} catch {
			setFeedback({ type: 'err', text: t('passkeyLoadError') });
		} finally {
			setIsLoading(false);
		}
	}, [t]);

	const supportsPasskeys = useMemo(() => typeof window !== 'undefined' && 'PublicKeyCredential' in window, []);

	useEffect(() => {
		let isMounted = true;
		void fetch('/api/auth/passkey')
			.then((res) => res.json())
			.then((data) => {
				if (!isMounted) return;
				if (data.success) {
					setPasskeys(data.passkeys ?? []);
				} else {
					setFeedback({ type: 'err', text: data.error || t('passkeyLoadError') });
				}
			})
			.catch(() => {
				if (isMounted) setFeedback({ type: 'err', text: t('passkeyLoadError') });
			})
			.finally(() => {
				if (isMounted) setIsLoading(false);
			});
		return () => {
			isMounted = false;
		};
	}, [t]);

	const addPasskey = async () => {
		setIsBusy(true);
		setFeedback(null);
		try {
			const { startRegistration } = await import('@simplewebauthn/browser');

			const optRes = await fetch('/api/auth/passkey/register/options', { method: 'POST' });
			const optData = await optRes.json();
			if (!optRes.ok || !optData.success) {
				setFeedback({ type: 'err', text: optData.error || t('passkeyRegisterError') });
				return;
			}

			const attestation = await startRegistration({ optionsJSON: optData.options });

			const verifyRes = await fetch('/api/auth/passkey/register/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					challengeId: optData.challengeId,
					response: attestation,
					nickname,
				}),
			});
			const verifyData = await verifyRes.json();
			if (!verifyRes.ok || !verifyData.success) {
				setFeedback({ type: 'err', text: verifyData.error || t('passkeySaveFailed') });
				return;
			}

			setNickname('');
			setFeedback({ type: 'ok', text: t('passkeyAdded') });
			await load();
		} catch (err: unknown) {
			const name = err && typeof err === 'object' && 'name' in err ? String((err as { name?: unknown }).name) : '';
			if (name === 'NotAllowedError' || name === 'AbortError') {
				setFeedback({ type: 'err', text: t('passkeyCancelled') });
			} else if (name === 'InvalidStateError') {
				setFeedback({ type: 'err', text: t('passkeyDeviceAlreadyRegistered') });
			} else {
				setFeedback({ type: 'err', text: errorMessage(err) || t('passkeyAddFailed') });
			}
		} finally {
			setIsBusy(false);
		}
	};

	const removePasskey = async (id: string, label: string) => {
		const confirmed = await dialog.confirm({
			message: fill(t('passkeyRemoveConfirmMsg'), { label }),
			tone: 'danger',
			confirmLabel: t('passkeyRemove'),
		});
		if (!confirmed) return;

		setIsBusy(true);
		setFeedback(null);
		try {
			const res = await fetch('/api/auth/passkey', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id }),
			});
			const data = await res.json();
			if (res.ok && data.success) {
				setFeedback({ type: 'ok', text: t('passkeyRemoved') });
				await load();
			} else {
				setFeedback({ type: 'err', text: data.error || t('passkeyRemoveFailed') });
			}
		} catch {
			setFeedback({ type: 'err', text: t('passkeyRemoveFailed') });
		} finally {
			setIsBusy(false);
		}
	};

	if (isLoading) {
		return (
			<div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.6, fontSize: '13px' }}>
				<Loader2 size={16} />
				<span>{t('loading')}</span>
			</div>
		);
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
			{feedback && (
				<div
					style={{
						padding: '12px 16px',
						borderRadius: '10px',
						background: feedback.type === 'ok' ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 69, 58, 0.15)',
						border: `1px solid ${feedback.type === 'ok' ? 'rgba(52, 199, 89, 0.4)' : 'rgba(255, 69, 58, 0.4)'}`,
						color: feedback.type === 'ok' ? '#34c759' : '#ff453a',
						fontSize: '13px',
						display: 'flex',
						alignItems: 'center',
						gap: '8px',
					}}
				>
					{feedback.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
					<span>{feedback.text}</span>
				</div>
			)}

			{!supportsPasskeys && (
				<div
					style={{
						padding: '12px 16px',
						borderRadius: '10px',
						background: 'rgba(255, 159, 10, 0.15)',
						border: '1px solid rgba(255, 159, 10, 0.4)',
						color: '#ff9f0a',
						fontSize: '13px',
					}}
				>
					{t('passkeyNotSupported')}
				</div>
			)}

			<p style={{ fontSize: '13px', opacity: 0.75, lineHeight: 1.5, margin: 0 }}>
				{t('passkeyDescription')}
			</p>

			<PasskeyList passkeys={passkeys} isBusy={isBusy} onRemove={removePasskey} />

			<PasskeyAddForm
				supportsPasskeys={supportsPasskeys}
				nickname={nickname}
				isBusy={isBusy}
				onNicknameChange={setNickname}
				onAddPasskey={addPasskey}
			/>
		</div>
	);
}
