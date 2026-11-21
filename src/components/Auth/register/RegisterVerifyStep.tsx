'use client';

import { KeyRound } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import styles from '../AuthPortal.module.css';

interface RegisterVerifyStepProps {
	email: string;
	verificationCode: string;
	verificationQueued: boolean;
	loading: boolean;
	onCodeChange: (v: string) => void;
	onBack: () => void;
}

export function RegisterVerifyStep({
	email,
	verificationCode,
	verificationQueued,
	loading,
	onCodeChange,
	onBack,
}: RegisterVerifyStepProps) {
	const { t } = useI18n();

	return (
		<div className={styles.wizardPanel} style={{ textAlign: 'center' }}>
			<div className={styles.wizardVerifyIcon}>
				<KeyRound size={20} />
			</div>
			<p style={{ fontSize: '12.5px', color: '#a1a1aa', margin: '0 0 16px', lineHeight: 1.5 }}>
				{verificationQueued
					? t('authVerifyMailQueued').replace('{email}', email)
					: t('authVerifyEmailSent', 'We sent a 6-digit verification code to {email}.').replace('{email}', email)}
			</p>
			<input
				type="text"
				required
				maxLength={6}
				autoFocus
				value={verificationCode}
				onChange={(e) => onCodeChange(e.target.value.replace(/[^0-9]/g, ''))}
				placeholder="••••••"
				className={styles.wizardVerifyCode}
			/>
			<div className={styles.wizardActions}>
				<button type="button" className={styles.wizardBack} onClick={onBack}>
					{t('authWizardBack', 'Back')}
				</button>
				<button
					type="submit"
					className={styles.wizardPrimary}
					disabled={verificationCode.trim().length !== 6 || loading}
				>
					{loading ? t('authVerifying', 'Verifying...') : t('authVerifyCompleteBtn', 'Verify & Complete')}
				</button>
			</div>
			<div className={styles.wizardHint}>
				{t('authVerifyHint', 'Check your spam folder if the code does not arrive within a minute.')}
			</div>
		</div>
	);
}
