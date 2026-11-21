'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { SessionUser } from '@/types/session';
import { canManage as canManagePermission, canUse as canUsePermission } from '@/core/permissions';
import { probeSession, startSessionPolling } from './probe';
import { emitSessionEvent } from './events';
import type { RegisterPayload, SessionContextValue } from './provider/types';
import { useSessionAuthActions } from './provider/useSessionAuthActions';
import { useI18n } from '@/core/i18n';

export type { RegisterPayload, SessionContextValue };

const SessionContext = createContext<SessionContextValue | null>(null);

/** Who is signed in and what their role allows: password, 2FA, passkey, screen lock, and live session. */
export function SessionProvider({ children }: { children: React.ReactNode }) {
	const { setLanguage } = useI18n();
	const languageSyncRef = useRef<{ userId: string; language: 'tr' | 'en' } | null>(null);
	const [currentUserId, setCurrentUserId] = useState<string>('');
	const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
	const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
	const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
	const [sessionConflict, setSessionConflict] = useState<boolean>(false);
	const [sessionIpMismatch, setSessionIpMismatch] = useState<boolean>(false);
	const [connectionState, setConnectionState] = useState<'live' | 'reconnecting' | 'offline'>('offline');
	const [isLocked, setIsLocked] = useState<boolean>(false);
	const [isLockdownActive, setIsLockdownActive] = useState<boolean>(false);
	const [lockdownMessage, setLockdownMessage] = useState<string>('');

	const canUseApp = useCallback(
		(id: string) =>
			!!currentUser && (currentUser.mustSetup2fa ? id === 'settings' : canUsePermission(currentUser.permissions, id)),
		[currentUser]
	);
	const canManageApp = useCallback(
		(id: string) => !!currentUser && !currentUser.mustSetup2fa && canManagePermission(currentUser.permissions, id),
		[currentUser]
	);
	const isAdmin = !!currentUser?.admin && !currentUser.mustSetup2fa;

	const applySession = useCallback((user: SessionUser) => {
		// The account language wins on a fresh sign-in and when it changed on another
		// device; a local switch is not reverted by the next poll (it PATCHes the account
		// through LanguageSync, and the refreshed user then carries the new language).
		const preferred = user.preferredLanguage === 'tr' ? 'tr' : 'en';
		const synced = languageSyncRef.current;
		if (!synced || synced.userId !== user.id || synced.language !== preferred) {
			setLanguage(preferred);
			languageSyncRef.current = { userId: user.id, language: preferred };
		}
		setCurrentUser((prev) => (prev && JSON.stringify(prev) === JSON.stringify(user) ? prev : user));
		setCurrentUserId(user.id);
		setIsAuthenticated(true);
		setSessionConflict(false);
		setSessionIpMismatch(false);
		setIsLockdownActive(false);
	}, [setLanguage]);

	/**
	 * A probe that sees "ended" once may simply have raced a cookie rotation (a password
	 * change re-issues this browser's session while the stream's `session` event asks for a
	 * probe). Give the new cookie one tick to land before signing the member out.
	 */
	const probeWithGrace = useCallback(async () => {
		const first = await probeSession();
		if (first.kind !== 'ended') return first;
		await new Promise((resolve) => setTimeout(resolve, 350));
		return probeSession();
	}, []);

	const endSession = useCallback((conflict: boolean) => {
		languageSyncRef.current = null;
		if (conflict) setSessionConflict(true);
		setIsAuthenticated(false);
		setCurrentUser(null);
		setCurrentUserId('');
		setConnectionState('offline');
	}, []);

	const dismissLockdown = useCallback(() => {
		setIsLockdownActive(false);
	}, []);

	useEffect(() => {
		(async () => {
			const probe = await probeSession();
			if (probe.kind === 'user') applySession(probe.user);
			else if (probe.kind === 'lockdown') {
				setIsLockdownActive(true);
				setLockdownMessage(probe.message);
				endSession(false);
			} else if (probe.kind === 'ended') {
				if (probe.ipMismatch) setSessionIpMismatch(true);
				endSession(probe.conflict);
			} else if (probe.kind === 'failed') setIsAuthenticated(false);
			setIsAuthLoading(false);
		})();
	}, [applySession, endSession]);

	useEffect(() => {
		if (!isAuthenticated) return;
		return startSessionPolling(async () => {
			const probe = await probeWithGrace();
			if (probe.kind === 'user') applySession(probe.user);
			else if (probe.kind === 'lockdown') {
				setIsLockdownActive(true);
				setLockdownMessage(probe.message);
				endSession(false);
			} else if (probe.kind === 'ended') {
				if (probe.ipMismatch) setSessionIpMismatch(true);
				endSession(probe.conflict);
			}
		}, setConnectionState);
	}, [isAuthenticated, applySession, endSession, probeWithGrace]);

	const refreshSession = useCallback(async () => {
		const probe = await probeSession();
		if (probe.kind === 'user') applySession(probe.user);
	}, [applySession]);

	const lockWorkspace = useCallback(() => {
		setIsLocked(true);
		emitSessionEvent('lock');
	}, []);

	const { login, loginWithPasskey, verify2fa, unlockWorkspace, register } = useSessionAuthActions(
		applySession,
		setIsLocked
	);

	const logout = useCallback(async () => {
		try {
			await fetch('/api/auth/logout', { method: 'POST' });
		} catch {
			// ignore
		} finally {
			setIsAuthenticated(false);
			setCurrentUser(null);
			setCurrentUserId('');
			setSessionConflict(false);
			emitSessionEvent('logout');
		}
	}, []);

	const value = useMemo<SessionContextValue>(
		() => ({
			canUseApp,
			canManageApp,
			isAdmin,
			currentUserId,
			currentUser,
			isAuthenticated,
			isAuthLoading,
			sessionConflict,
			sessionIpMismatch,
			connectionState,
			login,
			verify2fa,
			loginWithPasskey,
			register,
			logout,
			isLocked,
			lockWorkspace,
			unlockWorkspace,
			refreshSession,
			isLockdownActive,
			lockdownMessage,
			dismissLockdown,
		}),
		[
			canUseApp,
			canManageApp,
			isAdmin,
			currentUserId,
			currentUser,
			isAuthenticated,
			isAuthLoading,
			sessionConflict,
			sessionIpMismatch,
			connectionState,
			login,
			verify2fa,
			loginWithPasskey,
			register,
			logout,
			isLocked,
			lockWorkspace,
			unlockWorkspace,
			refreshSession,
			isLockdownActive,
			lockdownMessage,
			dismissLockdown,
		]
	);

	return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** The signed-in member, what their role opens, and the sign-in / lock / refresh actions. */
export function useSession(): SessionContextValue {
	const ctx = useContext(SessionContext);
	if (!ctx) throw new Error('useSession must be used within a WorkspaceProvider');
	return ctx;
}
