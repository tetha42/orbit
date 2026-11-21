'use client';

import React from 'react';
import { Star, Paperclip, Check } from 'lucide-react';
import type { MailMessageSummary } from '../../types';
import { useI18n } from '@/core/i18n';
import { formatMailDate } from '../../utils';
import s from '../../MailMobile.module.css';

interface MobileMessageCardProps {
	msg: MailMessageSummary;
	isSelected: boolean;
	isChecked: boolean;
	isSelecting: boolean;
	onClick: () => void;
}

export function MobileMessageCard({ msg, isSelected, isChecked, isSelecting, onClick }: MobileMessageCardProps) {
	const { t, language } = useI18n();
	return (
		<div
			className={s.messageCard}
			style={{
				borderLeft: isSelected ? '3px solid var(--accent)' : undefined,
				background: isChecked ? 'var(--accent-subtle)' : undefined,
			}}
			onClick={onClick}
		>
			<div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%' }}>
				{isSelecting && (
					<div className={`${s.selectionCheckbox} ${isChecked ? s.selectionCheckboxChecked : ''}`} style={{ marginTop: 2 }}>
						{isChecked && <Check size={12} strokeWidth={3} />}
					</div>
				)}
				<div style={{ flex: 1, minWidth: 0 }}>
					<div className={s.cardTopRow}>
						<div className={s.senderWrap}>
							{!msg.seen ? <span className={s.unreadDot} title={t('mailUnread')} /> : <span style={{ width: 8 }} />}
							<span title={msg.from.address || msg.from.name}>{msg.from.name}</span>
						</div>
						<span className={`${s.cardDate} ${!msg.seen ? s.cardDateUnread : ''}`}>
							{formatMailDate(msg.date, language, t('mailYesterday'))}
						</span>
					</div>
					<div className={s.cardSubject}>{msg.subject || t('mailNoSubject')}</div>
					{msg.snippet && <div className={s.cardSnippet}>{msg.snippet}</div>}
					{(msg.hasAttachments || msg.flagged) && (
						<div className={s.cardIconsRow}>
							{msg.hasAttachments && (
								<span title={t('mailHasAttachments')} style={{ display: 'inline-flex', alignItems: 'center' }}>
									<Paperclip size={12} />
								</span>
							)}
							{msg.flagged && (
								<span title={t('mailStarred')} style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--warning)' }}>
									<Star size={12} fill="var(--warning)" />
								</span>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
