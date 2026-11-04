'use client';

import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { passwordProblem } from '@/lib/profile';
import { PasswordStrengthMeter } from '@/components/Common/PasswordStrengthMeter';
import ui from '@/core/ui/ui.module.css';
import styles from './Account.module.css';
import { sendJson } from '@/core/data/http';

interface AccountPasswordFormProps {
	userEmail: string;
	busy: string;
	onPasswordDone: (ok: boolean, text: string) => void;
	onSetBusy: (busy: '' | 'password') => void;
	note?: React.ReactNode;
}

export function AccountPasswordForm({
	userEmail,
	busy,
	onPasswordDone,
	onSetBusy,
	note,
}: AccountPasswordFormProps) {
	const { t } = useI18n();
	const [current, setCurrent] = useState('');
	const [fresh, setNew] = useState('');
	const [repeat, setRepeat] = useState('');

	const passwordIssue = fresh ? passwordProblem(fresh, { current: current || undefined, email: userEmail }) : null;

	const changePassword = async (e: React.FormEvent) => {
		e.preventDefault();
		if (fresh !== repeat) {
			onPasswordDone(false, t('acMismatch'));
			return;
		}
		onSetBusy('password');
		const res = await sendJson('/api/profile/password', 'POST', { current, fresh });
		if (res.ok) {
			setCurrent('');
			setNew('');
			setRepeat('');
		}
		onPasswordDone(res.ok, res.ok ? t('acPasswordChanged') : res.error || t('kbActionFailed'));
	};

	return (
		<form className={styles.card} onSubmit={changePassword} aria-label={t('acPassword')}>
			<h4 className={styles.cardTitle}>
				<KeyRound size={15} /> {t('acPassword')}
			</h4>
			<input type="text" name="username" autoComplete="username" value={userEmail} readOnly hidden />
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('acCurrent')}</span>
				<input className={ui.input} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
			</label>
			<div className={styles.grid2}>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('acNew')}</span>
					<input className={ui.input} type="password" autoComplete="new-password" value={fresh} onChange={(e) => setNew(e.target.value)} required />
				</label>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('acRepeat')}</span>
					<input className={ui.input} type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} required />
				</label>
			</div>
			{fresh && <PasswordStrengthMeter password={fresh} />}
			<div className={passwordIssue ? ui.error : ui.hint}>{passwordIssue ?? t('acPasswordRules')}</div>
			{repeat && fresh !== repeat && <div className={ui.error}>{t('acMismatch')}</div>}
			<div className={ui.btnRow}>
				<button type="submit" className={ui.primaryBtn} disabled={busy === 'password' || !current || !!passwordIssue || !fresh || fresh !== repeat}>
					{t('acChangePassword')}
				</button>
			</div>
			{note}
		</form>
	);
}
