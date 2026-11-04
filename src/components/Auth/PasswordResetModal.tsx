'use client';

import React, { useState } from 'react';
import { X, KeyRound, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';

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
				background: 'rgba(9, 9, 11, 0.85)',
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
							background: 'rgba(239, 68, 68, 0.12)',
							border: '1px solid rgba(239, 68, 68, 0.35)',
							color: '#f87171',
							fontSize: '12px',
							marginBottom: '16px',
						}}
					>
						{error}
					</div>
				)}

				{step === 'email' ? (
					<form onSubmit={handleRequestCode}>
						<div style={{ marginBottom: '16px' }}>
							<label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#d4d4d8', marginBottom: '6px' }}>
								{t('pwResetEmailLabel', 'Email Address')}
							</label>
							<input
								type="email"
								required
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder={t('pwResetEmailPh', 'member@orbit.local or name@example.com')}
								style={{
									width: '100%',
									minHeight: '40px',
									padding: '9px 12px',
									borderRadius: '8px',
									border: '1px solid #27272a',
									background: '#09090b',
									color: '#fafafa',
									fontSize: '13px',
									outline: 'none',
								}}
								autoFocus
							/>
						</div>

						<button
							type="submit"
							disabled={loading || !email.trim()}
							style={{
								width: '100%',
								minHeight: '42px',
								padding: '10px',
								borderRadius: '8px',
								border: '1px solid #fafafa',
								background: '#fafafa',
								color: '#09090b',
								fontSize: '13px',
								fontWeight: 700,
								cursor: loading ? 'not-allowed' : 'pointer',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								gap: '8px',
							}}
						>
							{loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
							{t('pwResetSendBtn', 'Send Reset Code')}
						</button>
					</form>
				) : (
					<form onSubmit={handleResetPassword}>
						<div style={{ marginBottom: '12px' }}>
							<label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#d4d4d8', marginBottom: '6px' }}>
								{t('pwResetCodeLabel', '6-Digit Verification Code')}
							</label>
							<input
								type="text"
								inputMode="numeric"
								autoComplete="one-time-code"
								required
								maxLength={6}
								value={code}
								onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
								placeholder="••••••"
								style={{
									width: '100%',
									padding: '9px 12px',
									borderRadius: '8px',
									border: '1px solid #27272a',
									background: '#09090b',
									color: '#fafafa',
									fontSize: '18px',
									fontWeight: 700,
									letterSpacing: '6px',
									textAlign: 'center',
									outline: 'none',
									fontFamily: 'monospace',
								}}
								autoFocus
							/>
						</div>

						<div style={{ marginBottom: '12px' }}>
							<label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#d4d4d8', marginBottom: '6px' }}>
								{t('pwResetNewPasswordLabel', 'New Password (Min 8 chars)')}
							</label>
							<input
								type="password"
								autoComplete="new-password"
								required
								minLength={8}
								maxLength={128}
								value={newPassword}
								onChange={(e) => setNewPassword(e.target.value)}
								placeholder="••••••••"
								style={{
									width: '100%',
									minHeight: '40px',
									padding: '9px 12px',
									borderRadius: '8px',
									border: '1px solid #27272a',
									background: '#09090b',
									color: '#fafafa',
									fontSize: '13px',
									outline: 'none',
								}}
							/>
						</div>

						<div style={{ marginBottom: '16px' }}>
							<label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#d4d4d8', marginBottom: '6px' }}>
								{t('pwResetConfirmPasswordLabel', 'Confirm New Password')}
							</label>
							<input
								type="password"
								autoComplete="new-password"
								required
								minLength={8}
								maxLength={128}
								value={newPasswordRepeat}
								onChange={(e) => setNewPasswordRepeat(e.target.value)}
								placeholder="••••••••"
								style={{
									width: '100%',
									minHeight: '40px',
									padding: '9px 12px',
									borderRadius: '8px',
									border: '1px solid #27272a',
									background: '#09090b',
									color: '#fafafa',
									fontSize: '13px',
									outline: 'none',
								}}
							/>
						</div>

						<div style={{ display: 'flex', gap: '8px' }}>
							<button
								type="button"
								onClick={() => setStep('email')}
								style={{
									flex: 1,
									minHeight: '42px',
									padding: '10px',
									borderRadius: '8px',
									border: '1px solid #27272a',
									background: '#09090b',
									color: '#a1a1aa',
									fontSize: '12.5px',
									fontWeight: 600,
									cursor: 'pointer',
								}}
							>
								{t('back', 'Back')}
							</button>
							<button
								type="submit"
								disabled={loading || code.length !== 6 || !newPassword}
								style={{
									flex: 2,
									minHeight: '42px',
									padding: '10px',
									borderRadius: '8px',
									border: '1px solid #fafafa',
									background: '#fafafa',
									color: '#09090b',
									fontSize: '13px',
									fontWeight: 700,
									cursor: loading ? 'not-allowed' : 'pointer',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									gap: '8px',
								}}
							>
								{loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
								{t('pwResetUpdateBtn', 'Update Password')}
							</button>
						</div>
					</form>
				)}
			</div>
		</div>
	);
}
