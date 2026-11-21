'use client';

import { useCallback } from 'react';
import type { SessionUser } from '@/types/session';
import { errorMessage } from '@/lib/errors';
import { emitSessionEvent } from '../events';
import type { RegisterPayload } from './types';

export function useSessionAuthActions(
	applySession: (user: SessionUser) => void,
	setIsLocked: (locked: boolean) => void
) {
	const login = useCallback(
		async (email: string, password: string) => {
			try {
				const res = await fetch('/api/auth/login', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email, password }),
				});
				const data = await res.json();
				if (res.ok && data.success) {
					applySession(data.user);
					return { success: true };
				}
				if (data.require2fa) {
					return { success: false, require2fa: true, challengeToken: data.challengeToken };
				}
				return { success: false, error: data.error, status: data.status };
			} catch (e) {
				return { success: false, error: errorMessage(e) || 'Sign in failed.' };
			}
		},
		[applySession]
	);

	const loginWithPasskey = useCallback(
		async (email: string) => {
			try {
				const optRes = await fetch('/api/auth/passkey/login/options', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email }),
				});
				const optData = await optRes.json();
				if (!optRes.ok || !optData.success) {
					return { success: false, error: optData.error || 'Could not start passkey sign-in.' };
				}

				const { startAuthentication } = await import('@simplewebauthn/browser');
				const assertion = await startAuthentication({ optionsJSON: optData.options });

				const verifyRes = await fetch('/api/auth/passkey/login/verify', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ challengeId: optData.challengeId, response: assertion }),
				});
				const verifyData = await verifyRes.json();
				if (!verifyRes.ok || !verifyData.success) {
					return { success: false, error: verifyData.error || 'Could not verify passkey.' };
				}

				applySession(verifyData.user);
				return { success: true };
			} catch (err) {
				const name = err instanceof Error ? err.name : ((err as { name?: string })?.name ?? '');
				if (name === 'NotAllowedError' || name === 'AbortError') {
					return { success: false, error: 'Passkey prompt was cancelled.' };
				}
				return { success: false, error: errorMessage(err) || 'Passkey sign-in failed.' };
			}
		},
		[applySession]
	);

	const verify2fa = useCallback(
		async (challengeToken: string, code: string) => {
			try {
				const res = await fetch('/api/auth/2fa/challenge', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ challengeToken, code }),
				});
				const data = await res.json();
				if (res.ok && data.success) {
					applySession(data.user);
					return { success: true };
				}
				return { success: false, error: data.error, code: data.code };
			} catch (e) {
				return { success: false, error: errorMessage(e) || 'Verification failed.' };
			}
		},
		[applySession]
	);

	const unlockWorkspace = useCallback(
		async (password: string) => {
			try {
				const res = await fetch('/api/auth/verify-password', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ password }),
				});
				const data = await res.json();
				if (res.ok && data.success) {
					setIsLocked(false);
					emitSessionEvent('unlock');
					return { success: true };
				}
				return { success: false, error: data.error || 'Incorrect password.' };
			} catch (e) {
				return { success: false, error: errorMessage(e) || 'Verification failed.' };
			}
		},
		[setIsLocked]
	);

	const register = useCallback(async (formData: RegisterPayload) => {
		try {
			const res = await fetch('/api/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(formData),
			});
			const data = await res.json();
			if (res.ok && data.success) {
				return {
					success: true,
					requireVerification: Boolean(data.requireVerification),
					mailQueued: Boolean(data.mailQueued),
					message: data.message,
				};
			}
			return { success: false, error: data.error, fieldErrors: data.fieldErrors };
		} catch (e) {
			return { success: false, error: errorMessage(e) || 'Registration failed.' };
		}
	}, []);

	return { login, loginWithPasskey, verify2fa, unlockWorkspace, register };
}
