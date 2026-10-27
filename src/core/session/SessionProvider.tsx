'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { SessionUser } from '@/types/session';
import { canManage as izinYonet, canUse as izinKullan } from '@/core/permissions';
import { errorMessage } from '@/lib/errors';
import { probeSession, startSessionPolling } from './probe';
import { emitSessionEvent } from './events';

/** Fields the registration form submits. */
export interface RegisterPayload {
	ad: string;
	soyad: string;
	ogrenciNo: string;
	bolum: string;
	sinif: number;
	email: string;
	password: string;
	verificationCode?: string;
	hp_website?: string;
}

export interface SessionContextValue {
	/** The role opens this app (and a required second factor is in place). */
	canUseApp: (appId: string) => boolean;
	/** The role manages this app. */
	canManageApp: (appId: string) => boolean;
	/** Holds the built-in admin role. */
	isAdmin: boolean;
	currentUserId: string;
	currentUser: SessionUser | null;
	isAuthenticated: boolean;
	isAuthLoading: boolean;
	sessionConflict: boolean;
	login: (
		email: string,
		password: string
	) => Promise<{
		success: boolean;
		error?: string;
		status?: string;
		require2fa?: boolean;
		challengeToken?: string;
	}>;
	/** Second step of a two-factor login: redeems the challenge with a TOTP or recovery code. */
	verify2fa: (challengeToken: string, code: string) => Promise<{ success: boolean; error?: string }>;
	/**
	 * Signs in with a passkey. Runs the whole WebAuthn ceremony, so the caller only
	 * needs the member's e-mail address.
	 */
	loginWithPasskey: (email: string) => Promise<{ success: boolean; error?: string; require2fa?: boolean; challengeToken?: string }>;
	register: (formData: RegisterPayload) => Promise<{ success: boolean; message?: string; error?: string; requireVerification?: boolean }>;
	logout: () => Promise<void>;
	/**
	 * Screen lock. Hides the workspace behind a password prompt without ending the
	 * session, so a member can step away from a shared machine.
	 */
	isLocked: boolean;
	lockWorkspace: () => void;
	unlockWorkspace: (password: string) => Promise<{ success: boolean; error?: string }>;
	/**
	 * Re-reads the current user from the server.
	 *
	 * Needed after enroling a second factor, because `mustSetup2fa` lives on the
	 * user object — without this the enforcement modal keeps showing after setup.
	 */
	refreshSession: () => Promise<void>;
	/** DEFCON 1 hard lockdown active. */
	isLockdownActive: boolean;
	lockdownMessage: string;
	dismissLockdown: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Who is signed in and what their role allows: password, two-factor and passkey
 * sign-in, the screen lock, and the live session (the first check on load and the
 * 15 s poll). The server owns every fact here — the client keeps nothing it could
 * outlive the session with.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
	const [currentUserId, setCurrentUserId] = useState<string>('');
	const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
	const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
	const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
	const [sessionConflict, setSessionConflict] = useState<boolean>(false);
	const [isLocked, setIsLocked] = useState<boolean>(false);
	const [isLockdownActive, setIsLockdownActive] = useState<boolean>(false);
	const [lockdownMessage, setLockdownMessage] = useState<string>('');

	// Nothing is open before the session says what the role allows. While a
	// required second factor is missing only Settings opens (to enrol it).
	const canUseApp = useCallback(
		(id: string) => !!currentUser && (currentUser.mustSetup2fa ? id === 'settings' : izinKullan(currentUser.izinler, id)),
		[currentUser]
	);
	const canManageApp = useCallback(
		(id: string) => !!currentUser && !currentUser.mustSetup2fa && izinYonet(currentUser.izinler, id),
		[currentUser]
	);
	const isAdmin = !!currentUser?.admin && !currentUser.mustSetup2fa;

	/**
	 * Adopts a server-issued user object as the active session.
	 * Used by both the password step, the two-factor step and the reload probe so
	 * role and identity always come from the server in exactly one place.
	 */
	const applySession = useCallback((user: SessionUser) => {
		// The poll re-applies the same user every 15 s; keeping the old object when
		// nothing changed spares every consumer a re-render.
		setCurrentUser((prev) => (prev && JSON.stringify(prev) === JSON.stringify(user) ? prev : user));
		setCurrentUserId(user.id);
		setIsAuthenticated(true);
		setSessionConflict(false);
		setIsLockdownActive(false);
	}, []);

	/** The server says the session is over (401/403): back to the portal. */
	const endSession = useCallback((conflict: boolean) => {
		if (conflict) setSessionConflict(true);
		setIsAuthenticated(false);
		setCurrentUser(null);
		setCurrentUserId('');
	}, []);

	const dismissLockdown = useCallback(() => {
		setIsLockdownActive(false);
	}, []);

	// First check on load: who does the cookie belong to?
	useEffect(() => {
		(async () => {
			const probe = await probeSession();
			if (probe.kind === 'user') applySession(probe.user);
			else if (probe.kind === 'lockdown') {
				setIsLockdownActive(true);
				setLockdownMessage(probe.message);
				endSession(false);
			} else if (probe.kind === 'ended') endSession(probe.conflict);
			else if (probe.kind === 'failed') setIsAuthenticated(false);
			setIsAuthLoading(false);
		})();
	}, [applySession, endSession]);

