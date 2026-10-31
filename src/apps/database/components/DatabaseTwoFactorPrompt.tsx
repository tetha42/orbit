'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Database, ShieldAlert, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useWindowActions } from '@/core/windows';

interface DatabaseTwoFactorPromptProps {
	isLight: boolean;
	twoFactorEnabled: boolean;
	passkeySession?: boolean;
	idleExpired?: boolean;
	onSubmit: (code: string) => Promise<{ ok: boolean; error?: string }>;
	onPasskey?: () => Promise<{ ok: boolean; error?: string }>;
}

export function DatabaseTwoFactorPrompt({
	isLight,
	twoFactorEnabled,
	passkeySession,
	idleExpired,
	onSubmit,
	onPasskey,
}: DatabaseTwoFactorPromptProps) {
	const { t } = useI18n();
	const { openApp } = useWindowActions();

	const [code, setCode] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

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
				setError(res.error || t('db2faCodeError'));
				setCode('');
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : t('db2faGenericError'));
		} finally {
			setLoading(false);
		}
	};

	const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
		setCode(val);
		setError(null);
		if (val.length === 6) {
			setTimeout(() => {
				const form = inputRef.current?.form;
				if (form) form.requestSubmit();
			}, 50);
		}
	};

	if (passkeySession) {
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
						width: '56px',
						height: '56px',
						borderRadius: '14px',
						background: 'rgba(16, 185, 129, 0.12)',
						border: '1px solid rgba(16, 185, 129, 0.3)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						marginBottom: '1.25rem',
						color: '#10b981',
					}}
				>
					<Database size={28} />
				</div>
				<h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>
					{t('dbPasskeyTitle')}
				</h3>
				<p style={{ maxWidth: '440px', fontSize: '0.8125rem', color: isLight ? '#64748b' : '#94a3b8', lineHeight: 1.5, margin: '0 0 1.5rem 0' }}>
					{t('dbPasskeyDesc')}
				</p>
				<button
					type="button"
					disabled={loading}
					onClick={() => {
						if (!onPasskey) return;
						setLoading(true);
						setError(null);
						void onPasskey().then((res) => {
							if (!res.ok) setError(res.error || t('db2faGenericError'));
						}).finally(() => setLoading(false));
					}}
					style={{
						padding: '0.625rem 1.25rem',
						borderRadius: '8px',
						background: 'var(--accent)',
						color: '#fff',
						border: 'none',
						fontWeight: 600,
						fontSize: '0.875rem',
						cursor: loading ? 'wait' : 'pointer',
						opacity: loading ? 0.7 : 1,
					}}
				>
					{loading ? t('loading') : t('dbPasskeyOpen')}
				</button>
				{error && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.75rem' }}>{error}</div>}
			</div>
		);
	}

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
						color: isLight ? '#64748b' : '#94a3b8',
						fontSize: '0.875rem',
						lineHeight: 1.5,
						marginBottom: '1.5rem',
					}}
				>
					{t('db2faRequiredDesc')}
				</p>
				<button
					type="button"
					onClick={() => openApp('settings')}
					style={{
						padding: '0.625rem 1.25rem',
						borderRadius: '8px',
						background: 'var(--accent)',
						color: 'var(--accent-contrast, #ffffff)',
						border: 'none',
						fontWeight: 500,
						fontSize: '0.875rem',
						cursor: 'pointer',
						display: 'flex',
						alignItems: 'center',
						gap: '0.5rem',
					}}
				>
					<span>{t('db2faOpenSettings')}</span>
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
					background: isLight ? '#ffffff' : '#0f141f',
					border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)',
					boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
					textAlign: 'center',
				}}
			>
				<div
					style={{
						width: '52px',
						height: '52px',
						borderRadius: '14px',
						background: 'var(--accent-subtle)',
						border: '1px solid var(--accent-border)',
						display: 'inline-flex',
						alignItems: 'center',
						justifyContent: 'center',
						color: 'var(--accent)',
						marginBottom: '1rem',
					}}
				>
					{idleExpired ? <Lock size={26} color="#ff9f0a" /> : <Database size={26} />}
				</div>

				<h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>
					{idleExpired ? t('db2faTimeoutTitle') : t('db2faLockTitle')}
				</h3>

				<p
					style={{
						fontSize: '0.8125rem',
						color: isLight ? '#64748b' : '#94a3b8',
						lineHeight: 1.45,
						margin: '0 0 1.5rem 0',
					}}
				>
					{idleExpired ? t('db2faTimeoutDesc') : t('db2faPromptDesc')}
				</p>

				<form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
					<div style={{ position: 'relative' }}>
						<input
							ref={inputRef}
							type="text"
							inputMode="numeric"
							autoComplete="one-time-code"
							placeholder="••••••"
							maxLength={8}
							value={code}
							onChange={handleCodeChange}
							disabled={loading}
							style={{
								width: '100%',
								padding: '0.75rem 1rem',
								textAlign: 'center',
								fontSize: '1.5rem',
								fontFamily: 'ui-monospace, monospace',
								letterSpacing: '0.35em',
								borderRadius: '8px',
								border: error ? '1px solid #ef4444' : isLight ? '1px solid #cbd5e1' : '1px solid #1e293b',
								background: isLight ? '#f1f5f9' : '#141a29',
								color: isLight ? '#0f172a' : '#f8fafc',
								outline: 'none',
							}}
						/>
					</div>

					{error && (
						<div
							style={{
								color: '#ef4444',
								fontSize: '0.75rem',
								fontWeight: 500,
								marginTop: '-0.25rem',
							}}
						>
							{error}
						</div>
					)}

					<button
						type="submit"
						disabled={code.length < 6 || loading}
						style={{
							padding: '0.75rem',
							borderRadius: '8px',
							background: code.length >= 6 && !loading ? 'var(--accent)' : 'var(--accent-muted)',
							color: 'var(--accent-contrast, #ffffff)',
							border: 'none',
							fontWeight: 600,
							fontSize: '0.875rem',
							cursor: code.length >= 6 && !loading ? 'pointer' : 'not-allowed',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							gap: '0.5rem',
							transition: 'all 0.15s ease',
						}}
					>
						{loading ? (
							<>
								<Loader2 size={16} className="animate-spin" />
								<span>{t('db2faVerifying')}</span>
							</>
						) : (
							<span>{t('db2faUnlock')}</span>
						)}
					</button>
				</form>
			</div>
		</div>
	);
}
