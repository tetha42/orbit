'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
import { Ticket, X } from 'lucide-react';
import { useSession } from '@/core/session';
import { useI18n } from '@/core/i18n';
import { ModalOverlay, useDraggableSheet } from '@/core/ui/Sheet';
import styles from './Events.module.css';
import { formatRange, typeMeta, type EventView } from './eventsShared';

/** The member's signed ticket for door staff to scan. */
export function TicketModal({ event, onClose }: { event: EventView; onClose: () => void }) {
	const { currentUser } = useSession();
	const { t, language } = useI18n();
	const { offset, onHeaderMouseDown, onHeaderDoubleClick } = useDraggableSheet(true);
	const [qr, setQr] = useState('');
	useEffect(() => {
		let live = true;
		if (event.biletKodu) {
			QRCode.toDataURL(event.biletKodu, { width: 230, margin: 1, errorCorrectionLevel: 'M' }).then((url) => live && setQr(url));
		}
		return () => {
			live = false;
		};
	}, [event.biletKodu]);
	const locale = language === 'en' ? 'en-GB' : 'tr-TR';

	return (
		<ModalOverlay onClose={onClose}>
			<div
				className={styles.ticket}
				style={
					{
						'--type-color': typeMeta(event.tur).color,
						...(offset.x !== 0 || offset.y !== 0
							? { transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }
							: {}),
					} as React.CSSProperties
				}
				role="dialog"
				aria-modal="true"
				aria-label={t('evTicketTitle')}
			>
				<div
					className={styles.ticketTop}
					onMouseDown={onHeaderMouseDown}
					onDoubleClick={onHeaderDoubleClick}
					style={{ cursor: 'grab', userSelect: 'none' }}
				>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, opacity: 0.9 }}>
						<Ticket size={15} /> {t('evTicketTitle')}
						<button type="button" onClick={onClose} aria-label={t('kbClose')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
							<X size={17} />
						</button>
					</div>
					<div style={{ fontSize: 18, fontWeight: 780, marginTop: 10, lineHeight: 1.25 }}>{event.baslik}</div>
					<div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 6 }}>{formatRange(event.baslangic, event.endTime, locale)}</div>
					<div style={{ fontSize: 12.5, opacity: 0.9 }}>{event.konum}</div>
				</div>
				<div className={styles.ticketBody}>
					<div className={styles.qrBox}>{qr ? <Image src={qr} alt="" width={200} height={200} unoptimized /> : <div style={{ width: 200, height: 200 }} />}</div>
					<div style={{ fontSize: 12.5, color: 'var(--text-secondary)', textAlign: 'center' }}>{t('evTicketHint')}</div>
					<div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', fontSize: 12 }}>
						<span>
							<span style={{ color: 'var(--text-secondary)' }}>{t('evTicketHolder')}</span>
							<br />
							<strong>
								{currentUser?.ad} {currentUser?.soyad}
							</strong>
						</span>
						<span style={{ textAlign: 'right' }}>
							<span style={{ color: 'var(--text-secondary)' }}>{t('evStudentNo')}</span>
							<br />
							<strong className={styles.mono}>{currentUser?.ogrenciNo || '—'}</strong>
						</span>
					</div>
				</div>
			</div>
		</ModalOverlay>
	);
}
