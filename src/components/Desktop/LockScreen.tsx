'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import { useSession } from '@/core/session';
import { useI18n } from '@/core/i18n';

/**
 * Screen lock.
 *
 * Deliberately does not end the session: unlocking re-verifies the password but
 * keeps the existing token, so a member stepping away from a shared machine does
 * not sign out their other devices or trip the single-session rule.
 */
export function LockScreen() {
	const { isLocked, unlockWorkspace, currentUser, logout } = useSession();
	const { t } = useI18n();
	const [password, setSifre] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	// The parent mounts this only while locked, so it already starts with an
	// empty field; the effect only has to move focus.
	useEffect(() => {
		const timer = setTimeout(() => inputRef.current?.focus(), 50);
		return () => clearTimeout(timer);
	}, []);

	if (!isLocked) return null;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setBusy(true);
		setError(null);
		const result = await unlockWorkspace(password);
		setBusy(false);
		if (!result.success) {
			setError(result.error || t('lockInvalidPassword'));
			setSifre('');
			inputRef.current?.focus();
		}
	};

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Ekran kilitli"
			style={{
				position: 'fixed',
				inset: 0,
				zIndex: 10000,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				gap: '22px',
				background: 'rgba(6, 10, 18, 0.86)',
				backdropFilter: 'var(--glass-blur-strong)',
				color: '#ffffff',
			}}
		>
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					width: '62px',
					height: '62px',
					borderRadius: '50%',
					background: 'rgba(56, 189, 248, 0.14)',
					border: '1px solid rgba(56, 189, 248, 0.35)',
				}}
			>
				<Lock size={26} color="#38bdf8" />
			</div>

			<div style={{ textAlign: 'center' }}>
				<div style={{ fontSize: '17px', fontWeight: 700 }}>
					{currentUser ? `${currentUser.ad} ${currentUser.soyad}` : t('lockTitle')}
				</div>
				<div style={{ fontSize: '12.5px', opacity: 0.65, marginTop: '4px' }}>
					{t('lockSubtitle')}
				</div>
			</div>

			<form
				onSubmit={handleSubmit}
				style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '280px' }}
			>
				<input
					ref={inputRef}
					type="password"
					required
					autoComplete="current-password"
					value={password}
					onChange={(e) => setSifre(e.target.value)}
					placeholder={t('lockPassword')}
					aria-label={t('lockPassword')}
					style={{
						padding: '12px 14px',
						borderRadius: '12px',
						border: '1px solid rgba(255, 255, 255, 0.16)',
						background: 'rgba(0, 0, 0, 0.35)',
						color: '#ffffff',
						fontSize: '14px',
						textAlign: 'center',
						outline: 'none',
						boxSizing: 'border-box',
					}}
				/>

				{error && (
					<div role="alert" style={{ fontSize: '12px', color: '#ff453a', textAlign: 'center' }}>
						{error}
					</div>
				)}

				<button
					type="submit"
					disabled={busy}
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						gap: '8px',
						padding: '12px 0',
						borderRadius: '12px',
						border: 'none',
						background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
						color: '#ffffff',
						fontSize: '14px',
						fontWeight: 700,
						cursor: busy ? 'wait' : 'pointer',
					}}
				>
					{busy ? <Loader2 size={15} /> : null}
					{busy ? t('lockVerifying') : t('lockUnlock')}
				</button>
			</form>

			<button
				onClick={logout}
				style={{
					background: 'transparent',
					border: 'none',
					color: '#94a3b8',
					fontSize: '12.5px',
					cursor: 'pointer',
					textDecoration: 'underline',
				}}
			>
				{t('signOut')}
			</button>
		</div>
	);
}
