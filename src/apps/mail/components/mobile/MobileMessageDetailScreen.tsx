'use client';

import React, { useState } from 'react';
import {
	ChevronLeft,
	RefreshCw,
	Star,
	Trash2,
	Mail as MailIcon,
	MailOpen,
	Paperclip,
	RotateCcw,
	Reply,
	AlertCircle,
	ShieldCheck,
} from 'lucide-react';
import type { MailMessageDetail } from '../../types';
import { useI18n } from '@/core/i18n';
import { formatMailDate, formatMailBytes } from '../../utils';
import s from '../../MailMobile.module.css';
import { MobileReplySheet } from './MobileReplySheet';

interface MobileMessageDetailScreenProps {
	activeFolderTitle: string;
	activeMessage: MailMessageDetail | null;
	isLoadingDetail: boolean;
	detailError: string | null;
	hasRemoteImages: boolean;
	loadRemoteImages: boolean;
	iframeSrcDoc: string;
	isTrashFolder: boolean;
	onBack: () => void;
	onRetryDetail: () => void;
	onLoadRemoteImages: () => void;
	onToggleStar: () => void;
	onToggleRead: () => void;
	onTrash: () => void;
	onRestore?: () => void;
	onReply: (all?: boolean) => void;
}

export function MobileMessageDetailScreen({
	activeFolderTitle,
	activeMessage,
	isLoadingDetail,
	detailError,
	hasRemoteImages,
	loadRemoteImages,
	iframeSrcDoc,
	isTrashFolder,
	onBack,
	onRetryDetail,
	onLoadRemoteImages,
	onToggleStar,
	onToggleRead,
	onTrash,
	onRestore,
	onReply,
}: MobileMessageDetailScreenProps) {
	const { t, language } = useI18n();
	const [isReplySheetOpen, setIsReplySheetOpen] = useState(false);
	const initial = (activeMessage?.from.name || activeMessage?.from.address || '?').slice(0, 1).toUpperCase();

	return (
		<div className={s.root}>
			<div className={s.navBar}>
				<button type="button" className={s.backBtn} onClick={onBack}>
					<ChevronLeft size={20} />
					<span>{activeFolderTitle}</span>
				</button>
				<span className={s.navTitle} style={{ fontSize: 13, opacity: 0.8 }}>
					{activeMessage?.subject || ''}
				</span>
				<div className={s.navActions}>
					{activeMessage && (
						<>
							<button
								type="button"
								className={s.iconBtn}
								onClick={onToggleStar}
								title={activeMessage.flagged ? t('mailUnstar') : t('mailStarAction')}
							>
								<Star
									size={16}
									color={activeMessage.flagged ? 'var(--warning)' : 'var(--text-muted)'}
									fill={activeMessage.flagged ? 'var(--warning)' : 'none'}
								/>
							</button>
							<button
								type="button"
								className={s.iconBtn}
								onClick={onToggleRead}
								title={activeMessage.seen ? t('mailMarkUnread') : t('mailMarkRead')}
							>
								{activeMessage.seen ? (
									<MailIcon size={16} color="var(--text-muted)" />
								) : (
									<MailOpen size={16} color="var(--accent)" />
								)}
							</button>
						</>
					)}
				</div>
			</div>

			{isLoadingDetail ? (
				<div className={s.centerEmptyState}>
					<RefreshCw size={28} className="spin-animation" color="var(--accent)" />
					<p style={{ fontSize: 13 }}>{t('mailLoadingDetail')}</p>
				</div>
			) : detailError ? (
				<div className={s.centerEmptyState}>
					<AlertCircle size={36} color="var(--accent)" />
					<p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{t('mailDetailErrorTitle')}</p>
					<p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 12px 0' }}>{detailError}</p>
					<button
						type="button"
						onClick={onRetryDetail}
						style={{ border: 'none', background: 'var(--accent)', color: '#ffffff', padding: '7px 16px', borderRadius: '8px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
					>
						{t('retry')}
					</button>
				</div>
			) : !activeMessage ? (
				<div className={s.centerEmptyState}>
					<MailOpen size={36} style={{ opacity: 0.4 }} />
					<p style={{ fontSize: 13 }}>{t('mailNoMessageSelected')}</p>
				</div>
			) : (
				<div className={s.detailViewContainer}>
					<div className={s.detailMetaCard}>
						<h1 className={s.detailSubjectTitle}>{activeMessage.subject || t('mailNoSubject')}</h1>
						<div className={s.detailSenderProfile}>
							<div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
								<div className={s.avatarCircle}>{initial}</div>
								<div className={s.senderTexts}>
									<span className={s.senderNameText}>{activeMessage.from.name}</span>
									<span className={s.toAddressText}>
										{t('mailToLabel')} {activeMessage.to.map((tRec) => tRec.name || tRec.address).join(', ') || t('mailNoRecipient')}
									</span>
								</div>
							</div>
							<span className={s.dateBadgeText}>{formatMailDate(activeMessage.date, language, t('mailYesterday'))}</span>
						</div>
					</div>

					{hasRemoteImages && !loadRemoteImages && (
						<div className={s.remoteBannerMobile}>
							<div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
								<ShieldCheck size={14} color="var(--accent)" />
								<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
									{t('mailRemoteImagesBlockedShort')}
								</span>
							</div>
							<button type="button" className={s.loadImagesBtn} onClick={onLoadRemoteImages}>
								{t('mailLoadImages')}
							</button>
						</div>
					)}

					<div className={s.detailBodyScroll}>
						{activeMessage.html ? (
							<iframe
								title={activeMessage.subject || 'Mail'}
								sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
								srcDoc={iframeSrcDoc}
								style={{ width: '100%', height: '100%', minHeight: '340px', border: 'none', display: 'block', background: '#ffffff' }}
							/>
						) : (
							<pre style={{ padding: 16, margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13.5, lineHeight: 1.55 }}>
								{activeMessage.text || t('mailEmptyBody')}
							</pre>
						)}
					</div>

					{activeMessage.attachments && activeMessage.attachments.length > 0 && (
						<div className={s.mobileAttachmentsRow}>
							{activeMessage.attachments.map((att, idx) => (
								<div key={idx} className={s.mobileAttachmentPill} title={att.contentType}>
									<Paperclip size={12} />
									<span>{att.filename}</span>
									<span style={{ fontSize: 9.5, opacity: 0.65 }}>({formatMailBytes(att.size)})</span>
								</div>
							))}
						</div>
					)}

					<div className={s.bottomToolbar}>
						{isTrashFolder && onRestore ? (
							<button type="button" className={s.toolbarBtn} onClick={onRestore} title={t('mailRestoreInbox')}>
								<RotateCcw size={18} />
								<span>{t('mailRestore')}</span>
							</button>
						) : null}
						<button
							type="button"
							className={`${s.toolbarBtn} ${s.toolbarBtnDestructive}`}
							onClick={onTrash}
							title={isTrashFolder ? t('mailDeletePermanent') : t('mailMoveTrash')}
						>
							<Trash2 size={18} />
							<span>{isTrashFolder ? t('mailDeletePermanentShort') : t('mailTrashShort')}</span>
						</button>
						<button type="button" className={s.toolbarBtn} onClick={onToggleStar} title={activeMessage.flagged ? t('mailUnstar') : t('mailStarAction')}>
							<Star size={18} color={activeMessage.flagged ? 'var(--warning)' : 'currentColor'} fill={activeMessage.flagged ? 'var(--warning)' : 'none'} />
							<span>{t('mailStar')}</span>
						</button>
						<button type="button" className={s.toolbarBtn} onClick={onToggleRead} title={activeMessage.seen ? t('mailMarkUnread') : t('mailMarkRead')}>
							{activeMessage.seen ? <MailIcon size={18} /> : <MailOpen size={18} />}
							<span>{activeMessage.seen ? t('mailUnread') : t('mailRead')}</span>
						</button>
						<button
							type="button"
							className={s.toolbarBtn}
							onClick={() => setIsReplySheetOpen(true)}
							title={t('mailReplyPrompt')}
							style={{ color: 'var(--accent)', fontWeight: 600 }}
						>
							<Reply size={18} />
							<span>{t('mailReplyPrompt')}</span>
						</button>
					</div>

					{isReplySheetOpen && (
						<MobileReplySheet activeMessage={activeMessage} onClose={() => setIsReplySheetOpen(false)} onReply={onReply} />
					)}
				</div>
			)}
		</div>
	);
}
