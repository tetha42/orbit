'use client';

import React, { useState, useMemo } from 'react';
import {
	Reply,
	ReplyAll,
	Star,
	Trash2,
	Mail,
	MailOpen,
	Paperclip,
	ShieldCheck,
	ArrowLeft,
	AlertCircle,
	RotateCcw,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { formatMailBytes } from '../utils';
import type { MailMessageDetail } from '../types';
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
	const locale = language === 'tr' ? 'tr-TR' : 'en-US';
	const [loadRemoteImages, setLoadRemoteImages] = useState(false);

	// Reset remote images state when message changes without effect cascades
	const [prevMessageUid, setPrevMessageUid] = useState(message?.uid);
	if (message?.uid !== prevMessageUid) {
		setPrevMessageUid(message?.uid);
		setLoadRemoteImages(false);
	}

	const messageHtml = message?.html || '';
	const hasRemoteImages = /<img[^>]+src=["']https?:\/\//i.test(messageHtml);

	const iframeSrcDoc = useMemo(() => {
		if (!messageHtml) return '';
		let processed = messageHtml;
		if (!loadRemoteImages && hasRemoteImages) {
			processed = processed.replace(
				/<img([^>]*?)src=(["'])(https?:\/\/[^"']+)\2/gi,
				'<img$1data-blocked-src=$2$3$2 style="display:none !important;"'
			);
		}
		// Strip dangerous active content tags and javascript:/vbscript:/data:text/html URIs for defense in depth
		processed = processed
			.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
			.replace(/<(?:iframe|frame|frameset|object|embed|applet|form|base|meta)\b[^>]*>/gi, '')
			.replace(/\bon[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
			.replace(/(href|src)\s*=\s*(["']?)\s*(?:javascript|vbscript|data\s*:\s*text\/html)[^"'\s>]*/gi, '$1=$2#blocked');

		const imgPolicy = loadRemoteImages ? "img-src https: http: data: cid:;" : "img-src data: cid:;";

		return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; ${imgPolicy} font-src data:;" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<base target="_blank" rel="noopener noreferrer" />
<style>
  html, body {
    margin: 0;
    padding: 16px 20px;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.55;
    color: #1a1a1a;
    background: #ffffff;
    word-wrap: break-word;
    overflow-x: auto;
  }
  img { max-width: 100%; height: auto; }
  a { color: #0066cc; }
  pre { white-space: pre-wrap; word-break: break-word; }
</style>
</head>
<body>${processed}</body>
</html>`;
	}, [messageHtml, loadRemoteImages, hasRemoteImages]);

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
					<p
						style={{
							fontSize: 12.5,
							color: 'var(--text-muted)',
							maxWidth: 380,
							margin: '4px 0 12px 0',
							lineHeight: 1.45,
						}}
					>
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
							<button
								type="button"
								className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
								onClick={onRetry}
							>
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

	const initial = (message.from.name || message.from.address || '?').slice(0, 1).toUpperCase();

	return (
		<section className={styles.detailPane}>
			<div className={styles.detailHeader}>
				<div className={styles.detailActionsRow}>
					<div className={styles.actionBtnGroup}>
						{onBackMobile && (
							<button
								type="button"
								className={styles.actionBtn}
								onClick={onBackMobile}
								title={t('mailBackToList')}
							>
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
							<button
								type="button"
								className={styles.actionBtn}
								onClick={() => onReply(true)}
								title={t('mailReplyAll')}
							>
								<ReplyAll size={14} />
								<span>{t('mailReplyAll')}</span>
							</button>
						)}
					</div>

					<div className={styles.actionBtnGroup}>
						{isTrashFolder && onRestore && (
							<button
								type="button"
								className={styles.actionBtn}
								onClick={onRestore}
								title={t('mailRestoreInbox')}
							>
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
							<Star
								size={14}
								fill={message.flagged ? '#ffb340' : 'none'}
								color={message.flagged ? '#ffb340' : 'currentColor'}
							/>
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
							style={{ color: '#ff453a' }}
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

			{hasRemoteImages && !loadRemoteImages && (
				<div className={styles.privacyBanner}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						<ShieldCheck size={16} />
						<span>
							{t('mailRemoteImagesBlocked')}
						</span>
					</div>
					<button
						type="button"
						className={styles.privacyBtn}
						onClick={() => setLoadRemoteImages(true)}
					>
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
						style={{
							width: '100%',
							height: '100%',
							border: 'none',
							display: 'block',
							background: '#ffffff',
						}}
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
							<span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
								({formatMailBytes(att.size)})
							</span>
						</div>
					))}
				</div>
			)}
		</section>
	);
};
