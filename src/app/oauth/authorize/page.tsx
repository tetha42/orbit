'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Shield, User, Mail, ShieldAlert, ArrowRight, Loader2, GraduationCap, Award, Info } from 'lucide-react';
import { useIsMounted } from '@/lib/client/useClientValue';
import styles from './oauth.module.css';

interface AuthorizeUserData {
	id: string;
	ad?: string;
	soyad?: string;
	adSoyad: string;
	email: string;
	ogrenciNo?: string;
	bolum?: string;
	sinif?: number;
	profilFoto?: string | null;
	bio?: string | null;
	rolAd?: string;
	xp?: number;
}

interface AuthorizeState {
	loading: boolean;
	error: string | null;
	requiresLogin: boolean;
	requiresConsent: boolean;
	user?: AuthorizeUserData;
	client?: {
		id: string;
		ad: string;
		aciklama: string;
		logoUrl?: string;
		guvenilir?: boolean;
	};
	allowedScopes?: string[];
	requestedScopes?: string[];
	effectiveScopes?: string[];
	scope?: string;
}

function AuthorizeContent() {
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

	// Inline login state if not logged in
	const [loginEmail, setLoginEmail] = useState('');
	const [loginPassword, setLoginPassword] = useState('');
	const [loginBusy, setLoginBusy] = useState(false);
	const [loginError, setLoginError] = useState('');

	// Action busy state
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

	const isMounted = useIsMounted();

	if (!isMounted) {
		return <main suppressHydrationWarning className={styles.viewport} />;
	}

	return (
		<main suppressHydrationWarning className={styles.viewport}>
			<div suppressHydrationWarning className={styles.panel}>
				<header className={styles.header}>
					<span>ORBIT // TETHA42</span>
					<span style={{ color: '#fafafa' }}>OAUTH 2.0 / OIDC</span>
				</header>

				<div className={styles.body}>
					{/* Top Brand Identity */}
					<div className={styles.brandRow}>
						<div className={styles.brandIcon}>
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img
								src="/assets/img/logo-girdap.svg"
								alt="Orbit Community OS"
								style={{ width: '24px', height: '24px' }}
							/>
						</div>
						<div>
							<div className={styles.brandTitle}>Orbit Identity Provider</div>
							<div className={styles.brandSub}>Federated Single Sign-On & Scope Consent</div>
						</div>
					</div>

					{/* Loading State */}
					{state.loading && (
						<div
							style={{
								textAlign: 'center',
								padding: '32px 0',
								color: '#a1a1aa',
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								gap: '12px',
							}}
						>
							<Loader2 size={28} className="spin" style={{ animation: 'spin 1s linear infinite', color: '#fafafa' }} />
							<div style={{ fontSize: '13px' }}>Validating client authorization request...</div>
						</div>
					)}

					{/* Error State */}
					{state.error && (
						<div
							style={{
								padding: '12px 14px',
								backgroundColor: 'rgba(239, 68, 68, 0.1)',
								border: '1px solid rgba(239, 68, 68, 0.35)',
								borderRadius: '6px',
								color: '#f87171',
								fontSize: '13px',
								display: 'flex',
								alignItems: 'center',
								gap: '10px',
							}}
						>
							<ShieldAlert size={18} style={{ flexShrink: 0 }} />
							<span>{state.error}</span>
						</div>
					)}

					{/* Login Required */}
					{state.requiresLogin && (
						<form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
							<div style={{ fontSize: '13.5px', color: '#a1a1aa', lineHeight: 1.5 }}>
								<strong style={{ color: '#fafafa' }}>{state.client?.ad || 'An external application'}</strong> is requesting access to your Orbit account. Sign in to continue:
							</div>

							{loginError && (
								<div
									style={{
										padding: '8px 12px',
										borderRadius: '6px',
										backgroundColor: 'rgba(239, 68, 68, 0.1)',
										border: '1px solid rgba(239, 68, 68, 0.3)',
										color: '#f87171',
										fontSize: '12px',
									}}
								>
									{loginError}
								</div>
							)}

							<label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
								<span style={{ fontSize: '12px', color: '#a1a1aa', fontWeight: 500 }}>Email Address</span>
								<input
									type="email"
									required
									value={loginEmail}
									onChange={(e) => setLoginEmail(e.target.value)}
									placeholder="member@domain.org"
									className={styles.input}
								/>
							</label>

							<label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
								<span style={{ fontSize: '12px', color: '#a1a1aa', fontWeight: 500 }}>Password</span>
								<input
									type="password"
									required
									value={loginPassword}
									onChange={(e) => setLoginPassword(e.target.value)}
									placeholder="••••••••••••"
									className={styles.input}
								/>
							</label>

							<button
								type="submit"
								disabled={loginBusy}
								className={styles.approveBtn}
								style={{ marginTop: '4px' }}
							>
								{loginBusy ? 'Signing In...' : 'Sign In & Continue'}
							</button>
						</form>
					)}

					{/* Consent Prompt */}
					{state.requiresConsent && (
						<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
							{/* Target App Card */}
							<div className={styles.clientCard}>
								<div className={styles.clientIcon}>
									<Shield size={18} />
								</div>
								<div style={{ flex: 1, minWidth: 0 }}>
									<div style={{ fontWeight: 600, fontSize: '15px', color: '#fafafa' }}>{state.client?.ad}</div>
									{state.client?.aciklama && (
										<div style={{ fontSize: '12px', color: '#a1a1aa', marginTop: '2px', lineHeight: 1.4 }}>
											{state.client.aciklama}
										</div>
									)}
								</div>
							</div>

							{/* Notice Banner */}
							<div className={styles.notice}>
								<strong style={{ color: '#fafafa' }}>Scope Selection:</strong> Review the claims requested by this application. You can toggle optional scopes before granting access.
							</div>

							{/* Scope Permission Cards with Live Preview */}
							<div className={styles.scopeList}>
								{/* 1. Profile Scope (Mandatory) */}
								<div className={styles.scopeCard}>
									<div className={styles.scopeHeader}>
										<div className={styles.scopeTitle}>
											<User size={14} />
											<span>Core Identity & Profile</span>
										</div>
										<span className={styles.scopeTag}>REQUIRED</span>
									</div>

									<div
										className={styles.scopePreview}
										style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}
									>
										<div>
											<span>Full Name: </span>
											<strong style={{ color: '#fafafa' }}>{state.user?.adSoyad}</strong>
										</div>
										<div>
											<span>Subject ID: </span>
											<code style={{ color: '#fafafa', fontSize: '10.5px' }}>{state.user?.id.slice(0, 12)}…</code>
										</div>
									</div>
								</div>

								{/* 2. Email Scope (Toggleable if requested & allowed) */}
								{isScopeEffective('email') && (
									<label
										className={`${styles.scopeCard} ${selectedScopes.includes('email') ? styles.scopeCardActive : ''}`}
										style={{ cursor: 'pointer' }}
									>
										<div className={styles.scopeHeader}>
											<div className={styles.scopeTitle}>
												<input
													type="checkbox"
													checked={selectedScopes.includes('email')}
													onChange={() => toggleScope('email')}
													style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#fafafa' }}
												/>
												<Mail size={14} />
												<span>Email Contact Address</span>
											</div>
											<span className={styles.scopeTag}>OPTIONAL</span>
										</div>

										<div className={styles.scopePreview}>
											<span>Email: </span>
											<strong style={{ color: '#fafafa' }}>{state.user?.email}</strong>
										</div>
									</label>
								)}

								{/* 3. Academic / Track Scope (Toggleable if requested & allowed) */}
								{isScopeEffective('academic') && (
									<label
										className={`${styles.scopeCard} ${selectedScopes.includes('academic') ? styles.scopeCardActive : ''}`}
										style={{ cursor: 'pointer' }}
									>
										<div className={styles.scopeHeader}>
											<div className={styles.scopeTitle}>
												<input
													type="checkbox"
													checked={selectedScopes.includes('academic')}
													onChange={() => toggleScope('academic')}
													style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#fafafa' }}
												/>
												<GraduationCap size={14} />
												<span>Member ID & Track Information</span>
											</div>
											<span className={styles.scopeTag}>OPTIONAL</span>
										</div>

										<div
											className={styles.scopePreview}
											style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '6px' }}
										>
											<div>
												<span>Member ID: </span>
												<strong style={{ color: '#fafafa' }}>{state.user?.ogrenciNo || '—'}</strong>
											</div>
											<div>
												<span>Track: </span>
												<strong style={{ color: '#fafafa' }}>{state.user?.bolum || '—'}</strong>
											</div>
											<div>
												<span>Level: </span>
												<strong style={{ color: '#fafafa' }}>
													{state.user?.sinif ? `Level ${state.user.sinif}` : '—'}
												</strong>
											</div>
										</div>
									</label>
								)}

								{/* 4. Roles Scope (Toggleable if requested & allowed) */}
								{isScopeEffective('roles') && (
									<label
										className={`${styles.scopeCard} ${selectedScopes.includes('roles') ? styles.scopeCardActive : ''}`}
										style={{ cursor: 'pointer' }}
									>
										<div className={styles.scopeHeader}>
											<div className={styles.scopeTitle}>
												<input
													type="checkbox"
													checked={selectedScopes.includes('roles')}
													onChange={() => toggleScope('roles')}
													style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#fafafa' }}
												/>
												<Award size={14} />
												<span>Community Role & Reputation</span>
											</div>
											<span className={styles.scopeTag}>OPTIONAL</span>
										</div>

										<div
											className={styles.scopePreview}
											style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}
										>
											<div>
												<span>Role: </span>
												<strong style={{ color: '#fafafa' }}>{state.user?.rolAd || 'Member'}</strong>
											</div>
											<div>
												<span>Reputation: </span>
												<strong style={{ color: '#fafafa' }}>{state.user?.xp ?? 0} XP</strong>
											</div>
										</div>
									</label>
								)}
							</div>

							{/* Admin Ceiling Policy Notice if any requested scope was blocked */}
							{blockedScopes.length > 0 && (
								<div
									style={{
										padding: '8px 12px',
										borderRadius: '6px',
										backgroundColor: 'rgba(245, 158, 11, 0.08)',
										border: '1px solid rgba(245, 158, 11, 0.3)',
										fontSize: '11.5px',
										color: '#fbbf24',
										display: 'flex',
										alignItems: 'center',
										gap: '8px',
									}}
								>
									<Info size={14} style={{ flexShrink: 0 }} />
									<span>
										Excluded by administrator scope ceiling policy: <code>{blockedScopes.join(', ')}</code>
									</span>
								</div>
							)}

							{/* Logged in as User */}
							<div className={styles.sessionBar}>
								<span style={{ color: '#a1a1aa' }}>Authenticated Session</span>
								<strong style={{ color: '#fafafa' }}>
									{state.user?.adSoyad} <span style={{ color: '#a1a1aa', fontWeight: 400 }}>({state.user?.email})</span>
								</strong>
							</div>

							{/* Action Buttons */}
							<div className={styles.actions}>
								<button
									type="button"
									disabled={actionBusy}
									onClick={() => handleConsentDecision(false)}
									className={styles.denyBtn}
								>
									Deny Access
								</button>

								<button
									type="button"
									disabled={actionBusy}
									onClick={() => handleConsentDecision(true)}
									className={styles.approveBtn}
								>
									<span>{actionBusy ? 'Redirecting...' : 'Authorize Application'}</span>
									<ArrowRight size={15} />
								</button>
							</div>
						</div>
					)}
				</div>
			</div>
		</main>
	);
}

export default function OAuthAuthorizePage() {
	return (
		<Suspense fallback={<div style={{ minHeight: '100dvh', backgroundColor: '#09090b' }} />}>
			<AuthorizeContent />
		</Suspense>
	);
}
