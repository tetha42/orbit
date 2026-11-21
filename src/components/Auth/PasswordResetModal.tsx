'use client';

import React, { useState } from 'react';
import { X, KeyRound } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { PasswordResetStepEmail } from './passwordReset/PasswordResetStepEmail';
import { PasswordResetStepVerify } from './passwordReset/PasswordResetStepVerify';

interface PasswordResetModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: (msg: string) => void;
}

export function PasswordResetModal({ isOpen, onClose, onSuccess }: PasswordResetModalProps) {
	const { t } = useI18n();

	const [step, setStep] = useState<'email' | 'verify'>('email');
	const [email, setEmail] = useState('');
	const [code, setCode] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [newPasswordRepeat, setNewPasswordRepeat] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!isOpen) return null;

	const handleRequestCode = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!email.trim()) return;

		setLoading(true);
		setError(null);
		try {
			const res = await fetch('/api/auth/reset-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'request_code', email: email.trim() }),
			});
			const data = await res.json();
			if (res.ok && data.success) {
				setStep('verify');
			} else {
				setError(data.error || t('pwResetSendError', 'Could not send reset code.'));
			}
		} catch {
			setError(t('pwResetServerError', 'Server connection error.'));
		} finally {
			setLoading(false);
		}
	};

	const handleResetPassword = async (e: React.FormEvent) => {
		e.preventDefault();
		if (code.trim().length !== 6) {
			setError(t('pwResetCodeLenError', 'Please enter the full 6-digit verification code.'));
			return;
		}
		if (newPassword.length < 8) {
			setError(t('pwResetMinLenError', 'New password must be at least 8 characters.'));
			return;
		}
		if (newPassword !== newPasswordRepeat) {
			setError(t('pwResetMismatchError', 'Passwords do not match.'));
			return;
		}

		setLoading(true);
		setError(null);
		try {
			const res = await fetch('/api/auth/reset-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'verify_and_reset',
					email: email.trim(),
					code: code.trim(),
					newPassword,
				}),
			});
			const data = await res.json();
			if (res.ok && data.success) {
				onSuccess(
					data.message ||
						t(
							'pwResetSuccessMsg',
							'Password updated successfully! You can now sign in with your new password.'
						)
				);
				onClose();
			} else {
				setError(data.error || t('pwResetUpdateError', 'Could not update password.'));
			}
		} catch {
			setError(t('pwResetServerError', 'Server connection error.'));
		} finally {
			setLoading(false);
		}
	};

	return (
		<div
			role="dialog"
			aria-modal="true"
			style={{
				position: 'fixed',
				inset: 0,
				zIndex: 9999,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				background: 'color-mix(in srgb, var(--ink-bg) 85%, transparent)',
				padding: '1rem',
			}}
		>
			<div
				style={{
					width: '100%',
					maxWidth: '420px',
					borderRadius: '10px',
					background: '#111113',
					border: '1px solid #27272a',
					padding: '24px',
					color: '#fafafa',
					position: 'relative',
				}}
			>
				<button
					type="button"
					onClick={onClose}
					aria-label={t('close', 'Close')}
					style={{
						position: 'absolute',
						top: '16px',
						right: '16px',
						background: '#09090b',
						border: '1px solid #27272a',
						color: '#a1a1aa',
						borderRadius: '6px',
						width: '28px',
						height: '28px',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						cursor: 'pointer',
					}}
				>
					<X size={15} />
				</button>

				<div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
					<div
						style={{
							width: '38px',
							height: '38px',
							borderRadius: '8px',
							background: '#18181b',
							border: '1px solid #27272a',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							color: '#fafafa',
						}}
					>
						<KeyRound size={18} />
					</div>
					<div>
						<h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
							{step === 'email'
								? t('pwResetTitleRequest', 'Reset Password')
								: t('pwResetTitleVerify', 'Set New Password')}
						</h3>
						<p style={{ fontSize: '11.5px', color: '#a1a1aa', margin: 0 }}>
							{step === 'email'
								? t('pwResetSubRequest', 'Enter your registered email address')
								: t('pwResetSubVerify', 'Verification code sent to {email}').replace('{email}', email)}
						</p>
					</div>
				</div>

				{error && (
					<div
						style={{
							padding: '10px 12px',
							borderRadius: '8px',
							background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
							border: '1px solid color-mix(in srgb, var(--danger) 35%, transparent)',
							color: 'var(--danger)',
							fontSize: '12px',
							marginBottom: '16px',
						}}
					>
						{error}
					</div>
				)}

				{step === 'email' ? (
					<PasswordResetStepEmail
						email={email}
						loading={loading}
						onEmailChange={setEmail}
						onSubmit={handleRequestCode}
					/>
				) : (
					<PasswordResetStepVerify
						code={code}
						newPassword={newPassword}
						newPasswordRepeat={newPasswordRepeat}
						loading={loading}
						onCodeChange={setCode}
						onNewPasswordChange={setNewPassword}
						onNewPasswordRepeatChange={setNewPasswordRepeat}
						onBack={() => setStep('email')}
						onSubmit={handleResetPassword}
					/>
				)}
			</div>
		</div>
	);
}
