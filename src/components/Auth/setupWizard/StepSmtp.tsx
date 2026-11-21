import React from 'react';
import { Server } from 'lucide-react';
import styles from '../VsCodeSetup.module.css';

interface StepSmtpProps {
	communityName: string;
	domain: string;
	smtpHost: string;
	onSmtpHostChange: (value: string) => void;
	smtpPort: string;
	onSmtpPortChange: (value: string) => void;
	smtpFrom: string;
	onSmtpFromChange: (value: string) => void;
	smtpUser: string;
	onSmtpUserChange: (value: string) => void;
	smtpPassword: string;
	onSmtpPasswordChange: (value: string) => void;
}

export function StepSmtp({
	communityName,
	domain,
	smtpHost,
	onSmtpHostChange,
	smtpPort,
	onSmtpPortChange,
	smtpFrom,
	onSmtpFromChange,
	smtpUser,
	onSmtpUserChange,
	smtpPassword,
	onSmtpPasswordChange,
}: StepSmtpProps) {
	return (
		<div className={styles.selectionBody}>
			<p style={{ margin: 0, fontSize: '12.5px', color: '#a1a1aa', lineHeight: 1.5 }}>
				Configure an outbound SMTP relay to send automated verification emails, notifications, and security alerts. You may skip this step and configure it later from System Settings.
			</p>

			<div className={styles.formRow}>
				<div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
					<label className={styles.label}>SMTP Host</label>
					<div className={styles.inputWrap}>
						<Server size={15} className={styles.inputIcon} />
						<input
							type="text"
							className={`${styles.input} ${styles.inputWithIcon}`}
							value={smtpHost}
							onChange={(e) => onSmtpHostChange(e.target.value)}
							placeholder="smtp.example.com"
						/>
					</div>
				</div>
			</div>

			<div className={styles.formRow}>
				<div className={styles.formGroup}>
					<label className={styles.label}>Port</label>
					<input
						type="text"
						className={styles.input}
						value={smtpPort}
						onChange={(e) => onSmtpPortChange(e.target.value)}
						placeholder="465"
					/>
				</div>
				<div className={styles.formGroup}>
					<label className={styles.label}>Sender Address (From)</label>
					<input
						type="text"
						className={styles.input}
						value={smtpFrom}
						onChange={(e) => onSmtpFromChange(e.target.value)}
						placeholder={`"${communityName}" <noreply@${domain}>`}
					/>
				</div>
			</div>

			<div className={styles.formRow}>
				<div className={styles.formGroup}>
					<label className={styles.label}>SMTP Username</label>
					<input
						type="text"
						className={styles.input}
						value={smtpUser}
						onChange={(e) => onSmtpUserChange(e.target.value)}
						placeholder="noreply@domain.com"
					/>
				</div>
				<div className={styles.formGroup}>
					<label className={styles.label}>SMTP Password</label>
					<input
						type="password"
						className={styles.input}
						value={smtpPassword}
						onChange={(e) => onSmtpPasswordChange(e.target.value)}
						placeholder="••••••••"
					/>
				</div>
			</div>
		</div>
	);
}
