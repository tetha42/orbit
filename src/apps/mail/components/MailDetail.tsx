'use client';

import React, { useState, useMemo } from 'react';
import { Mail, MailOpen, Paperclip, ShieldCheck, ArrowLeft, AlertCircle } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { formatMailBytes } from '../utils';
import type { MailMessageDetail } from '../types';
import { buildSafeEmailSrcDoc } from './MailDetailUtils';
import { MailDetailHeader } from './MailDetailHeader';
import styles from '../Mail.module.css';

interface MailDetailProps {
	message: MailMessageDetail | null;
	isLoading: boolean;
	error?: string | null;
	onRetry?: () => void;
	onReply: (all?: boolean) => void;
	onToggleStar: () => void;
	onToggleRead: () => void;
	onTrash: () => void;
	onRestore?: () => void;
	isTrashFolder?: boolean;
	onBackMobile?: () => void;
}

export const MailDetail: React.FC<MailDetailProps> = ({
	message,
	isLoading,
	error,
	onRetry,
	onReply,
	onToggleStar,
	onToggleRead,
	onTrash,
	onRestore,
	isTrashFolder = false,
	onBackMobile,
}) => {
	const { t, language } = useI18n();
	const locale = language;
	const [loadRemoteImages, setLoadRemoteImages] = useState(false);

	const [prevMessageUid, setPrevMessageUid] = useState(message?.uid);
	if (message?.uid !== prevMessageUid) {
		setPrevMessageUid(message?.uid);
		setLoadRemoteImages(false);
	}

	const messageHtml = message?.html || '';
	const hasRemoteImages = /<img[^>]+src=["']https?:\/\//i.test(messageHtml);

	const iframeSrcDoc = useMemo(
		() => buildSafeEmailSrcDoc(messageHtml, loadRemoteImages),
		[messageHtml, loadRemoteImages]
	);

	if (isLoading) {
		return (
			<section className={styles.detailPane}>
				<div className={styles.detailEmptyState}>
					<div className="spin-animation">
						<Mail size={32} />
					</div>
					<p>{t('mailLoadingDetail')}</p>
				</div>
			</section>
		);
	}

	if (error) {
		return (
			<section className={styles.detailPane}>
				<div className={styles.detailEmptyState}>
					<AlertCircle size={36} color="var(--accent)" />
					<p style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600, margin: 0 }}>
						{t('mailDetailErrorTitle')}
					</p>
					<p style={{ fontSize: 12.5, color: 'var(--text-muted)', maxWidth: 380, margin: '4px 0 12px 0', lineHeight: 1.45 }}>
						{error}
					</p>
					<div style={{ display: 'flex', gap: 8 }}>
						{onBackMobile && (
							<button type="button" className={styles.actionBtn} onClick={onBackMobile}>
								<ArrowLeft size={14} />
								<span>{t('mailBackToList')}</span>
							</button>
						)}
						{onRetry && (
							<button type="button" className={`${styles.actionBtn} ${styles.actionBtnPrimary}`} onClick={onRetry}>
								{t('retry')}
							</button>
						)}
					</div>
				</div>
			</section>
		);
	}

	if (!message) {
		return (
			<section className={styles.detailPane}>
				<div className={styles.detailEmptyState}>
					<MailOpen size={48} style={{ opacity: 0.3 }} />
					<p style={{ fontSize: 14 }}>{t('mailNoMessageSelected')}</p>
				</div>
			</section>
		);
	}

	return (
		<section className={styles.detailPane}>
			<MailDetailHeader
				message={message}
				locale={locale}
				isTrashFolder={isTrashFolder}
				onBackMobile={onBackMobile}
				onReply={onReply}
				onToggleStar={onToggleStar}
				onToggleRead={onToggleRead}
				onTrash={onTrash}
				onRestore={onRestore}
			/>

			{hasRemoteImages && !loadRemoteImages && (
				<div className={styles.privacyBanner}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						<ShieldCheck size={16} />
						<span>{t('mailRemoteImagesBlocked')}</span>
					</div>
					<button type="button" className={styles.privacyBtn} onClick={() => setLoadRemoteImages(true)}>
						{t('mailLoadImages')}
					</button>
				</div>
			)}

			<div className={styles.bodyContainer} style={{ padding: message.html ? 0 : 20 }}>
				{message.html ? (
					<iframe
						title={message.subject || 'Email Content'}
						sandbox="allow-popups"
						referrerPolicy="no-referrer"
						srcDoc={iframeSrcDoc}
						style={{ width: '100%', height: '100%', border: 'none', display: 'block', background: '#ffffff' }}
					/>
				) : (
					<pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
						{message.text || t('mailEmptyBody')}
					</pre>
				)}
			</div>

			{message.attachments && message.attachments.length > 0 && (
				<div className={styles.attachmentsBar}>
					<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
						{fill(t('mailAttachmentsLabel'), { count: message.attachments.length })}
					</span>
					{message.attachments.map((att, index) => (
						<div key={index} className={styles.attachmentPill} title={att.contentType}>
							<Paperclip size={13} />
							<span>{att.filename}</span>
							<span style={{ fontSize: 10, color: 'var(--text-muted)' }}>({formatMailBytes(att.size)})</span>
						</div>
					))}
				</div>
			)}
		</section>
	);
};
