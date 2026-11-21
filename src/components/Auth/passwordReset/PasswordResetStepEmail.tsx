'use client';

import React from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';

interface PasswordResetStepEmailProps {
	email: string;
	loading: boolean;
	onEmailChange: (value: string) => void;
	onSubmit: (e: React.FormEvent) => void;
}

export function PasswordResetStepEmail({
	email,
	loading,
	onEmailChange,
	onSubmit,
}: PasswordResetStepEmailProps) {
	const { t } = useI18n();

	return (
		<form onSubmit={onSubmit}>
			<div style={{ marginBottom: '16px' }}>
				<label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#d4d4d8', marginBottom: '6px' }}>
					{t('pwResetEmailLabel', 'Email Address')}
				</label>
				<input
					type="email"
					required
					value={email}
					onChange={(e) => onEmailChange(e.target.value)}
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
	);
}
