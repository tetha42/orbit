'use client';

import { useCallback, useEffect, useState } from 'react';
import { useWorkspace, type RegisterPayload } from '@/state/workspaceStore';
import type { SetupResponse } from '@/lib/setup';

export type AuthTab = 'login' | 'register';

/**
 * Owns every piece of state behind the login portal: which form is showing, the
 * two-factor step, and the shared feedback banners.
 */
export function useAuthFlow() {
	const { login, verify2fa, loginWithPasskey, register, sessionConflict, sessionIpMismatch } = useWorkspace();

	const [activeTab, setActiveTab] = useState<AuthTab>('login');
	const [loading, setLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [pendingNotice, setPendingNotice] = useState<string | null>(null);

	// Set once the password is accepted but an authenticator code is still required.
	const [challengeToken, setChallengeToken] = useState<string | null>(null);

	// Whether anyone can sign in yet.
	const [setup, setSetup] = useState<SetupResponse | null>(null);
	useEffect(() => {
		let cancelled = false;
		fetch('/api/setup', { cache: 'no-store' })
			.then((res) => (res.ok ? (res.json() as Promise<SetupResponse>) : null))
			.then((data) => {
				if (!cancelled && data && typeof data.hazir === 'boolean') setSetup(data);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, []);
	const setupIncomplete = setup?.hazir === false;

	const clearFeedback = useCallback(() => {
		setErrorMessage(null);
		setSuccessMessage(null);
		setPendingNotice(null);
	}, []);

	const switchTab = useCallback(
		(tab: AuthTab) => {
			setActiveTab(tab);
			clearFeedback();
		},
		[clearFeedback]
	);

	const submitLogin = useCallback(
		async (email: string, password: string) => {
			if (setupIncomplete) return;
			clearFeedback();
			setLoading(true);
			const result = await login(email, password);
			setLoading(false);

			if (result.success) return;

			if (result.require2fa && result.challengeToken) {
				setChallengeToken(result.challengeToken);
				return;
			}

			if (result.status === 'beklemede') {
				setPendingNotice(
					result.error || 'Your membership application is awaiting administrator approval.'
				);
			} else {
				setErrorMessage(result.error || 'Invalid email or password.');
			}
		},
		[clearFeedback, setupIncomplete, login]
	);

	const submitPasskey = useCallback(
		async (email: string) => {
			if (setupIncomplete) return;
			clearFeedback();

			if (!email.trim()) {
				setErrorMessage('Please enter your email address first to sign in with a Passkey.');
				return;
			}

			setLoading(true);
			const result = await loginWithPasskey(email.trim());
			setLoading(false);

			if (!result.success) {
				setErrorMessage(result.error || 'Passkey sign-in could not be completed.');
			}
		},
		[clearFeedback, setupIncomplete, loginWithPasskey]
	);

	const submitTwoFactor = useCallback(
		async (code: string) => {
			if (!challengeToken) return;
			setErrorMessage(null);
			setLoading(true);
			const result = await verify2fa(challengeToken, code);
			setLoading(false);

			if (!result.success) {
				setErrorMessage(result.error || 'Invalid verification code.');
				if (result.error?.includes('tekrar giriş') || result.error?.toLowerCase().includes('sign in again')) {
					setChallengeToken(null);
				}
			}
		},
		[challengeToken, verify2fa]
	);

	const submitRegister = useCallback(
		async (formData: RegisterPayload) => {
			if (setupIncomplete) return { success: false };
			clearFeedback();
			setLoading(true);
			const result = await register(formData);
			setLoading(false);

			if (result.success && !result.requireVerification) {
				setSuccessMessage(
					result.message ||
						'Your application has been received! You can sign in once approved by an administrator.'
				);
				setActiveTab('login');
			} else if (!result.success) {
				setErrorMessage(result.error || 'Registration failed.');
			} else if (result.mailQueued) {
				setSuccessMessage(
					result.message ||
						'E-posta servisi kullanılamıyor; doğrulama kodunuz yönetici onayına alındı.'
				);
			}
			return result;
		},
		[clearFeedback, setupIncomplete, register]
	);

	const cancelTwoFactor = useCallback(() => {
		setChallengeToken(null);
		setErrorMessage(null);
	}, []);

	return {
		activeTab,
		switchTab,
		loading,
		errorMessage,
		successMessage,
		pendingNotice,
		challengeToken,
		setup,
		setupIncomplete,
		sessionConflict,
		sessionIpMismatch,
		submitLogin,
		submitPasskey,
		submitTwoFactor,
		submitRegister,
		cancelTwoFactor,
		setSuccessMessage,
		setErrorMessage,
	};
}

export type AuthFlow = ReturnType<typeof useAuthFlow>;
