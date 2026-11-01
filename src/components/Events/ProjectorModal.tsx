'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
import { Users, X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { ModalOverlay } from '@/core/ui/Sheet';
import { fill } from '@/lib/text';
import { ATTENDANCE_WINDOW_MS } from '@/lib/events';
import styles from './Events.module.css';
import type { EventView } from './eventsShared';

interface CodeResponse {
	kisaKod: string;
	kalanMs: number;
	katilimciSayisi: number;
}

/**
 * Full-screen code for the room. The server signs a code per 30-second window;
 * this asks for a fresh one when the window rolls over and every few seconds in
 * between, so the live count keeps moving.
 */
export function ProjectorModal({ event, onClose }: { event: EventView; onClose: () => void }) {
	const { t } = useI18n();
	const [code, setCode] = useState<CodeResponse | null>(null);
	const [qr, setQr] = useState('');
	const [error, setError] = useState('');
	const [left, setLeft] = useState(0);

	useEffect(() => {
		let live = true;
		let timer: ReturnType<typeof setTimeout>;
		const load = async () => {
			try {
				const res = await fetch(`/api/events/${encodeURIComponent(event.id)}/checkin-code`, { cache: 'no-store' });
				const data = await res.json().catch(() => ({}));
				if (!live) return;
				if (!res.ok) {
					setError(data.error || t('evProjectorClosed'));
					setCode(null);
					timer = setTimeout(load, 5000);
					return;
				}
				setError('');
				setCode(data);
				setLeft(data.kalanMs);
				// Next poll: at the rollover, or in 5 s for the counter — whichever is first.
				timer = setTimeout(load, Math.min(data.kalanMs + 250, 5000));
			} catch {
				if (live) timer = setTimeout(load, 5000);
			}
		};
		void load();
		return () => {
			live = false;
			clearTimeout(timer);
		};
	}, [event.id, t]);

	useEffect(() => {
		if (!code) return;
		let live = true;
		// The QR carries the same 6-character code that is printed under it, so a scan and a
		// typed entry are the same input to the same endpoint.
		QRCode.toDataURL(code.kisaKod, { width: 420, margin: 1, errorCorrectionLevel: 'M' }).then((url) => live && setQr(url));
		return () => {
			live = false;
		};
	}, [code]);

	useEffect(() => {
		const id = setInterval(() => setLeft((ms) => Math.max(0, ms - 1000)), 1000);
		return () => clearInterval(id);
	}, []);

	return (
		<ModalOverlay onClose={onClose} style={{ background: 'rgba(0,0,0,0.88)' }}>
			<div className={styles.projector} role="dialog" aria-modal="true" aria-label={t('evProjectorTitle')}>
				<div style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
					<span className={`${styles.badge} ${styles.b_live}`}>{t('evProjectorTitle')}</span>
					<button type="button" onClick={onClose} aria-label={t('kbClose')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
						<X size={20} />
					</button>
				</div>
				<h2 style={{ margin: 0, fontSize: 22 }}>{event.baslik}</h2>
				{error ? (
					<p style={{ color: '#ff9f0a', margin: '40px 0' }}>{error}</p>
				) : (
					<>
						<div className={styles.qrBox} style={{ padding: 14 }} data-testid="projector-qr" data-code={code?.kisaKod ?? ''}>
							{qr ? <Image src={qr} alt="" width={380} height={380} unoptimized style={{ maxWidth: '100%', height: 'auto' }} /> : <div style={{ width: 380, height: 380 }} />}
						</div>
						<div className={styles.countdown} aria-hidden>
							<span style={{ width: `${(left / ATTENDANCE_WINDOW_MS) * 100}%` }} />
						</div>
						<div style={{ fontSize: 13, opacity: 0.75 }}>{fill(t('evRefreshIn'), { n: Math.ceil(left / 1000) })}</div>
						{code?.kisaKod && (
							<div style={{ textAlign: 'center' }}>
								<div style={{ fontSize: 12, opacity: 0.7 }}>{t('evShortCodeLabel')}</div>
								<div
									data-testid="projector-short-code"
									style={{ fontFamily: 'ui-monospace, monospace', fontSize: 34, fontWeight: 800, letterSpacing: '0.18em' }}
								>
									{code.kisaKod}
								</div>
							</div>
						)}
						<div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 750 }}>
							<Users size={18} color="#30d158" />
							{fill(t('evProjectorCount'), { n: code?.katilimciSayisi ?? 0 })}
						</div>
					</>
				)}
			</div>
		</ModalOverlay>
	);
}
