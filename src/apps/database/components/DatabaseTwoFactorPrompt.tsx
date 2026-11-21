'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '@/core/i18n';
import { useWindowActions } from '@/core/windows';
import { PasskeyVerifyView } from './auth/PasskeyVerifyView';
import { TwoFactorSetupRequiredView } from './auth/TwoFactorSetupRequiredView';
import { TotpPromptView } from './auth/TotpPromptView';

interface DatabaseTwoFactorPromptProps {
	isLight: boolean;
	twoFactorEnabled: boolean;
	passkeySession?: boolean;
	idleExpired?: boolean;
	initialError?: string | null;
	onSubmit: (code: string) => Promise<{ ok: boolean; error?: string }>;
	onPasskey?: () => Promise<{ ok: boolean; error?: string }>;
}

export function DatabaseTwoFactorPrompt({
	isLight,
	twoFactorEnabled,
	passkeySession,
	idleExpired,
	initialError,
	onSubmit,
	onPasskey,
}: DatabaseTwoFactorPromptProps) {
	const { t } = useI18n();
	const { openApp } = useWindowActions();

	const [code, setCode] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const submitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (twoFactorEnabled && inputRef.current) {
			inputRef.current.focus();
		}
	}, [twoFactorEnabled]);

	useEffect(() => {
		return () => {
			if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
		};
	}, []);

	const handleSubmit = async (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		const clean = code.trim().replace(/\s+/g, '');
		if (clean.length < 6 || loading) return;

		setLoading(true);
		setError(null);
		try {
			const res = await onSubmit(clean);
			if (!res.ok) {
				setError(res.error || t('db2faCodeError'));
				setCode('');
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : t('db2faGenericError'));
		} finally {
			setLoading(false);
		}
	};

	const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
		setCode(val);
		setError(null);
		if (submitTimerRef.current) {
			clearTimeout(submitTimerRef.current);
			submitTimerRef.current = null;
		}
		if (val.length === 6) {
			submitTimerRef.current = setTimeout(() => {
				const form = inputRef.current?.form;
				if (form) form.requestSubmit();
			}, 50);
		}
	};

	const handlePasskeyVerify = () => {
		if (!onPasskey) return;
		setLoading(true);
		setError(null);
		void onPasskey()
			.then((res) => {
				if (!res.ok) setError(res.error || t('db2faGenericError'));
			})
			.finally(() => setLoading(false));
	};

	if (passkeySession) {
		return (
			<PasskeyVerifyView
				isLight={isLight}
				loading={loading}
				error={error ?? initialError ?? null}
				onVerify={handlePasskeyVerify}
			/>
		);
	}

	if (!twoFactorEnabled) {
		return (
			<TwoFactorSetupRequiredView
				isLight={isLight}
				onOpenSettings={() => openApp('settings')}
			/>
		);
	}

	return (
		<TotpPromptView
			isLight={isLight}
			idleExpired={idleExpired}
			code={code}
			loading={loading}
			error={error}
			inputRef={inputRef}
			onCodeChange={handleCodeChange}
			onSubmit={handleSubmit}
		/>
	);
}
