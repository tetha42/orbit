'use client';

import { useEffect, useRef } from 'react';
import { useI18n } from './I18nProvider';
import { useSession } from '@/core/session';

/**
 * Persists a language change to the account so the next message (and the next
 * sign-in on another device) uses it. Reading the account language on sign-in is
 * handled by SessionProvider; this component only writes a member's new choice.
 */
export function LanguageSync() {
	const { language } = useI18n();
	const { currentUser, isAuthenticated, refreshSession } = useSession();
	const inFlight = useRef(false);

	useEffect(() => {
		if (!isAuthenticated || !currentUser || inFlight.current) return;
		if (currentUser.preferredLanguage === language) return;
		inFlight.current = true;
		fetch('/api/profile', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ preferredLanguage: language }),
		})
			.then((res) => {
				if (res.ok) return refreshSession();
			})
			.catch(() => {})
			.finally(() => {
				inFlight.current = false;
			});
	}, [language, currentUser, isAuthenticated, refreshSession]);

	return null;
}
