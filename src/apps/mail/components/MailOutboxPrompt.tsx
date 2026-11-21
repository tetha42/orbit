'use client';

import React from 'react';
import { MailWarning } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { MailOutboxModal, type OutboxItem } from './MailOutboxModal';

interface MailOutboxPromptProps {
	outbox: OutboxItem[];
	outboxOpen: boolean;
	setOutboxOpen: (open: boolean) => void;
	outboxBusyId: string | null;
	onOutboxAction: (id: string, action: 'approve' | 'reject') => void;
	variant: 'mobile' | 'desktop';
}

export function MailOutboxPrompt({
	outbox,
	outboxOpen,
	setOutboxOpen,
	outboxBusyId,
	onOutboxAction,
	variant,
}: MailOutboxPromptProps) {
	const { t } = useI18n();

	const buttonStyle: React.CSSProperties =
		variant === 'mobile'
			? {
					position: 'fixed',
					right: 14,
					bottom: 74,
					zIndex: 80,
					padding: '9px 13px',
					borderRadius: 999,
					border: '1px solid var(--warning)',
					background: 'color-mix(in srgb, var(--warning) 16%, transparent)',
					color: 'inherit',
					fontSize: 11.5,
					fontWeight: 700,
					display: 'flex',
					gap: 6,
					alignItems: 'center',
				}
			: {
					position: 'absolute',
					top: 9,
					right: 12,
					zIndex: 30,
					padding: '7px 11px',
					borderRadius: 8,
					border: '1px solid var(--warning)',
					background: 'color-mix(in srgb, var(--warning) 14%, transparent)',
					color: 'inherit',
					fontSize: 11,
					fontWeight: 700,
					display: 'flex',
					gap: 6,
					alignItems: 'center',
				};

	return (
		<>
			{outbox.length > 0 && (
				<button type="button" onClick={() => setOutboxOpen(true)} style={buttonStyle}>
					<MailWarning size={variant === 'mobile' ? 13 : 12} /> {t('mailOutboxTitle')} ({outbox.length})
				</button>
			)}
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
