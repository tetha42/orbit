'use client';

import React, { useState, useEffect, useRef } from 'react';
import { KeyRound, ShieldAlert, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useWindowActions } from '@/core/windows';

interface TerminalTwoFactorPromptProps {
	isLight: boolean;
	twoFactorEnabled: boolean;
	idleExpired?: boolean;
	/** Why the previous attempt failed to start the shell (shown above the input). */
	serverError?: string | null;
	onSubmit: (code: string) => Promise<{ ok: boolean; error?: string }>;
}

export function TerminalTwoFactorPrompt({
	isLight,
	twoFactorEnabled,
	idleExpired,
	serverError,
	onSubmit,
}: TerminalTwoFactorPromptProps) {
	const { t } = useI18n();
	const { openApp } = useWindowActions();

	const [code, setCode] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(serverError ?? null);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (serverError) setError(serverError);
	}, [serverError]);

	useEffect(() => {
		if (twoFactorEnabled && inputRef.current) {
			inputRef.current.focus();
		}
	}, [twoFactorEnabled]);

	const handleSubmit = async (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		const clean = code.trim().replace(/\s+/g, '');
		if (clean.length < 6 || loading) return;

		setLoading(true);
		setError(null);
		try {
			const res = await onSubmit(clean);
			if (!res.ok) {
				setError(res.error || t('term2faInvalidCode'));
				setCode('');
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : t('term2faError'));
		} finally {
			setLoading(false);
		}
	};

	const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
		setCode(val);
		setError(null);
		// Deliberately no auto-submit: browser OTP autofill can refill the code
		// that was just spent at sign-in, which would submit it again immediately
		// and bounce the gate before the user can read the error.
	};

	if (!twoFactorEnabled) {
		return (
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					height: '100%',
					padding: '2rem',
					background: isLight ? '#f8fafc' : '#080b11',
					color: isLight ? '#0f172a' : '#f8fafc',
					textAlign: 'center',
				}}
			>
				<div
					style={{
						width: '64px',
						height: '64px',
						borderRadius: '16px',
						background: 'rgba(239, 68, 68, 0.12)',
						border: '1px solid rgba(239, 68, 68, 0.25)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						marginBottom: '1.25rem',
						color: '#ef4444',
					}}
				>
					<ShieldAlert size={34} />
				</div>
				<h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
					{t('twofactorSetupRequired')}
				</h2>
				<p
					style={{
						maxWidth: '440px',
						fontSize: '0.875rem',
						color: isLight ? '#64748b' : '#94a3b8',
						lineHeight: 1.6,
						marginBottom: '1.5rem',
					}}
				>
					{t('term2faRequiredDesc')}
				</p>
				<button
					type="button"
					onClick={() => openApp('settings', { section: 'security' })}
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: '0.5rem',
						padding: '0.625rem 1.25rem',
						borderRadius: '10px',
						background: '#2563eb',
						color: '#ffffff',
						fontSize: '0.875rem',
						fontWeight: 500,
						border: 'none',
						cursor: 'pointer',
						boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
					}}
				>
					{t('term2faOpenSettings')}
					<ArrowRight size={16} />
				</button>
			</div>
		);
	}

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				height: '100%',
				padding: '2rem',
				background: isLight ? '#f8fafc' : '#080b11',
				color: isLight ? '#0f172a' : '#f8fafc',
			}}
		>
			<div
				style={{
					width: '100%',
					maxWidth: '380px',
					padding: '2rem',
					borderRadius: '16px',
					background: isLight ? '#ffffff' : 'rgba(15, 23, 42, 0.75)',
					border: isLight ? '1px solid rgba(226, 232, 240, 0.8)' : '1px solid rgba(255, 255, 255, 0.08)',
					boxShadow: isLight ? '0 10px 25px -5px rgba(0, 0, 0, 0.06)' : '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
					textAlign: 'center',
				}}
			>
				<div
					style={{
						width: '56px',
						height: '56px',
						borderRadius: '14px',
						background: idleExpired ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)',
						border: idleExpired ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						margin: '0 auto 1.25rem',
						color: idleExpired ? '#f59e0b' : '#10b981',
					}}
				>
					{idleExpired ? <Lock size={28} /> : <KeyRound size={28} />}
				</div>

				<h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.4rem' }}>
					{idleExpired ? t('term2faTimeoutTitle') : t('term2faGateTitle')}
				</h2>

				<p
					style={{
						fontSize: '0.8125rem',
						color: isLight ? '#64748b' : '#94a3b8',
						lineHeight: 1.5,
						marginBottom: '1.5rem',
					}}
				>
					{idleExpired ? t('term2faTimeoutDesc') : t('term2faGateDesc')}
				</p>

				{error && (
					<div
						style={{
							padding: '0.625rem 0.875rem',
							borderRadius: '8px',
							background: 'rgba(239, 68, 68, 0.1)',
							border: '1px solid rgba(239, 68, 68, 0.25)',
							color: '#ef4444',
							fontSize: '0.8125rem',
							marginBottom: '1.25rem',
							textAlign: 'left',
						}}
					>
						{error}
					</div>
				)}

				<form onSubmit={handleSubmit}>
					<div style={{ marginBottom: '1.25rem' }}>
						<input
							ref={inputRef}
							type="text"
							inputMode="numeric"
							pattern="[0-9]*"
							autoComplete="one-time-code"
							maxLength={8}
							placeholder="••••••"
							value={code}
							onChange={handleCodeChange}
							disabled={loading}
							style={{
								width: '100%',
								fontSize: '1.5rem',
								fontWeight: 700,
								letterSpacing: '0.35em',
								textAlign: 'center',
								padding: '0.625rem 1rem',
								borderRadius: '10px',
								border: isLight ? '1.5px solid #cbd5e1' : '1.5px solid rgba(255, 255, 255, 0.15)',
								background: isLight ? '#f8fafc' : 'rgba(0, 0, 0, 0.35)',
								color: isLight ? '#0f172a' : '#f8fafc',
								outline: 'none',
							}}
						/>
					</div>

					<button
						type="submit"
						disabled={loading || code.trim().length < 6}
						style={{
							width: '100%',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							gap: '0.5rem',
							padding: '0.75rem 1.25rem',
							borderRadius: '10px',
							background: loading || code.trim().length < 6 ? (isLight ? '#94a3b8' : '#334155') : '#10b981',
							color: '#ffffff',
							fontSize: '0.875rem',
							fontWeight: 600,
							border: 'none',
							cursor: loading || code.trim().length < 6 ? 'not-allowed' : 'pointer',
							transition: 'background 0.15s ease',
						}}
					>
						{loading ? (
							<>
								<Loader2 size={16} className="animate-spin" />
								{t('term2faVerifying')}
							</>
						) : (
							<>
								<KeyRound size={16} />
								{t('term2faVerifyLaunch')}
							</>
						)}
					</button>
				</form>
			</div>
		</div>
	);
}
