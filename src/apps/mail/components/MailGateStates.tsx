'use client';

import React from 'react';
import { ShieldAlert, MailWarning, RefreshCw } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { MailOutboxModal, type OutboxItem } from './MailOutboxModal';
import styles from '../Mail.module.css';

export function MailUnauthorizedState() {
	const { t } = useI18n();
	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				height: '100%',
				padding: 30,
				textAlign: 'center',
				color: 'var(--text-secondary)',
			}}
		>
			<ShieldAlert size={48} color="var(--danger)" style={{ marginBottom: 16 }} />
			<h2 style={{ color: 'var(--text-primary)', margin: '0 0 8px 0', fontSize: 18 }}>
				{t('mailUnauthorizedTitle')}
			</h2>
			<p style={{ maxWidth: 420, fontSize: 13, lineHeight: 1.5 }}>{t('mailUnauthorizedDesc')}</p>
		</div>
	);
}

interface MailConnectionErrorStateProps {
	error: string;
	outbox: OutboxItem[];
	outboxOpen: boolean;
	setOutboxOpen: (open: boolean) => void;
	outboxBusyId: string | null;
	onRefresh: () => void;
	onOutboxAction: (id: string, action: 'approve' | 'reject') => void;
}

export function MailConnectionErrorState({
	error,
	outbox,
	outboxOpen,
	setOutboxOpen,
	outboxBusyId,
	onRefresh,
	onOutboxAction,
}: MailConnectionErrorStateProps) {
	const { t } = useI18n();
	return (
		<>
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					height: '100%',
					padding: 30,
					textAlign: 'center',
					color: 'var(--text-secondary)',
				}}
			>
				<MailWarning size={48} color="var(--accent)" style={{ marginBottom: 16 }} />
				<h2 style={{ color: 'var(--text-primary)', margin: '0 0 8px 0', fontSize: 18 }}>
					{t('mailConnErrorTitle')}
				</h2>
				<p style={{ maxWidth: 480, fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>{error}</p>
				<button type="button" className={`${styles.actionBtn} ${styles.actionBtnPrimary}`} onClick={onRefresh}>
					<RefreshCw size={14} />
					<span>{t('retry')}</span>
				</button>
				{outbox.length > 0 && (
					<button
						type="button"
						onClick={() => setOutboxOpen(true)}
						style={{
							marginTop: 12,
							padding: '9px 13px',
							borderRadius: 8,
							border: '1px solid var(--warning)',
							background: 'color-mix(in srgb, var(--warning) 16%, transparent)',
							color: 'inherit',
							fontSize: 12,
							fontWeight: 700,
							display: 'flex',
							gap: 6,
							alignItems: 'center',
						}}
					>
						<MailWarning size={14} /> {t('mailOutboxTitle')} ({outbox.length})
					</button>
				)}
			</div>
			{outboxOpen && (
				<MailOutboxModal
					items={outbox}
					busyId={outboxBusyId}
					onClose={() => setOutboxOpen(false)}
					onApprove={(id) => onOutboxAction(id, 'approve')}
					onReject={(id) => onOutboxAction(id, 'reject')}
				/>
			)}
		</>
	);
}
