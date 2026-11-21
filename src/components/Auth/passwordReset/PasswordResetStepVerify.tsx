'use client';

import React from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';

interface PasswordResetStepVerifyProps {
	code: string;
	newPassword: string;
	newPasswordRepeat: string;
	loading: boolean;
	onCodeChange: (value: string) => void;
	onNewPasswordChange: (value: string) => void;
	onNewPasswordRepeatChange: (value: string) => void;
	onBack: () => void;
	onSubmit: (e: React.FormEvent) => void;
}

const inputStyle: React.CSSProperties = {
	width: '100%',
	minHeight: '40px',
	padding: '9px 12px',
	borderRadius: '8px',
	border: '1px solid #27272a',
	background: '#09090b',
	color: '#fafafa',
	fontSize: '13px',
	outline: 'none',
};

export function PasswordResetStepVerify({
	code,
	newPassword,
	newPasswordRepeat,
	loading,
	onCodeChange,
	onNewPasswordChange,
	onNewPasswordRepeatChange,
	onBack,
	onSubmit,
}: PasswordResetStepVerifyProps) {
	const { t } = useI18n();

	return (
		<form onSubmit={onSubmit}>
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
					onChange={(e) => onCodeChange(e.target.value.replace(/[^0-9]/g, ''))}
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
					onChange={(e) => onNewPasswordChange(e.target.value)}
					placeholder="••••••••"
					style={inputStyle}
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
					onChange={(e) => onNewPasswordRepeatChange(e.target.value)}
					placeholder="••••••••"
					style={inputStyle}
				/>
			</div>

			<div style={{ display: 'flex', gap: '8px' }}>
				<button
					type="button"
					onClick={onBack}
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
	);
}
