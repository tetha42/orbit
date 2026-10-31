'use client';

import { useState, type FormEvent } from 'react';
import { CardFooterLink, Field, PasswordInput, SubmitButton, TextInput } from './AuthControls';
import type { AuthFlow } from './useAuthFlow';
import { useClientValue } from '@/lib/client/useClientValue';
import { useI18n } from '@/core/i18n';
import styles from './AuthPortal.module.css';
import { PasswordResetModal } from './PasswordResetModal';

const MAIL_ICON = (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
		<rect width="20" height="16" x="2" y="4" rx="2" />
		<path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
	</svg>
);

const KEY_ICON = (
	<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
		<rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
		<path d="M7 11V7a5 5 0 0 1 10 0v4" />
	</svg>
);

const PASSKEY_ICON = (
	<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
		<path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
		<path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
		<path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
		<path d="M2 12a10 10 0 0 1 18-6" />
		<path d="M2 16h.01" />
		<path d="M21.8 16c.2-2 .131-5.354 0-6" />
		<path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
		<path d="M8.65 22c.21-.66.45-1.32.57-2" />
		<path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
	</svg>
);

export function LoginForm({ flow }: { flow: AuthFlow }) {
	const { t } = useI18n();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [showResetModal, setShowResetModal] = useState(false);
	const passkeysAvailable = useClientValue(() => Boolean(window.PublicKeyCredential), false);

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		flow.submitLogin(email, password);
	};

	return (
		<>
			<form onSubmit={handleSubmit}>
				<Field label={t('authEmailLabel', 'Email')}>
					<TextInput
						type="email"
						required
						autoComplete="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder={t('authEmailPlaceholder', 'you@example.com')}
						icon={MAIL_ICON}
					/>
				</Field>

				<Field label={t('authPasswordLabel', 'Password')}>
					<PasswordInput
						required
						autoComplete="current-password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder={t('authPasswordPlaceholder', 'Your password')}
					/>
				</Field>

				<div className={styles.formMeta}>
					<span />
					<button
						type="button"
						className={styles.linkButton}
						onClick={() => setShowResetModal(true)}
					>
						{KEY_ICON}
						<span>{t('authForgotPassword', 'Forgot password?')}</span>
					</button>
				</div>

				<SubmitButton
					loading={flow.loading}
					disabled={flow.setupIncomplete}
					label={t('authTabLogin', 'Sign In')}
					loadingLabel={t('authSigningIn', 'Signing in...')}
				/>

				{passkeysAvailable && (
					<>
						<div className={styles.divider}>
							<span>{t('authOr', 'or')}</span>
						</div>
						<button
							type="button"
							className={styles.passkeyButton}
							disabled={flow.loading || flow.setupIncomplete}
							onClick={() => flow.submitPasskey(email)}
						>
							{PASSKEY_ICON}
							{t('authPasskeySignIn', 'Sign in with Passkey')}
						</button>
					</>
				)}

				<CardFooterLink
					text={t('authNoAccount', "Don't have an account?")}
					action={t('authSignUpLink', 'Create Account')}
					onClick={() => flow.switchTab('register')}
				/>
			</form>

			<PasswordResetModal
				isOpen={showResetModal}
				onClose={() => setShowResetModal(false)}
				onSuccess={(msg) => flow.setSuccessMessage(msg)}
			/>
		</>
	);
}
