'use client';

import { AlertTriangle, Check, Mail, X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import styles from '../Mail.module.css';

export interface OutboxItem {
	id: string;
	kind: string;
	recipient: string;
	subject: string;
	status: string;
	error: string | null;
	attempts: number;
	createdAt: number;
}

interface Props {
	items: OutboxItem[];
	busyId: string | null;
	onClose: () => void;
	onApprove: (id: string) => void;
	onReject: (id: string) => void;
}

export function MailOutboxModal({ items, busyId, onClose, onApprove, onReject }: Props) {
	const { t, language } = useI18n();

	return (
		<div className={styles.modalOverlay} onClick={onClose}>
			<div
				className={styles.composeModal}
				onClick={(event) => event.stopPropagation()}
				style={{ width: 'min(720px, 94vw)', maxHeight: '82vh' }}
			>
				<div className={styles.composeHeader}>
					<span className={styles.composeHeaderTitle} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
						<Mail size={15} /> {t('mailOutboxTitle')}
					</span>
					<button type="button" className={styles.composeCloseBtn} onClick={onClose} title={t('close')}>
						<X size={16} />
					</button>
				</div>
				<div style={{ padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
					<p style={{ margin: '0 0 4px', fontSize: 12, opacity: 0.65 }}>{t('mailOutboxDesc')}</p>
					{items.length === 0 ? (
						<div style={{ fontSize: 12, opacity: 0.6 }}>{t('mailOutboxEmpty')}</div>
					) : (
						items.map((item) => (
							<div
								key={item.id}
								style={{
									padding: '10px 12px',
									borderRadius: 9,
									border: '1px solid var(--window-border)',
									background: 'var(--fill-soft, rgba(255,255,255,0.03))',
									display: 'flex',
									flexDirection: 'column',
									gap: 6,
								}}
							>
								<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
									<strong style={{ fontSize: 12.5, flex: 1 }}>{item.recipient}</strong>
									<span style={{ fontSize: 10.5, opacity: 0.6 }}>
										{new Date(item.createdAt).toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US')}
									</span>
								</div>
								<div style={{ fontSize: 11.5, opacity: 0.75 }}>{item.subject}</div>
								{item.error && (
									<div style={{ fontSize: 11, color: '#ff453a', display: 'flex', gap: 5, alignItems: 'center' }}>
										<AlertTriangle size={12} /> {item.error}
									</div>
								)}
								<div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
									<span style={{ fontSize: 10.5, opacity: 0.55, marginRight: 'auto' }}>
										{t(`mailOutboxKind_${item.kind}`, item.kind)} · {item.status}
									</span>
									<button
										type="button"
										className={styles.actionBtn}
										disabled={busyId === item.id}
										onClick={() => onReject(item.id)}
									>
										{t('mailOutboxReject')}
									</button>
									<button
										type="button"
										className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
										disabled={busyId === item.id}
										onClick={() => onApprove(item.id)}
									>
										<Check size={13} /> {t('mailOutboxApprove')}
									</button>
								</div>
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);
}
