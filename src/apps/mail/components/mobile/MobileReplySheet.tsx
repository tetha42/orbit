'use client';

import React from 'react';
import { Reply, ReplyAll } from 'lucide-react';
import type { MailMessageDetail } from '../../types';
import { useI18n } from '@/core/i18n';
import s from '../../MailMobile.module.css';

interface MobileReplySheetProps {
	activeMessage: MailMessageDetail;
	onClose: () => void;
	onReply: (all?: boolean) => void;
}

export function MobileReplySheet({ activeMessage, onClose, onReply }: MobileReplySheetProps) {
	const { t } = useI18n();
	const hasMultipleRecipients = activeMessage.to.length + (activeMessage.cc?.length || 0) > 1;
	const btnStyle: React.CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		gap: 12,
		padding: '12px 14px',
		borderRadius: 12,
		border: 'none',
		background: 'var(--card-bg)',
		color: 'var(--text-primary)',
		fontSize: 14,
		fontWeight: 600,
		cursor: 'pointer',
	};

	return (
		<div className={s.sheetOverlay} onClick={onClose}>
			<div
				style={{
					background: 'var(--settings-sidebar-bg)',
					borderTopLeftRadius: 18,
					borderTopRightRadius: 18,
					padding: '16px 20px',
					display: 'flex',
					flexDirection: 'column',
					gap: 10,
					boxShadow: '0 -10px 30px rgba(0,0,0,0.5)',
				}}
				onClick={(e) => e.stopPropagation()}
			>
				<button type="button" onClick={() => { onClose(); onReply(false); }} style={btnStyle}>
					<Reply size={18} color="var(--accent)" />
					<span>{t('mailReplySender')}</span>
				</button>

				{hasMultipleRecipients && (
					<button type="button" onClick={() => { onClose(); onReply(true); }} style={btnStyle}>
						<ReplyAll size={18} color="var(--accent)" />
						<span>{t('mailReplyAll')}</span>
					</button>
				)}

				<button
					type="button"
					onClick={onClose}
					style={{
						padding: '12px',
						borderRadius: 12,
						border: 'none',
						background: 'transparent',
						color: 'var(--text-muted)',
						fontSize: 14,
						fontWeight: 600,
						cursor: 'pointer',
						marginTop: 4,
					}}
				>
					{t('cancel')}
				</button>
			</div>
		</div>
	);
}
