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
	const { language } = useI18n();
	const isTr = language === 'tr';

	const [step, setStep] = useState<'email' | 'verify'>('email');
	const [email, setEposta] = useState('');
	const [kod, setKod] = useState('');
	const [yeniSifre, setYeniSifre] = useState('');
	const [yeniSifreTekrar, setYeniSifreTekrar] = useState('');
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
				setError(data.error || (isTr ? 'Kod gönderilemedi.' : 'Could not send reset code.'));
			}
		} catch {
			setError(isTr ? 'Sunucu bağlantı hatası.' : 'Server connection error.');
		} finally {
			setLoading(false);
		}
	};

	const handleResetPassword = async (e: React.FormEvent) => {
		e.preventDefault();
		if (kod.trim().length !== 6) {
			setError(isTr ? '6 haneli doğrulama kodunu eksiksiz girin.' : 'Please enter the full 6-digit verification code.');
			return;
		}
		if (yeniSifre.length < 8) {
			setError(isTr ? 'Yeni şifreniz en az 8 karakter olmalıdır.' : 'New password must be at least 8 characters.');
			return;
		}
		if (yeniSifre !== yeniSifreTekrar) {
			setError(isTr ? 'Şifreler birbiriyle eşleşmiyor.' : 'Passwords do not match.');
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
					kod: kod.trim(),
					yeniSifre,
				}),
			});
			const data = await res.json();
			if (res.ok && data.success) {
				onSuccess(
					data.message ||
						(isTr
							? 'Şifreniz başarıyla güncellendi! Yeni şifrenizle giriş yapabilirsiniz.'
							: 'Password updated successfully! You can now sign in with your new password.')
				);
				onClose();
			} else {
				setError(data.error || (isTr ? 'Şifre güncellenemedi.' : 'Could not update password.'));
			}
		} catch {
			setError(isTr ? 'Sunucu bağlantı hatası.' : 'Server connection error.');
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
					aria-label={isTr ? 'Kapat' : 'Close'}
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
								? isTr ? 'Şifremi Unuttum' : 'Reset Password'
								: isTr ? 'Yeni Şifre Belirleyin' : 'Set New Password'}
						</h3>
						<p style={{ fontSize: '11.5px', color: '#a1a1aa', margin: 0 }}>
							{step === 'email'
								? isTr ? 'Kayıtlı e-posta adresinizi girin' : 'Enter your registered email address'
								: isTr ? `${email} adresine gönderilen kod` : `Verification code sent to ${email}`}
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
								{isTr ? 'E-posta Adresi' : 'Email Address'}
							</label>
							<input
								type="email"
								required
								value={email}
								onChange={(e) => setEposta(e.target.value)}
								placeholder={isTr ? 'uye@orbit.local veya ad.soyad@example.com' : 'member@orbit.local or name@example.com'}
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
							{isTr ? 'Doğrulama Kodu Gönder' : 'Send Reset Code'}
						</button>
					</form>
				) : (
					<form onSubmit={handleResetPassword}>
						<div style={{ marginBottom: '12px' }}>
							<label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#d4d4d8', marginBottom: '6px' }}>
								{isTr ? '6 Haneli Doğrulama Kodu' : '6-Digit Verification Code'}
							</label>
							<input
								type="text"
								inputMode="numeric"
								autoComplete="one-time-code"
								required
								maxLength={6}
								value={kod}
								onChange={(e) => setKod(e.target.value.replace(/[^0-9]/g, ''))}
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
								{isTr ? 'Yeni Şifre (En az 8 karakter)' : 'New Password (Min 8 chars)'}
							</label>
							<input
								type="password"
								autoComplete="new-password"
								required
								minLength={8}
								maxLength={128}
								value={yeniSifre}
								onChange={(e) => setYeniSifre(e.target.value)}
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
								{isTr ? 'Yeni Şifre Tekrar' : 'Confirm New Password'}
							</label>
							<input
								type="password"
								autoComplete="new-password"
								required
								minLength={8}
								maxLength={128}
								value={yeniSifreTekrar}
								onChange={(e) => setYeniSifreTekrar(e.target.value)}
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
								{isTr ? 'Geri' : 'Back'}
							</button>
							<button
								type="submit"
								disabled={loading || kod.length !== 6 || !yeniSifre}
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
								{isTr ? 'Şifreyi Güncelle' : 'Update Password'}
							</button>
						</div>
					</form>
				)}
			</div>
		</div>
	);
}
