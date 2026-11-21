'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { AuthorizeState } from './types';

export function useOAuthAuthorize() {
	const searchParams = useSearchParams();
	const clientId = searchParams.get('client_id');
	const redirectUri = searchParams.get('redirect_uri');
	const stateParam = searchParams.get('state') || '';
	const codeChallenge = searchParams.get('code_challenge') || undefined;
	const codeChallengeMethod = searchParams.get('code_challenge_method') || undefined;

	const [state, setState] = useState<AuthorizeState>(() => {
		if (!clientId || !redirectUri) {
			return {
				loading: false,
				error: 'Missing required OAuth 2.0 parameters (client_id and redirect_uri are mandatory).',
				requiresLogin: false,
				requiresConsent: false,
			};
		}
		return {
			loading: true,
			error: null,
			requiresLogin: false,
			requiresConsent: false,
		};
	});

	const [selectedScopes, setSelectedScopes] = useState<string[]>([
		'openid',
		'profile',
		'email',
		'academic',
		'roles',
	]);
	const [authVersion, setAuthVersion] = useState(0);

	const [loginEmail, setLoginEmail] = useState('');
	const [loginPassword, setLoginPassword] = useState('');
	const [loginBusy, setLoginBusy] = useState(false);
	const [loginError, setLoginError] = useState('');
	const [actionBusy, setActionBusy] = useState(false);

	useEffect(() => {
		if (!clientId || !redirectUri) return;
		let cancelled = false;

		const verify = async () => {
			try {
				const res = await fetch(`/api/oauth/authorize?${searchParams.toString()}`);
				const data = await res.json();
				if (cancelled) return;

				if (!res.ok) {
					setState({
						loading: false,
						error: data.error_description || data.error || 'Could not validate authorization request.',
						requiresLogin: false,
						requiresConsent: false,
					});
					return;
				}

				if (data.autoApproved && data.redirectUrl) {
					window.location.href = data.redirectUrl;
					return;
				}

				if (data.requiresLogin) {
					setState({
						loading: false,
						error: null,
						requiresLogin: true,
						requiresConsent: false,
						client: data.client,
					});
					return;
				}

				if (data.requiresConsent) {
					setState({
						loading: false,
						error: null,
						requiresLogin: false,
						requiresConsent: true,
						user: data.user,
						client: data.client,
						allowedScopes: data.allowedScopes,
						requestedScopes: data.requestedScopes,
						effectiveScopes: data.effectiveScopes,
						scope: data.scope,
					});
					const eff = Array.isArray(data.effectiveScopes) && data.effectiveScopes.length > 0
						? data.effectiveScopes
						: (data.scope ? data.scope.split(' ') : ['openid', 'profile']);
					setSelectedScopes(eff);
				}
			} catch (err) {
				if (cancelled) return;
				console.error('Authorize check error:', err);
				setState({
					loading: false,
					error: 'Network error while verifying OAuth request.',
					requiresLogin: false,
					requiresConsent: false,
				});
			}
		};

		void verify();
		return () => {
			cancelled = true;
		};
	}, [clientId, redirectUri, searchParams, authVersion]);

	const toggleScope = (scopeId: string) => {
		if (scopeId === 'openid' || scopeId === 'profile') return;
		setSelectedScopes((prev) =>
			prev.includes(scopeId) ? prev.filter((s) => s !== scopeId) : [...prev, scopeId]
		);
	};

	const isScopeEffective = (scopeId: string) => {
		return (state.effectiveScopes || []).includes(scopeId);
	};

	const blockedScopes = (state.requestedScopes || []).filter(
		(s) => !(state.allowedScopes || []).includes(s)
	);

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoginError('');
		setLoginBusy(true);
		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: loginEmail, password: loginPassword }),
			});
			const data = await res.json();
			if (res.ok) {
				setState((prev) => ({ ...prev, loading: true, error: null }));
				setAuthVersion((v) => v + 1);
			} else {
				setLoginError(data.error || 'Authentication failed.');
			}
		} catch {
			setLoginError('Could not connect to the authentication server.');
		} finally {
			setLoginBusy(false);
		}
	};

	const handleConsentDecision = async (approved: boolean) => {
		setActionBusy(true);
		try {
			const res = await fetch('/api/oauth/authorize', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					clientId,
					redirectUri,
					state: stateParam,
					codeChallenge,
					codeChallengeMethod,
					approved,
					grantedScopes: selectedScopes,
				}),
			});
			const data = await res.json();
			if (data.redirectUrl) {
				window.location.href = data.redirectUrl;
			} else {
				setState((prev) => ({ ...prev, error: data.error || 'Could not complete authorization.' }));
				setActionBusy(false);
			}
		} catch {
			setState((prev) => ({ ...prev, error: 'Network error while submitting consent.' }));
			setActionBusy(false);
		}
	};

	return {
		state,
		selectedScopes,
		blockedScopes,
		isScopeEffective,
		toggleScope,
		loginEmail,
		setLoginEmail,
		loginPassword,
		setLoginPassword,
		loginBusy,
		loginError,
		actionBusy,
		handleLogin,
		handleConsentDecision,
	};
}
