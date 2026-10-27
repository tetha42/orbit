'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock, LogIn, XCircle } from 'lucide-react';
import styles from './yoklama.module.css';

type State =
	| { kind: 'pending' }
	| { kind: 'ok'; title: string; message: string; already: boolean }
	| { kind: 'login' }
	| { kind: 'error'; message: string; expired: boolean };

async function submit(kod: string): Promise<State> {
	try {
		const res = await fetch('/api/events', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'yoklama', kod }),
		});
		const data = await res.json().catch(() => ({}));
		if (res.status === 401) return { kind: 'login' };
		if (res.ok) {
			return {
				kind: 'ok',
				title: data.etkinlik?.baslik ?? '',
				message: data.message || 'Your attendance has been recorded.',
				already: !!data.zaten,
			};
		}
		return {
			kind: 'error',
			message: data.error || 'Could not record attendance.',
			expired: res.status === 410,
		};
	} catch {
		return { kind: 'error', message: 'Network connection failed.', expired: false };
	}
}

export function CheckInClient({ kod }: { kod: string }) {
	const [state, setState] = useState<State>({ kind: 'pending' });
	const request = useRef<{ kod: string; result: Promise<State> } | null>(null);

	useEffect(() => {
		let live = true;
		if (request.current?.kod !== kod) request.current = { kod, result: submit(kod) };
		request.current.result.then((next) => live && setState(next));
		return () => {
			live = false;
		};
	}, [kod]);

	const statusText =
		state.kind === 'ok'
			? 'VERIFIED'
			: state.kind === 'error'
				? state.expired
					? 'TOKEN EXPIRED'
					: 'CHECK-IN FAILED'
				: state.kind === 'login'
					? 'AUTH REQUIRED'
					: 'VERIFYING...';

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
					<span style={{ color: '#fafafa' }}>EVENT CHECK-IN</span>
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
								? 'Attendance Already Recorded'
								: 'Check-In Confirmed'
							: state.kind === 'error'
								? 'Check-In Failed'
								: state.kind === 'login'
									? 'Authentication Required'
									: 'Validating Event Token...'}
					</h1>

					{state.kind === 'ok' && state.title && (
						<div className={styles.eventTitle}>{state.title}</div>
					)}

					<p className={styles.message}>
						{state.kind === 'ok'
							? state.message
							: state.kind === 'error'
								? state.message
								: state.kind === 'login'
									? 'Please sign in to the Orbit workspace first, then scan the live QR code displayed on the event screen.'
									: 'Communicating with the Orbit attendance ledger...'}
					</p>

					<Link href="/" className={styles.primaryBtn}>
						Return to Orbit Workspace
					</Link>
				</div>
			</div>
		</main>
	);
}
