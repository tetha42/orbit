'use client';

import { useCallback, useEffect, useState } from 'react';
import { useWorkspace, type RegisterPayload } from '@/state/workspaceStore';
import type { KurulumYaniti } from '@/lib/kurulum';

export type AuthTab = 'login' | 'register';

/**
 * Owns every piece of state behind the login portal: which form is showing, the
 * two-factor step, and the shared feedback banners.
 */
export function useAuthFlow() {
	const { login, verify2fa, loginWithPasskey, register, sessionConflict } = useWorkspace();

	const [activeTab, setActiveTab] = useState<AuthTab>('login');
	const [loading, setLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [pendingNotice, setPendingNotice] = useState<string | null>(null);

	// Set once the password is accepted but an authenticator code is still required.
	const [challengeToken, setChallengeToken] = useState<string | null>(null);

	// Whether anyone can sign in yet.
	const [kurulum, setKurulum] = useState<KurulumYaniti | null>(null);
	useEffect(() => {
		let cancelled = false;
		fetch('/api/setup', { cache: 'no-store' })
			.then((res) => (res.ok ? (res.json() as Promise<KurulumYaniti>) : null))
			.then((data) => {
				if (!cancelled && data && typeof data.hazir === 'boolean') setKurulum(data);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, []);
	const kurulumEksik = kurulum?.hazir === false;

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
			if (kurulumEksik) return;
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
		[clearFeedback, kurulumEksik, login]
	);

	const submitPasskey = useCallback(
		async (email: string) => {
			if (kurulumEksik) return;
			clearFeedback();

			if (!email.trim()) {
				setErrorMessage('Please enter your email address first to sign in with a Passkey.');
				return;
			}

			setLoading(true);
			const result = await loginWithPasskey(email.trim());
			setLoading(false);

			if (result.require2fa && result.challengeToken) {
				setChallengeToken(result.challengeToken);
				return;
			}

			if (!result.success) {
				setErrorMessage(result.error || 'Passkey sign-in could not be completed.');
			}
		},
		[clearFeedback, kurulumEksik, loginWithPasskey]
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
			if (kurulumEksik) return { success: false };
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
			}
			return result;
		},
		[clearFeedback, kurulumEksik, register]
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
		kurulum,
		kurulumEksik,
		sessionConflict,
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
