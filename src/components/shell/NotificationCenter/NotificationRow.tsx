'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { dayOffset } from '@/core/data/format';
import type { NotificationItem } from '@/types/notifications';
import { KIND_STYLE, metaFor } from './notificationMeta';

interface RowProps {
	item: NotificationItem;
	now: number;
	unread?: boolean;
	pinned?: boolean;
	busy: boolean;
	error?: string;
	onOpen: (item: NotificationItem) => void;
	onDecide: (item: NotificationItem, action: 'approve' | 'reject') => void;
}

export function NotificationRow({ item, now, unread, pinned, busy, error, onOpen, onDecide }: RowProps) {
	const { t, language } = useI18n();
	const { Icon, color } = KIND_STYLE[item.kind];
	const overdue = item.dueAt !== undefined && item.priority === 'action' && dayOffset(item.dueAt, now) < 0;
	const registered = item.kind === 'event' && item.data.registered === true;
	const meta = metaFor(item, now, t, language);

	return (
		<li className={`nc-row${pinned ? ' nc-row--pinned' : ''}`} data-notification-item={item.id} data-unread={unread || undefined}>
			<button type="button" className="nc-row-main" onClick={() => onOpen(item)}>
				<span className="nc-icon" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }} aria-hidden="true">
					<Icon size={16} />
				</span>
				<span className="nc-text">
					{pinned && <span className="nc-flag">{t('ncUrgent')}</span>}
					<span className="nc-row-title">{item.data.title}</span>
					<span className="nc-row-meta" style={overdue ? { color: 'var(--danger)' } : undefined}>
						<span>{meta.join('\u00A0· ')}</span>
						{registered && <span className="nc-chip">{t('ncEventRegistered')}</span>}
					</span>
				</span>
				{unread && <span className="nc-dot" aria-hidden="true" />}
			</button>

			{item.kind === 'approval' && (
				<div className="nc-actions">
					<button
						type="button"
						className="nc-btn nc-btn--danger"
						data-notification-action="reject"
						disabled={busy}
						onClick={() => onDecide(item, 'reject')}
					>
						{t('ncReject')}
					</button>
					<button
						type="button"
						className="nc-btn nc-btn--primary"
						data-notification-action="approve"
						disabled={busy}
						onClick={() => onDecide(item, 'approve')}
					>
						<Check size={12} aria-hidden="true" /> {t('ncApprove')}
					</button>
				</div>
			)}
			{error && (
				<div role="alert" className="nc-row-error">
					{error}
				</div>
			)}
		</li>
	);
}