	// The live session: the single-device rule (a second sign-in elsewhere ends this
	// one) and role changes — an edited role reaches open sessions at once over the live
	// stream (core/session/live), or within 15 s by polling when it is down, and
	// the windows of apps it no longer opens close (core/windows). A 401 or 403 mid-
	// session (taken over, suspended, rejected) drops the user back to the portal.
	useEffect(() => {
		if (!isAuthenticated) return;
		return startSessionPolling(async () => {
			const probe = await probeSession();
			if (probe.kind === 'user') applySession(probe.user);
			else if (probe.kind === 'lockdown') {
				setIsLockdownActive(true);
				setLockdownMessage(probe.message);
				endSession(false);
			} else if (probe.kind === 'ended') endSession(probe.conflict);
			// Network blips and empty answers change nothing.
		});
	}, [isAuthenticated, applySession, endSession]);

	/**
	 * Re-fetches the signed-in user.
	 *
	 * The first check also flips `isAuthLoading`, which would blank the workspace —
	 * so this is a lighter probe that only refreshes the user object.
	 */
	const refreshSession = useCallback(async () => {
		const probe = await probeSession();
		// A failed refresh is not worth disturbing the session over.
		if (probe.kind === 'user') applySession(probe.user);
	}, [applySession]);

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
				// Password accepted, second factor still outstanding — no session yet.
				if (data.require2fa) {
					return {
						success: false,
						require2fa: true,
						challengeToken: data.challengeToken,
					};
				}
				return { success: false, error: data.error, status: data.status };
			} catch (e) {
				return { success: false, error: errorMessage(e) || 'Giriş yapılamadı' };
			}
		},
		[applySession]
	);

	/**
	 * Passkey sign-in.
	 *
	 * The WebAuthn ceremony (options → authenticator prompt → assertion) happens
	 * here so the login form stays presentational. A successful assertion is
	 * already multi-factor, so it completes the session directly.
	 */
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
					return { success: false, error: optData.error || 'Passkey ile giriş başlatılamadı.' };
				}

				// Loaded lazily: the WebAuthn browser API is only needed at this moment.
				const { startAuthentication } = await import('@simplewebauthn/browser');
				const assertion = await startAuthentication({ optionsJSON: optData.options });

				const verifyRes = await fetch('/api/auth/passkey/login/verify', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ challengeId: optData.challengeId, response: assertion }),
				});
				const verifyData = await verifyRes.json();
				// A role that requires two-factor auth still wants the authenticator code after the passkey.
				if (verifyRes.ok && verifyData.require2fa && verifyData.challengeToken) {
					return { success: false, require2fa: true, challengeToken: verifyData.challengeToken };
				}
				if (!verifyRes.ok || !verifyData.success) {
					return { success: false, error: verifyData.error || 'Passkey doğrulanamadı.' };
				}

				applySession(verifyData.user);
				return { success: true };
			} catch (err) {
				// Dismissing the authenticator prompt is the common case, not a fault.
				const name = err?.name ?? '';
				if (name === 'NotAllowedError' || name === 'AbortError') {
					return { success: false, error: 'Passkey işlemi iptal edildi.' };
				}
				return { success: false, error: errorMessage(err) || 'Passkey ile giriş yapılamadı.' };
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
				return { success: false, error: data.error };
			} catch (e) {
				return { success: false, error: errorMessage(e) || 'Doğrulama yapılamadı' };
			}
		},
		[applySession]
	);

	const lockWorkspace = useCallback(() => {
		setIsLocked(true);
		// Whatever lists people's names and deadlines must not stay readable over the lock screen.
		emitSessionEvent('lock');
	}, []);

	const unlockWorkspace = useCallback(async (password: string) => {
		try {
			// Verifies without issuing a new session, so the lock does not disturb the
			// member's other devices and is not diverted by two-factor.
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
			return { success: false, error: data.error || 'Şifre hatalı.' };
		} catch (e) {
			return { success: false, error: errorMessage(e) || 'Doğrulama yapılamadı.' };
		}
	}, []);

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
					message: data.message,
				};
			}
			return { success: false, error: data.error };
		} catch (e) {
			return { success: false, error: errorMessage(e) || 'Kayıt yapılamadı' };
		}
	}, []);

	const logout = useCallback(async () => {
		try {
			await fetch('/api/auth/logout', { method: 'POST' });
		} catch {
			// ignore
		} finally {
			// Drop every trace of the previous identity — a stale role must never be
			// restored from the saved workspace on the next page load.
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
		[canUseApp, canManageApp, isAdmin, currentUserId, currentUser, isAuthenticated, isAuthLoading, sessionConflict, login, verify2fa, loginWithPasskey, register, logout, isLocked, lockWorkspace, unlockWorkspace, refreshSession, isLockdownActive, lockdownMessage, dismissLockdown]
	);

	return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** The signed-in member, what their role opens, and the sign-in / lock / refresh actions. */
export function useSession(): SessionContextValue {
	const ctx = useContext(SessionContext);
	if (!ctx) throw new Error('useSession must be used within a WorkspaceProvider');
	return ctx;
}
