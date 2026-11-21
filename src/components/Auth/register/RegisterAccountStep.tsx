'use client';

import { CompactField, Field, PasswordInput, TextInput } from '../AuthControls';
import { PasswordStrengthMeter } from '@/components/Common/PasswordStrengthMeter';
import { useI18n } from '@/core/i18n';
import styles from '../AuthPortal.module.css';

interface RegisterAccountStepProps {
	firstName: string;
	lastName: string;
	email: string;
	password: string;
	memberHandle: string;
	memberIdLabel: string;
	memberIdPlaceholder: string;
	memberIdRequired: boolean;
	setupIncomplete: boolean;
	onFirstNameChange: (v: string) => void;
	onLastNameChange: (v: string) => void;
	onEmailChange: (v: string) => void;
	onPasswordChange: (v: string) => void;
	onMemberHandleChange: (v: string) => void;
}

export function RegisterAccountStep({
	firstName,
	lastName,
	email,
	password,
	memberHandle,
	memberIdLabel,
	memberIdPlaceholder,
	memberIdRequired,
	setupIncomplete,
	onFirstNameChange,
	onLastNameChange,
	onEmailChange,
	onPasswordChange,
	onMemberHandleChange,
}: RegisterAccountStepProps) {
	const { t } = useI18n();

	return (
		<div className={styles.wizardPanel}>
			<div className={styles.fieldRow}>
				<CompactField label={t('authFirstNameLabel', 'First Name')}>
					<TextInput
						required
						compact
						autoComplete="given-name"
						value={firstName}
						onChange={(e) => onFirstNameChange(e.target.value)}
						placeholder={t('authFirstNamePh', 'First name')}
					/>
				</CompactField>
				<CompactField label={t('authLastNameLabel', 'Last Name')}>
					<TextInput
						required
						compact
						autoComplete="family-name"
						value={lastName}
						onChange={(e) => onLastNameChange(e.target.value)}
						placeholder={t('authLastNamePh', 'Last name')}
					/>
				</CompactField>
			</div>

			<Field label={t('authEmailAddressLabel', 'Email Address')} compact>
				<TextInput
					type="email"
					required
					compact
					autoComplete="email"
					value={email}
					onChange={(e) => onEmailChange(e.target.value)}
					placeholder={t('authEmailAddressPh', 'member@orbit.local or name@example.com')}
				/>
			</Field>

			<Field label={t('authPasswordMinLabel', 'Password (Min 8 characters)')} compact>
				<PasswordInput
					required
					compact
					minLength={8}
					autoComplete="new-password"
					value={password}
					onChange={(e) => onPasswordChange(e.target.value)}
					placeholder="••••••••"
				/>
			</Field>
			<PasswordStrengthMeter password={password} />

			<Field
				label={`${memberIdLabel}${memberIdRequired ? ' *' : ` (${t('authOptional', 'optional')})`}`}
				compact
			>
				<TextInput
					compact
					required={memberIdRequired}
					maxLength={32}
					value={memberHandle}
					onChange={(e) => onMemberHandleChange(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32))}
					placeholder={memberIdPlaceholder}
				/>
			</Field>

			<div className={styles.wizardActions}>
				<button type="submit" className={styles.wizardPrimary} disabled={setupIncomplete}>
					{t('authWizardContinue', 'Continue')}
				</button>
			</div>
			<div className={styles.hint}>
				{t('authRegApprovalHint', 'Your account will be activated once approved by community administrators.')}
			</div>
		</div>
	);
}
