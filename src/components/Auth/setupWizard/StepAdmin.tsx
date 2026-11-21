import React from 'react';
import { Lock, Mail, User } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import styles from '../VsCodeSetup.module.css';

interface StepAdminProps {
	name: string;
	onNameChange: (value: string) => void;
	surname: string;
	onSurnameChange: (value: string) => void;
	email: string;
	onEmailChange: (value: string) => void;
	password: string;
	onPasswordChange: (value: string) => void;
	passwordConfirm: string;
	onPasswordConfirmChange: (value: string) => void;
}

export function StepAdmin({
	name,
	onNameChange,
	surname,
	onSurnameChange,
	email,
	onEmailChange,
	password,
	onPasswordChange,
	passwordConfirm,
	onPasswordConfirmChange,
}: StepAdminProps) {
	const { t } = useI18n();
	return (
		<div className={styles.selectionBody}>
			<div className={styles.formRow}>
				<div className={styles.formGroup}>
					<label className={styles.label}>{t('authFirstNameLabel')}</label>
					<div className={styles.inputWrap}>
						<User size={15} className={styles.inputIcon} />
						<input
							type="text"
							className={`${styles.input} ${styles.inputWithIcon}`}
							value={name}
							onChange={(e) => onNameChange(e.target.value)}
							placeholder="Orbit"
							required
						/>
					</div>
				</div>
				<div className={styles.formGroup}>
					<label className={styles.label}>{t('authLastNameLabel')}</label>
					<div className={styles.inputWrap}>
						<User size={15} className={styles.inputIcon} />
						<input
							type="text"
							className={`${styles.input} ${styles.inputWithIcon}`}
							value={surname}
							onChange={(e) => onSurnameChange(e.target.value)}
							placeholder="Admin"
							required
						/>
					</div>
				</div>
			</div>

			<div className={styles.formGroup}>
				<label className={styles.label}>{t('setupAdminEmailLabel')}</label>
				<div className={styles.inputWrap}>
					<Mail size={15} className={styles.inputIcon} />
					<input
						type="email"
						className={`${styles.input} ${styles.inputWithIcon}`}
						value={email}
						onChange={(e) => onEmailChange(e.target.value)}
						placeholder="admin@orbit.local"
						required
					/>
				</div>
				<p className={styles.helperText}>{t('setupAdminEmailHint')}</p>
			</div>

			<div className={styles.formRow}>
				<div className={styles.formGroup}>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
						<label className={styles.label}>{t('setupAdminPasswordLabel')}</label>
						<span
							style={{
								fontSize: '11px',
								fontFamily: 'monospace',
								color: password.length >= 12 ? '#4ec9b0' : '#888888',
							}}
						>
							{fill(t('setupAdminPwdCounter'), { count: password.length })}
						</span>
					</div>
					<div className={styles.inputWrap}>
						<Lock size={15} className={styles.inputIcon} />
						<input
							type="password"
							className={`${styles.input} ${styles.inputWithIcon}`}
							value={password}
							onChange={(e) => onPasswordChange(e.target.value)}
							placeholder={t('setupAdminPwdMinPh')}
							required
						/>
					</div>
				</div>

				<div className={styles.formGroup}>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
						<label className={styles.label}>{t('setupAdminPwdConfirmLabel')}</label>
						{password && passwordConfirm && (
							<span
								style={{
									fontSize: '11px',
									color: password === passwordConfirm ? '#4ec9b0' : '#f48771',
								}}
							>
								{password === passwordConfirm ? `✓ ${t('setupAdminPwdMatch')}` : t('setupAdminPwdMismatch')}
							</span>
						)}
					</div>
					<div className={styles.inputWrap}>
						<Lock size={15} className={styles.inputIcon} />
						<input
							type="password"
							className={`${styles.input} ${styles.inputWithIcon}`}
							value={passwordConfirm}
							onChange={(e) => onPasswordConfirmChange(e.target.value)}
							placeholder={t('setupAdminPwdConfirmPh')}
							required
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
