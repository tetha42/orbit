'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock, LogIn, XCircle } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import styles from './checkin.module.css';

type State =
	| { kind: 'pending' }
	| { kind: 'ok'; title: string; already: boolean }
	| { kind: 'login' }
	| { kind: 'error'; message?: string; messageKey: 'ciRecordFailed' | 'ciNetworkError'; expired: boolean };

async function submit(code: string): Promise<State> {
	try {
		const res = await fetch('/api/events', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'attend', code }),
		});
		const data = await res.json().catch(() => ({}));
		if (res.status === 401) return { kind: 'login' };
		if (res.ok) {
			return {
				kind: 'ok',
				title: data.event?.title ?? '',
				already: !!data.already,
			};
		}
		return {
			kind: 'error',
			message: typeof data.error === 'string' && data.error ? data.error : undefined,
			messageKey: 'ciRecordFailed',
			expired: res.status === 410,
		};
	} catch {
		return { kind: 'error', messageKey: 'ciNetworkError', expired: false };
	}
}

export function CheckInClient({ code }: { code: string }) {
	const { t } = useI18n();
	const [state, setState] = useState<State>({ kind: 'pending' });
	const request = useRef<{ code: string; result: Promise<State> } | null>(null);

	useEffect(() => {
		let live = true;
		if (request.current?.code !== code) request.current = { code, result: submit(code) };
		request.current.result.then((next) => live && setState(next));
		return () => {
			live = false;
		};
	}, [code]);

	const statusText =
		state.kind === 'ok'
			? t('ciStatusVerified')
			: state.kind === 'error'
				? state.expired
					? t('ciStatusExpired')
					: t('ciStatusFailed')
				: state.kind === 'login'
					? t('ciStatusAuthRequired')
					: t('ciStatusVerifying');

	const badgeClass =
		state.kind === 'ok'
			? `${styles.badge} ${styles.badgeOk}`
			: state.kind === 'error'
				? `${styles.badge} ${styles.badgeError}`
				: state.kind === 'login'
					? `${styles.badge} ${styles.badgeLogin}`
					: styles.badge;

	return (
		<main className={styles.viewport}>
			<div role="status" aria-live="polite" className={styles.panel}>
				<header className={styles.header}>
					<span>ORBIT // TETHA42</span>
					<span style={{ color: '#fafafa' }}>{t('ciHeaderTag')}</span>
				</header>

				<div className={styles.body}>
					<div className={badgeClass}>
						{state.kind === 'ok' ? (
							<CheckCircle2 size={13} />
						) : state.kind === 'error' ? (
							state.expired ? <Clock size={13} /> : <XCircle size={13} />
						) : state.kind === 'login' ? (
							<LogIn size={13} />
						) : (
							<Clock size={13} />
						)}
						<span>{statusText}</span>
					</div>

					<h1 className={styles.title}>
						{state.kind === 'ok'
							? state.already
								? t('ciAlreadyTitle')
								: t('ciConfirmedTitle')
							: state.kind === 'error'
								? t('ciFailedTitle')
								: state.kind === 'login'
									? t('ciLoginTitle')
									: t('ciVerifyingTitle')}
					</h1>

					{state.kind === 'ok' && state.title && (
						<div className={styles.eventTitle}>{state.title}</div>
					)}

					<p className={styles.message}>
						{state.kind === 'ok'
							? state.already
								? t('evAttendanceAlready')
								: t('evAttendanceRecorded')
							: state.kind === 'error'
								? state.message || t(state.messageKey)
								: state.kind === 'login'
									? t('ciLoginMessage')
									: t('ciVerifyingMessage')}
					</p>

					<Link href="/" className={styles.primaryBtn}>
						{t('ciReturn')}
					</Link>
				</div>
			</div>
		</main>
	);
}
