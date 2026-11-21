'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/core/i18n';
import { useSound } from '@/core/sound';

interface UseAccountEmailChangeOptions {
	onChanged: (text: string) => Promise<void>;
}

export function useAccountEmailChange({ onChanged }: UseAccountEmailChangeOptions) {
	const { t } = useI18n();
	const tRef = useRef(t);
	useEffect(() => {
		tRef.current = t;
	}, [t]);
	const { playSystemSound } = useSound();
	const [emailOpen, setEmailOpen] = useState(false);
	const [emailStep, setEmailStep] = useState<'request' | 'verify'>('request');
	const [newEmail, setNewEmail] = useState('');
	const [emailCode, setEmailCode] = useState('');
	const [emailBusy, setEmailBusy] = useState(false);
	const [emailMsg, setEmailMsg] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);

	useEffect(() => {
		if (!emailOpen) return;
		let cancelled = false;
		fetch('/api/profile/email', { cache: 'no-store' })
			.then((res) => (res.ok ? res.json() : null))
			.then((payload) => {
				if (cancelled || !payload?.pending) return;
				setEmailStep('verify');
				setNewEmail(payload.pending.newEmail ?? '');
				setEmailMsg({ text: tRef.current('acEmailPending'), tone: 'ok' });
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [emailOpen]);

	const closeEmailChange = () => {
		setEmailOpen(false);
		setEmailStep('request');
		setNewEmail('');
		setEmailCode('');
		setEmailMsg(null);
	};

	const requestEmailCode = async () => {
		if (!newEmail.trim()) {
			setEmailMsg({ text: t('acEmailChangeFailed'), tone: 'err' });
			return;
		}
		setEmailBusy(true);
		setEmailMsg(null);
		try {
			const res = await fetch('/api/profile/email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ newEmail: newEmail.trim() }),
			});
			const payload = await res.json().catch(() => null);
			if (!res.ok) throw new Error(payload?.error || t('acEmailChangeFailed'));
			setEmailStep('verify');
			setEmailCode('');
			setEmailMsg({ text: t('acEmailCodeSent'), tone: 'ok' });
		} catch (error) {
			setEmailMsg({
				text: error instanceof Error ? error.message : t('acEmailChangeFailed'),
				tone: 'err',
			});
		} finally {
			setEmailBusy(false);
		}
	};

	const confirmEmailCode = async () => {
		if (!/^\d{6}$/.test(emailCode.trim())) {
			setEmailMsg({ text: t('acVerificationCode'), tone: 'err' });
			return;
		}
		setEmailBusy(true);
		setEmailMsg(null);
		try {
			const res = await fetch('/api/profile/email/confirm', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code: emailCode.trim() }),
			});
			const payload = await res.json().catch(() => null);
			if (!res.ok) throw new Error(payload?.error || t('acEmailChangeFailed'));
			closeEmailChange();
			playSystemSound();
			await onChanged(t('acEmailChanged'));
		} catch (error) {
			setEmailMsg({
				text: error instanceof Error ? error.message : t('acEmailChangeFailed'),
				tone: 'err',
			});
		} finally {
			setEmailBusy(false);
		}
	};

	return {
		emailOpen,
		setEmailOpen,
		emailStep,
		newEmail,
		setNewEmail,
		emailCode,
		setEmailCode,
		emailBusy,
		emailMsg,
		closeEmailChange,
		requestEmailCode,
		confirmEmailCode,
	};
}
