'use client';

import React from 'react';
import { Reply, ReplyAll, Star, Trash2, Mail, MailOpen, ArrowLeft, RotateCcw } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { MailMessageDetail } from '../types';
import styles from '../Mail.module.css';

interface MailDetailHeaderProps {
	message: MailMessageDetail;
	locale: string;
	isTrashFolder: boolean;
	onBackMobile?: () => void;
	onReply: (all?: boolean) => void;
	onToggleStar: () => void;
	onToggleRead: () => void;
	onTrash: () => void;
	onRestore?: () => void;
}

export const MailDetailHeader: React.FC<MailDetailHeaderProps> = ({
	message,
	locale,
	isTrashFolder,
	onBackMobile,
	onReply,
	onToggleStar,
	onToggleRead,
	onTrash,
	onRestore,
}) => {
	const { t } = useI18n();
	const initial = (message.from.name || message.from.address || '?').slice(0, 1).toUpperCase();

	return (
		<div className={styles.detailHeader}>
			<div className={styles.detailActionsRow}>
				<div className={styles.actionBtnGroup}>
					{onBackMobile && (
						<button type="button" className={styles.actionBtn} onClick={onBackMobile} title={t('mailBackToList')}>
							<ArrowLeft size={14} />
							<span>{t('mailBack')}</span>
						</button>
					)}
					<button
						type="button"
						className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
						onClick={() => onReply(false)}
						title={t('mailReplyPrompt')}
					>
						<Reply size={14} />
						<span>{t('mailReplyPrompt')}</span>
					</button>
					{message.to.length + (message.cc?.length || 0) > 1 && (
						<button type="button" className={styles.actionBtn} onClick={() => onReply(true)} title={t('mailReplyAll')}>
							<ReplyAll size={14} />
							<span>{t('mailReplyAll')}</span>
						</button>
					)}
				</div>

				<div className={styles.actionBtnGroup}>
					{isTrashFolder && onRestore && (
						<button type="button" className={styles.actionBtn} onClick={onRestore} title={t('mailRestoreInbox')}>
							<RotateCcw size={14} />
							<span>{t('mailRestore')}</span>
						</button>
					)}
					<button
						type="button"
						className={styles.actionBtn}
						onClick={onToggleStar}
						title={message.flagged ? t('mailUnstar') : t('mailStarAction')}
					>
						<Star size={14} fill={message.flagged ? 'var(--warning)' : 'none'} color={message.flagged ? 'var(--warning)' : 'currentColor'} />
					</button>
					<button
						type="button"
						className={styles.actionBtn}
						onClick={onToggleRead}
						title={message.seen ? t('mailMarkUnread') : t('mailMarkRead')}
					>
						{message.seen ? <Mail size={14} /> : <MailOpen size={14} />}
					</button>
					<button
						type="button"
						className={styles.actionBtn}
						onClick={onTrash}
						title={isTrashFolder ? t('mailDeletePermanent') : t('mailMoveTrash')}
						style={{ color: 'var(--danger)' }}
					>
						<Trash2 size={14} />
						{isTrashFolder && <span>{t('mailDeletePermanentShort')}</span>}
					</button>
				</div>
			</div>

			<h1 className={styles.detailSubject}>{message.subject || t('mailNoSubject')}</h1>

			<div className={styles.detailMetaBox}>
				<div className={styles.senderProfile}>
					<div className={styles.avatar}>{initial}</div>
					<div className={styles.senderDetails}>
						<div className={styles.senderName}>{message.from.name}</div>
						<div className={styles.senderAddress}>{message.from.address}</div>
						<div className={styles.toAddress}>
							{t('mailToLabel')}{' '}
							{message.to.map((tRec) => tRec.name || tRec.address).join(', ') || t('mailNoRecipient')}
							{message.cc &&
								message.cc.length > 0 &&
								` • ${t('mailCcLabel')} ${message.cc.map((c) => c.name || c.address).join(', ')}`}
						</div>
					</div>
				</div>

				<div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
					{new Date(message.date).toLocaleString(locale, {
						dateStyle: 'medium',
						timeStyle: 'short',
					})}
				</div>
			</div>
		</div>
	);
};
