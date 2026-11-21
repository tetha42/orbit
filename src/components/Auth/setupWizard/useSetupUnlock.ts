import { useState, useEffect, useCallback, useRef } from 'react';
import {
	fetchSetupUnlockStatus,
	readSetupTokenFromUrl,
	requestSetupUnlock,
	scrubSetupTokenFromUrl,
} from './setupApi';

export function useSetupUnlock(onUnlocked: () => void) {
	const [authChecking, setAuthChecking] = useState(true);
	const [setupUnlocked, setSetupUnlocked] = useState(false);
	const [unlocking, setUnlocking] = useState(false);
	const [unlockError, setUnlockError] = useState<string | null>(null);
	const onUnlockedRef = useRef(onUnlocked);

	useEffect(() => {
		onUnlockedRef.current = onUnlocked;
	}, [onUnlocked]);

	useEffect(() => {
		let cancelled = false;

		async function initUnlock() {
			const urlToken = readSetupTokenFromUrl();

			if (urlToken) {
				const res = await requestSetupUnlock(urlToken).catch(() => ({
					ok: false,
					error: 'Could not verify setup token.',
				}));
				if (cancelled) return;
				if (res.ok) {
					scrubSetupTokenFromUrl();
					setSetupUnlocked(true);
					setUnlockError(null);
					setAuthChecking(false);
					onUnlockedRef.current();
					return;
				}
				setSetupUnlocked(false);
				setUnlockError(res.error || 'Invalid or missing setup token.');
				setAuthChecking(false);
				return;
			}

			const status = await fetchSetupUnlockStatus().catch(() => ({
				tokenRequired: true,
				unlocked: false,
			}));
			if (cancelled) return;
			if (!status.tokenRequired || status.unlocked) {
				setSetupUnlocked(true);
				setUnlockError(null);
				setAuthChecking(false);
				onUnlockedRef.current();
			} else {
				setSetupUnlocked(false);
				setAuthChecking(false);
			}
		}

		void initUnlock();
		return () => {
			cancelled = true;
		};
	}, []);

	const handleUnlockSetup = useCallback(async (tokenInput: string) => {
		const cleanToken = tokenInput.trim();
		if (!cleanToken) {
			setUnlockError('Please enter the setup token.');
			return;
		}
		setUnlocking(true);
		setUnlockError(null);
		try {
			const res = await requestSetupUnlock(cleanToken);
			if (res.ok) {
				scrubSetupTokenFromUrl();
				setSetupUnlocked(true);
				setUnlockError(null);
				onUnlockedRef.current();
			} else {
				setUnlockError(res.error || 'Invalid or missing setup token.');
			}
		} catch {
			setUnlockError('Failed to verify setup token.');
		} finally {
			setUnlocking(false);
		}
	}, []);

	const requireUnlock = useCallback((message: string) => {
		setSetupUnlocked(false);
		setUnlockError(message);
	}, []);

	return {
		authChecking,
		setupUnlocked,
		unlocking,
		unlockError,
		handleUnlockSetup,
		requireUnlock,
	};
}
