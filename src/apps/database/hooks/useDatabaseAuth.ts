'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

interface UseDatabaseAuthOptions {
	passkeySession: boolean;
	connErrorText: string;
}

export function useDatabaseAuth({ passkeySession, connErrorText }: UseDatabaseAuthOptions) {
	const [is2FaVerified, setIs2FaVerified] = useState(false);
	const [isAutoUnlocking, setIsAutoUnlocking] = useState(passkeySession);
	const [autoUnlockError, setAutoUnlockError] = useState<string | null>(null);
	const [dbToken, setDbToken] = useState<string>('');
	const [idleExpired, setIdleExpired] = useState(false);

	const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const reauthAttemptedRef = useRef(false);

	const handlePasskeySubmit = useCallback(async () => {
		try {
			const res = await fetch('/api/database/auth', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ method: 'passkey' }),
			});
			const data = await res.json();
			if (res.ok && data.token) {
				reauthAttemptedRef.current = false;
				setAutoUnlockError(null);
				setDbToken(data.token);
				setIs2FaVerified(true);
				setIdleExpired(false);
				return { ok: true };
			}
			const errMsg = String(data.error || connErrorText);
			setAutoUnlockError(errMsg);
			return { ok: false, error: errMsg };
		} catch (err) {
			const errMsg = err instanceof Error ? err.message : connErrorText;
			setAutoUnlockError(errMsg);
			return { ok: false, error: errMsg };
		} finally {
			setIsAutoUnlocking(false);
		}
	}, [connErrorText]);

	const expireSession = useCallback(() => {
		if (passkeySession && !reauthAttemptedRef.current) {
			reauthAttemptedRef.current = true;
			setIsAutoUnlocking(true);
			setIs2FaVerified(false);
			setDbToken('');
			void handlePasskeySubmit();
			return;
		}
		setIs2FaVerified(false);
		setIsAutoUnlocking(false);
		setDbToken('');
		setIdleExpired(true);
	}, [passkeySession, handlePasskeySubmit]);

	const resetIdleTimer = useCallback(() => {
		if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
		idleTimerRef.current = setTimeout(() => {
			expireSession();
		}, IDLE_TIMEOUT_MS);
	}, [expireSession]);

	useEffect(() => {
		if (!is2FaVerified) return;
		resetIdleTimer();
		const handleActivity = () => resetIdleTimer();
		window.addEventListener('keydown', handleActivity);
		window.addEventListener('mousedown', handleActivity);
		return () => {
			if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
			window.removeEventListener('keydown', handleActivity);
			window.removeEventListener('mousedown', handleActivity);
		};
	}, [is2FaVerified, resetIdleTimer]);

	useEffect(() => {
		if (passkeySession && !is2FaVerified && !autoUnlockError) {
			void handlePasskeySubmit();
		}
	}, [passkeySession, is2FaVerified, autoUnlockError, handlePasskeySubmit]);

	const handleTwoFactorSubmit = async (code: string) => {
		try {
			const res = await fetch('/api/database/auth', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code }),
			});

			const data = await res.json();
			if (res.ok && data.token) {
				setDbToken(data.token);
				setIs2FaVerified(true);
				setIdleExpired(false);
				return { ok: true };
			}
			return { ok: false, error: data.error };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : connErrorText };
		}
	};

	return {
		is2FaVerified,
		isAutoUnlocking,
		autoUnlockError,
		dbToken,
		idleExpired,
		expireSession,
		handlePasskeySubmit,
		handleTwoFactorSubmit,
	};
}
