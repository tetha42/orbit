'use client';

import { useState } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { useI18n } from '@/core/i18n';
import styles from './AuthPortal.module.css';

/* ==================== notice banners ==================== */

type NoticeTone = 'error' | 'warning' | 'success';

const NOTICE_STYLES: Record<NoticeTone, string> = {
	error: styles.noticeError,
	warning: styles.noticeWarning,
	success: styles.noticeSuccess,
};

const INFO_ICON = (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
		<circle cx="12" cy="12" r="10" />
		<line x1="12" y1="8" x2="12" y2="12" />
		<line x1="12" y1="16" x2="12.01" y2="16" />
	</svg>
);

const CHECK_ICON = (
	<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
		<polyline points="20 6 9 17 4 12" />
	</svg>
);

const CROSS_ICON = (
	<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
		<line x1="18" y1="6" x2="6" y2="18" />
		<line x1="6" y1="6" x2="18" y2="18" />
	</svg>
);

interface NoticeProps {
	tone: NoticeTone;
	/** Bold lead line. Omit for a single-line message. */
	title?: string;
	children: ReactNode;
}

export function Notice({ tone, title, children }: NoticeProps) {
	const icon = tone === 'success' ? CHECK_ICON : tone === 'warning' ? INFO_ICON : CROSS_ICON;

	return (
		<div className={`${styles.notice} ${NOTICE_STYLES[tone]}`} role="status">
			{icon}
			<div>
				{title && <div className={styles.noticeTitle}>{title}</div>}
				<div className={title ? styles.noticeBody : undefined}>{children}</div>
			</div>
		</div>
	);
}

/* ==================== inputs ==================== */

interface FieldProps {
	label: string;
	/** Tighter spacing and a smaller label — used by the denser register form. */
	compact?: boolean;
	children: ReactNode;
}

/** Labelled full-width field. */
export function Field({ label, compact, children }: FieldProps) {
	return (
		<div className={compact ? styles.fieldCompact : styles.field}>
			<label className={`${styles.label} ${compact ? styles.labelCompact : ''}`}>{label}</label>
			{children}
		</div>
	);
}

/** Labelled field that lives inside one half of a `.fieldRow` pair. */
export function CompactField({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div>
			<label className={`${styles.label} ${styles.labelCompact}`}>{label}</label>
			{children}
		</div>
	);
}

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
	icon?: ReactNode;
	compact?: boolean;
	otp?: boolean;
}

export function TextInput({ icon, compact, otp, className, ...props }: TextInputProps) {
	const classes = [
		styles.input,
		compact ? styles.inputCompact : '',
		otp ? styles.inputOtp : '',
		className ?? '',
	]
		.filter(Boolean)
		.join(' ');

	if (!icon) return <input className={classes} {...props} />;

	return (
		<div className={styles.inputWrap}>
			<span className={styles.inputIcon}>{icon}</span>
			<input className={classes} {...props} />
		</div>
	);
}

const LOCK_ICON = (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
		<rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
		<path d="M7 11V7a5 5 0 0 1 10 0v4" />
	</svg>
);

const EYE_ICON = (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
		<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
		<circle cx="12" cy="12" r="3" />
	</svg>
);

const EYE_OFF_ICON = (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
		<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
		<path d="M6.61 6.61A13.5 13.5 0 0 0 2 11s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
		<line x1="2" y1="2" x2="22" y2="22" />
	</svg>
);

interface PasswordInputProps extends InputHTMLAttributes<HTMLInputElement> {
	compact?: boolean;
}

export function PasswordInput({ compact, className, ...props }: PasswordInputProps) {
	const { t } = useI18n();
	const [visible, setVisible] = useState(false);

	const classes = [styles.input, compact ? styles.inputCompact : '', styles.inputWithToggle, className ?? '']
		.filter(Boolean)
		.join(' ');

	const labelText = visible ? t('authHidePassword', 'Hide password') : t('authShowPassword', 'Show password');

	return (
		<div className={styles.inputWrap}>
			<span className={styles.inputIcon}>{LOCK_ICON}</span>
			<input type={visible ? 'text' : 'password'} className={classes} {...props} />
			<button
				type="button"
				className={styles.toggleVisibility}
				onClick={() => setVisible((v) => !v)}
				title={labelText}
				aria-label={labelText}
			>
				{visible ? EYE_OFF_ICON : EYE_ICON}
			</button>
		</div>
	);
}

/* ==================== misc ==================== */

export function SubmitButton({
	loading,
	label,
	loadingLabel,
	compact,
	disabled,
}: {
	loading: boolean;
	label: string;
	loadingLabel: string;
	compact?: boolean;
	disabled?: boolean;
}) {
	return (
		<button
			type="submit"
			disabled={loading || disabled}
			className={`${styles.submit} ${compact ? styles.submitCompact : ''}`}
		>
			{loading ? loadingLabel : label}
		</button>
	);
}

export function CardFooterLink({
	text,
	action,
	onClick,
}: {
	text: string;
	action: string;
	onClick: () => void;
}) {
	return (
		<div className={styles.cardFooter}>
			{text}{' '}
			<button type="button" className={styles.cardFooterButton} onClick={onClick}>
				{action}
			</button>
		</div>
	);
}

export function InlineLink({
	children,
	onClick,
}: {
	children: ReactNode;
	onClick: () => void;
}) {
	return (
		<div className={styles.cardFooter}>
			<button type="button" className={styles.cardFooterButton} onClick={onClick}>
				{children}
			</button>
		</div>
	);
}
