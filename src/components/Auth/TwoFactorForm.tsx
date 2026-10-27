'use client';

import { useState, type FormEvent } from 'react';
import { InlineLink, SubmitButton, TextInput } from './AuthControls';
import type { AuthFlow } from './useAuthFlow';
import { useI18n } from '@/core/i18n';

/**
 * Second step of a two-factor login. Accepts either a 6-digit authenticator code
 * or one of the member's recovery codes.
 */
export function TwoFactorForm({ flow }: { flow: AuthFlow }) {
	const { t } = useI18n();
	const [code, setCode] = useState('');

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		flow.submitTwoFactor(code);
		setCode('');
	};

	return (
		<form onSubmit={handleSubmit}>
			<div style={{ marginBottom: 14 }}>
				<label
					style={{
						display: 'block',
						marginBottom: 6,
						fontSize: 12,
						fontWeight: 600,
						color: '#d4d4d8',
					}}
				>
					{t('auth2faCodeLabel', 'Verification Code')}
				</label>
				<TextInput
					required
					autoFocus
					otp
					inputMode="numeric"
					autoComplete="one-time-code"
					maxLength={9}
					value={code}
					onChange={(e) => setCode(e.target.value)}
					placeholder="123456"
				/>
			</div>

			<SubmitButton
				loading={flow.loading}
				label={t('auth2faVerifyBtn', 'Verify & Sign In')}
				loadingLabel={t('authVerifying', 'Verifying...')}
			/>

			<InlineLink onClick={flow.cancelTwoFactor}>
				{t('auth2faCancelLink', 'Cancel and start over')}
			</InlineLink>
		</form>
	);
}
