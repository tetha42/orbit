'use client';

import React from 'react';
import { Paperclip, Star, MailOpen, Check, Trash2, Eye } from 'lucide-react';
import { useContextMenu } from '@/core/shell';
import type { MenuItem } from '@/types/workspace';
import { formatMailDate } from '../utils';
import type { MailMessageSummary } from '../types';
import styles from '../Mail.module.css';

interface MailListItemProps {
	msg: MailMessageSummary;
	isSelected: boolean;
	isChecked: boolean;
	isSelectMode: boolean;
	showCheckboxes: boolean;
	locale: string;
	t: (k: string) => string;
	onToggleSelectUid?: (uid: number) => void;
	onSelectMessage: (uid: number) => void;
	onBatchTrash?: () => void;
	onToggleStar?: (msg: MailMessageSummary) => void;
	onToggleRead?: (msg: MailMessageSummary) => void;
}

export const MailListItem: React.FC<MailListItemProps> = ({
	msg,
	isSelected,
	isChecked,
	isSelectMode,
	showCheckboxes,
	locale,
	t,
	onToggleSelectUid,
	onSelectMessage,
	onBatchTrash,
	onToggleStar,
	onToggleRead,
}) => {
	const menuItems = React.useMemo<MenuItem[]>(() => {
		const items: MenuItem[] = [
			{
				id: `mail-open-${msg.uid}`,
				label: t('ctxMailOpen'),
				icon: <Eye size={13} />,
				action: () => onSelectMessage(msg.uid),
			},
		];

		if (onToggleRead) {
			items.push({
				id: `mail-read-${msg.uid}`,
				label: msg.seen ? t('ctxMailMarkUnread') : t('ctxMailMarkRead'),
				icon: <MailOpen size={13} />,
				action: () => onToggleRead(msg),
			});
		}

		if (onToggleStar) {
			items.push({
				id: `mail-star-${msg.uid}`,
				label: msg.flagged ? t('ctxMailUnstar') : t('ctxMailStar'),
				icon: <Star size={13} color={msg.flagged ? 'var(--warning)' : undefined} fill={msg.flagged ? 'var(--warning)' : 'none'} />,
				action: () => onToggleStar(msg),
			});
		}

		if (onBatchTrash) {
			items.push(
				{ id: `sep-mail-${msg.uid}`, label: '', separator: true },
				{
					id: `mail-trash-${msg.uid}`,
					label: t('ctxMailDelete'),
					icon: <Trash2 size={13} />,
					danger: true,
					action: () => {
						onToggleSelectUid?.(msg.uid);
						onBatchTrash();
					},
				}
			);
		}

		return items;
	}, [msg, t, onSelectMessage, onBatchTrash, onToggleSelectUid, onToggleRead, onToggleStar]);

	const contextMenuProps = useContextMenu({ items: menuItems });

	return (
		<li
			className={`${styles.messageItem} ${isSelected ? styles.messageItemActive : ''}`}
			{...contextMenuProps}
			onClick={() => {
				if (isSelectMode && onToggleSelectUid) {
					onToggleSelectUid(msg.uid);
				} else {
					onSelectMessage(msg.uid);
				}
			}}
		>
			<div className={styles.messageItemRow}>
				{showCheckboxes && (
					<button
						type="button"
						className={`${styles.selectionCheckbox} ${isChecked ? styles.selectionCheckboxChecked : ''}`}
						onClick={(e) => {
							e.stopPropagation();
							onToggleSelectUid?.(msg.uid);
						}}
						title={isChecked ? t('mailDeselectAll') : t('mailSelectAll')}
						style={{ marginTop: 2 }}
					>
						{isChecked && <Check size={11} strokeWidth={3} />}
					</button>
				)}
				<div className={styles.messageItemContent}>
					<div className={styles.messageTopRow}>
						<div className={styles.senderBox}>
							{!msg.seen && <span className={styles.unreadDot} title={t('mailUnread')} />}
							<span title={msg.from.address || msg.from.name}>{msg.from.name}</span>
						</div>
						<span className={styles.messageDate}>{formatMailDate(msg.date, locale, t('mailYesterday'))}</span>
					</div>

					<div className={styles.messageSubject}>{msg.subject || t('mailNoSubject')}</div>
					{msg.snippet && <div className={styles.messageSnippet}>{msg.snippet}</div>}

					{(msg.hasAttachments || msg.flagged) && (
						<div className={styles.messageIconsRow}>
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
		</li>
	);
};
