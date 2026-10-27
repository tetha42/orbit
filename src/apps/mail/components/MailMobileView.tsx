'use client';

import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
	ChevronLeft,
	Search,
	X,
	RefreshCw,
	Inbox,
	Star,
	Send as SendIcon,
	FileText,
	Trash2,
	AlertOctagon,
	Folder as FolderIcon,
	PenSquare,
	Mail as MailIcon,
	MailOpen,
	Paperclip,
	RotateCcw,
	Reply,
	ReplyAll,
	ChevronRight,
	AlertCircle,
	ShieldCheck,
	Check,
} from 'lucide-react';
import type {
	MailFolderInfo,
	MailMessageSummary,
	MailMessageDetail,
} from '../types';
import { useMobileSubView } from '@/lib/client/useMobileSubView';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { getFolderDisplayName, formatMailDate, formatMailBytes } from '../utils';
import s from '../MailMobile.module.css';

interface MailMobileViewProps {
	folders: MailFolderInfo[];
	activeFolder: string;
	onSelectFolder: (folderId: string) => void;
	messages: MailMessageSummary[];
	totalMessages: number;
	page: number;
	pageSize: number;
	onPageChange: (nextPage: number) => void;
	selectedUid: number | null;
	onSelectMessage: (uid: number) => void;
	onDeselectMessage: () => void;
	activeMessage: MailMessageDetail | null;
	isLoadingList: boolean;
	isLoadingDetail: boolean;
	detailError: string | null;
	onRetryDetail: () => void;
	searchQuery: string;
	onSearchChange: (q: string) => void;
	onRefresh: () => void;
	onToggleStar: () => void;
	onToggleRead: () => void;
	onTrash: () => void;
	onRestore?: () => void;
	isTrashFolder: boolean;
	userEmail: string;
	onOpenCompose: () => void;
	onReply: (all?: boolean) => void;
	isComposeOpen: boolean;
	onCloseCompose: () => void;
	composeInitial?: { to?: string; subject?: string; body?: string };
	onSendSuccess: () => void;
	selectedUids?: Set<number>;
	onToggleSelectUid?: (uid: number) => void;
	onSelectAll?: () => void;
	onDeselectAll?: () => void;
	onBatchTrash?: () => void;
	onBatchToggleRead?: (markSeen: boolean) => void;
	onEmptyTrash?: () => void;
}

interface MobileComposeSheetProps {
	composeInitial?: { to?: string; subject?: string; body?: string };
	onClose: () => void;
	onSendSuccess: () => void;
}

function MobileComposeSheet({ composeInitial, onClose, onSendSuccess }: MobileComposeSheetProps) {
	const { t } = useI18n();
	const [composeTo, setComposeTo] = useState(composeInitial?.to || '');
	const [composeSubject, setComposeSubject] = useState(composeInitial?.subject || '');
	const [composeBody, setComposeBody] = useState(composeInitial?.body || '');
	const [isSending, setIsSending] = useState(false);
	const [composeError, setComposeError] = useState<string | null>(null);

	const handleSendSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!composeTo.trim()) {
			setComposeError(t('mailErrTo'));
			return;
		}
		if (!composeSubject.trim()) {
			setComposeError(t('mailErrSubject'));
			return;
		}
		if (!composeBody.trim()) {
			setComposeError(t('mailErrBody'));
			return;
		}

		setIsSending(true);
		setComposeError(null);

		try {
			const formattedHtml = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #222;">
				${composeBody.replace(/\n/g, '<br/>')}
			</div>`;

			const res = await fetch('/api/mail', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					to: composeTo.trim(),
					subject: composeSubject.trim(),
					text: composeBody,
					html: formattedHtml,
				}),
			});

			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error(data.error || t('mailErrSend'));
			}

			onSendSuccess();
			onClose();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : t('mailErrSendGeneral');
			setComposeError(msg);
		} finally {
			setIsSending(false);
		}
	};

	return (
		<div className={s.sheetOverlay} onClick={onClose}>
			<div className={s.sheetCard} onClick={(e) => e.stopPropagation()}>
				<div className={s.sheetHeader}>
					<button
						type="button"
						className={s.sheetCancelBtn}
						onClick={onClose}
						disabled={isSending}
					>
						{t('cancel')}
					</button>

					<span className={s.sheetTitle}>
						{composeInitial?.subject ? t('mailReply') : t('mailMobTabCompose')}
					</span>

					<button
						type="button"
						className={s.sheetSendBtn}
						onClick={handleSendSubmit}
						disabled={isSending}
					>
						<SendIcon size={12} />
						<span>{isSending ? t('sending') : t('send')}</span>
					</button>
				</div>

				{composeError && (
					<div
						style={{
							padding: '8px 16px',
							background: 'rgba(255, 69, 58, 0.12)',
							color: '#ff453a',
							fontSize: 12,
							display: 'flex',
							alignItems: 'center',
							gap: 6,
						}}
					>
						<AlertCircle size={14} />
						<span>{composeError}</span>
					</div>
				)}

				<form className={s.sheetForm} onSubmit={handleSendSubmit}>
					<div className={s.sheetFieldRow}>
						<span className={s.sheetFieldLabel}>{t('mailToLabel')}</span>
						<input
							type="email"
							className={s.sheetFieldInput}
							placeholder="alici@example.com"
							value={composeTo}
							onChange={(e) => setComposeTo(e.target.value)}
							required
						/>
					</div>

					<div className={s.sheetFieldRow}>
						<span className={s.sheetFieldLabel}>{t('mailSubjectLabel')}</span>
						<input
							type="text"
							className={s.sheetFieldInput}
							placeholder={t('mailSubjectPh')}
							value={composeSubject}
							onChange={(e) => setComposeSubject(e.target.value)}
							required
						/>
					</div>

					<textarea
						className={s.sheetTextArea}
						placeholder={t('mailBodyPh')}
						value={composeBody}
						onChange={(e) => setComposeBody(e.target.value)}
						required
					/>
				</form>
			</div>
		</div>
	);
}

type MailMobileTab = 'inbox' | 'starred' | 'sent' | 'folders' | 'compose';

interface MobileBottomTabBarProps {
	tabs: Array<{
		id: MailMobileTab;
		label: string;
		badgeCount?: number;
		Icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
	}>;
	activeTabId: MailMobileTab;
	onTabChange: (tabId: MailMobileTab) => void;
	ariaLabel: string;
}

function MobileBottomTabBar({ tabs, activeTabId, onTabChange, ariaLabel }: MobileBottomTabBarProps) {
	return (
		<nav className={s.mobileBottomTabBar} role="tablist" aria-label={ariaLabel}>
			{tabs.map((tab) => {
				const activeTabMatched = activeTabId === tab.id;
				const IconComponent = tab.Icon;
				const isCompose = tab.id === 'compose';
				return (
					<button
						key={tab.id}
						type="button"
						role="tab"
						aria-selected={activeTabMatched}
						className={`${s.mobileBottomTabBtn} ${activeTabMatched ? s.mobileBottomTabBtnActive : ''}`}
						onClick={() => onTabChange(tab.id)}
						title={tab.label}
						style={isCompose ? { color: 'var(--accent)' } : undefined}
					>
						<div className={s.mobileBottomTabIconWrap}>
							<IconComponent size={20} strokeWidth={activeTabMatched ? 2.3 : 1.7} />
							{tab.badgeCount !== undefined && tab.badgeCount > 0 && (
								<span className={s.tabBadge}>{tab.badgeCount}</span>
							)}
						</div>
						<span className={s.mobileBottomTabLabel}>{tab.label}</span>
					</button>
				);
			})}
		</nav>
	);
}

export const MailMobileView: React.FC<MailMobileViewProps> = ({
	folders,
	activeFolder,
	onSelectFolder,
	messages,
	totalMessages,
	page,
	pageSize,
	onPageChange,
	selectedUid,
	onSelectMessage,
	onDeselectMessage,
	activeMessage,
	isLoadingList,
	isLoadingDetail,
	detailError,
	onRetryDetail,
	searchQuery,
	onSearchChange,
	onRefresh,
	onToggleStar,
	onToggleRead,
	onTrash,
	onRestore,
	isTrashFolder,
	userEmail,
	onOpenCompose,
	onReply,
	isComposeOpen,
	onCloseCompose,
	composeInitial,
	onSendSuccess,
	selectedUids = new Set(),
	onToggleSelectUid,
	onSelectAll,
	onDeselectAll,
	onBatchTrash,
	onBatchToggleRead,
	onEmptyTrash,
}) => {
	const { t, language } = useI18n();
	const locale = language === 'tr' ? 'tr-TR' : 'en-US';

	// Navigation stack: 'mailboxes' <-> 'list' <-> 'detail'
	const [screen, setScreen] = useState<'mailboxes' | 'list' | 'detail'>('list');
	useMobileSubView(screen === 'detail');
	const [loadRemoteImages, setLoadRemoteImages] = useState(false);
	const [isReplySheetOpen, setIsReplySheetOpen] = useState(false);
	const [isSelecting, setIsSelecting] = useState(false);

	// Keep remote images and screen in sync with selectedUid without effect cascades
	const [prevSelectedUid, setPrevSelectedUid] = useState(selectedUid);
	if (selectedUid !== prevSelectedUid) {
		setPrevSelectedUid(selectedUid);
		setLoadRemoteImages(false);
		if (selectedUid) {
			setScreen('detail');
		} else if (screen === 'detail') {
			setScreen('list');
		}
	}

	const isAllSelected = messages.length > 0 && messages.every((m) => selectedUids.has(m.uid));

	const activeFolderObj = folders.find((f) => f.id === activeFolder);
	const activeFolderTitle = activeFolderObj ? getFolderDisplayName(activeFolderObj, t) : t('mailFolderInbox');
	const totalPages = Math.max(1, Math.ceil(totalMessages / pageSize));

	const getFolderIcon = (role: MailFolderInfo['role']) => {
		switch (role) {
			case 'inbox':
				return <Inbox size={17} color="var(--accent)" />;
			case 'starred':
				return <Star size={17} color="#ffb340" fill="#ffb340" />;
			case 'sent':
				return <SendIcon size={17} color="var(--accent)" />;
			case 'drafts':
				return <FileText size={17} color="var(--text-muted)" />;
			case 'trash':
				return <Trash2 size={17} color="#ff453a" />;
			case 'spam':
				return <AlertOctagon size={17} color="#ff9f0a" />;
			default:
				return <FolderIcon size={17} color="var(--text-secondary)" />;
		}
	};

	// Isolated iframe HTML source
	const messageHtml = activeMessage?.html || '';
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
		processed = processed.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

		return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<base target="_blank" rel="noopener noreferrer" />
<style>
  html, body {
    margin: 0;
    padding: 14px 16px;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
    font-size: 13.5px;
    line-height: 1.5;
    color: #1c1c1e;
    background: #ffffff;
    word-wrap: break-word;
    overflow-x: auto;
  }
  img { max-width: 100% !important; height: auto !important; }
  a { color: #007aff; text-decoration: none; }
  pre { white-space: pre-wrap; word-break: break-word; }
  table { max-width: 100% !important; }
</style>
</head>
<body>${processed}</body>
</html>`;
	}, [messageHtml, loadRemoteImages, hasRemoteImages]);

	const inboxFolder = useMemo(
		() => folders.find((f) => f.role === 'inbox') || folders[0],
		[folders]
	);
	const starredFolder = useMemo(
		() => folders.find((f) => f.role === 'starred'),
		[folders]
	);
	const sentFolder = useMemo(
		() => folders.find((f) => f.role === 'sent'),
		[folders]
	);

	const activeTabId: MailMobileTab = useMemo(() => {
		if (screen === 'mailboxes') return 'folders';
		if (inboxFolder && activeFolder === inboxFolder.id) return 'inbox';
		if (starredFolder && activeFolder === starredFolder.id) return 'starred';
		if (sentFolder && activeFolder === sentFolder.id) return 'sent';
		return 'folders';
	}, [screen, activeFolder, inboxFolder, starredFolder, sentFolder]);

	const mailboxesScrollRef = useRef<HTMLDivElement>(null);
	const messageListScrollRef = useRef<HTMLDivElement>(null);

	const handleTabChange = useCallback(
		(tabId: MailMobileTab) => {
			if (tabId === 'compose') {
				onOpenCompose();
				return;
			}
			if (tabId === 'folders') {
				if (screen === 'mailboxes') {
					mailboxesScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
				} else {
					setScreen('mailboxes');
				}
				return;
			}
			if (tabId === 'inbox') {
				const target = inboxFolder;
				if (target) {
					if (activeFolder === target.id && screen === 'list') {
						messageListScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
					} else {
						onSelectFolder(target.id);
						setScreen('list');
						messageListScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
					}
				}
				return;
			}
			if (tabId === 'starred') {
				const target = starredFolder;
				if (target) {
					if (activeFolder === target.id && screen === 'list') {
						messageListScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
					} else {
						onSelectFolder(target.id);
						setScreen('list');
						messageListScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
					}
				}
				return;
			}
			if (tabId === 'sent') {
				const target = sentFolder;
				if (target) {
					if (activeFolder === target.id && screen === 'list') {
						messageListScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
					} else {
						onSelectFolder(target.id);
						setScreen('list');
						messageListScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
					}
				}
				return;
			}
		},
		[onOpenCompose, screen, inboxFolder, activeFolder, onSelectFolder, starredFolder, sentFolder]
	);

	const tabs: Array<{
		id: MailMobileTab;
		label: string;
		badgeCount?: number;
		Icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
	}> = [
		{
			id: 'inbox',
			label: t('mailMobTabInbox'),
			Icon: Inbox,
			badgeCount: inboxFolder && inboxFolder.unread > 0 ? inboxFolder.unread : undefined,
		},
		{
			id: 'starred',
			label: t('mailMobTabStarred'),
			Icon: Star,
			badgeCount: starredFolder && starredFolder.unread > 0 ? starredFolder.unread : undefined,
		},
		{
			id: 'sent',
			label: t('mailMobTabSent'),
			Icon: SendIcon,
			badgeCount: sentFolder && sentFolder.unread > 0 ? sentFolder.unread : undefined,
		},
		{
			id: 'folders',
			label: t('mailMobTabFolders'),
			Icon: FolderIcon,
		},
		{
			id: 'compose',
			label: t('mailMobTabCompose'),
			Icon: PenSquare,
		},
	];

	// --------------------------------------------------------------------------
	// Render Screen 1: Posta Kutuları (Mailboxes)
	// --------------------------------------------------------------------------
	if (screen === 'mailboxes') {
		return (
			<div className={s.root}>
				<div className={s.navBar}>
					<span style={{ width: 40 }} />
					<span style={{ flex: 1 }} />
					<button
						type="button"
						className={s.composeIconBtn}
						onClick={onOpenCompose}
						title={t('mailNewMessage')}
					>
						<PenSquare size={16} />
					</button>
				</div>

				<div className={s.largeTitleWrap}>
					<h1 className={s.largeTitle}>{t('mailMailboxes')}</h1>
				</div>

				<div className={s.mailboxesScroll} ref={mailboxesScrollRef}>
					<div className={s.sectionHeader}>{t('mailFolders')}</div>
					<div className={s.groupedTable}>
						{folders.map((folder) => {
							const isCurrent = activeFolder === folder.id;
							return (
								<div
									key={folder.id}
									className={s.groupedRow}
									onClick={() => {
										onSelectFolder(folder.id);
										setScreen('list');
									}}
								>
									<div className={s.groupedRowLeft}>
										{getFolderIcon(folder.role)}
										<span style={{ fontWeight: isCurrent ? 700 : 500 }}>
											{getFolderDisplayName(folder, t)}
										</span>
									</div>
									<div className={s.groupedRowRight}>
										{folder.unread > 0 && (
											<span className={s.unreadBadge}>{folder.unread}</span>
										)}
										<ChevronRight size={16} className={s.chevronRight} />
									</div>
								</div>
							);
						})}
					</div>

					<div className={s.accountInfoBar}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
							<MailIcon size={13} />
							<span>{userEmail || 'Gmail IMAP'}</span>
						</div>
						<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
							<span>{t('mailPortSsl')}</span>
							<button
								type="button"
								onClick={onRefresh}
								style={{
									border: 'none',
									background: 'transparent',
									color: 'var(--accent)',
									cursor: 'pointer',
									display: 'flex',
									padding: 2,
								}}
								title={t('refresh')}
							>
								<RefreshCw size={12} />
							</button>
						</div>
					</div>
				</div>

				<MobileBottomTabBar
					tabs={tabs}
					activeTabId={activeTabId}
					onTabChange={handleTabChange}
					ariaLabel={t('mailMobNavAria')}
				/>

				{isComposeOpen && (
					<MobileComposeSheet
						composeInitial={composeInitial}
						onClose={onCloseCompose}
						onSendSuccess={onSendSuccess}
					/>
				)}
			</div>
		);
	}

	// --------------------------------------------------------------------------
	// Render Screen 3: İleti Detayı (Message Detail)
	// --------------------------------------------------------------------------
	if (screen === 'detail') {
		const initial = (
			activeMessage?.from.name ||
			activeMessage?.from.address ||
			'?'
		)
			.slice(0, 1)
			.toUpperCase();

		return (
			<div className={s.root}>
				{/* Top Bar with back to list */}
				<div className={s.navBar}>
					<button
						type="button"
						className={s.backBtn}
						onClick={() => {
							onDeselectMessage();
							setScreen('list');
						}}
					>
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
										color={activeMessage.flagged ? '#ffb340' : 'var(--text-muted)'}
										fill={activeMessage.flagged ? '#ffb340' : 'none'}
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
						<p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
							{t('mailDetailErrorTitle')}
						</p>
						<p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 12px 0' }}>
							{detailError}
						</p>
						<button
							type="button"
							onClick={onRetryDetail}
							style={{
								border: 'none',
								background: 'var(--accent)',
								color: '#ffffff',
								padding: '7px 16px',
								borderRadius: '8px',
								fontSize: 12.5,
								fontWeight: 600,
								cursor: 'pointer',
							}}
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
						{/* Meta Header */}
						<div className={s.detailMetaCard}>
							<h1 className={s.detailSubjectTitle}>
								{activeMessage.subject || t('mailNoSubject')}
							</h1>

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
								<span className={s.dateBadgeText}>{formatMailDate(activeMessage.date, locale, t('mailYesterday'))}</span>
							</div>
						</div>

						{/* Privacy Banner if remote images exist */}
						{hasRemoteImages && !loadRemoteImages && (
							<div className={s.remoteBannerMobile}>
								<div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
									<ShieldCheck size={14} color="var(--accent)" />
									<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
										{t('mailRemoteImagesBlockedShort')}
									</span>
								</div>
								<button
									type="button"
									className={s.loadImagesBtn}
									onClick={() => setLoadRemoteImages(true)}
								>
									{t('mailLoadImages')}
								</button>
							</div>
						)}

						{/* Body */}
						<div className={s.detailBodyScroll}>
							{activeMessage.html ? (
								<iframe
									title={activeMessage.subject || 'Mail'}
									sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
									srcDoc={iframeSrcDoc}
									style={{
										width: '100%',
										height: '100%',
										minHeight: '340px',
										border: 'none',
										display: 'block',
										background: '#ffffff',
									}}
								/>
							) : (
								<pre
									style={{
										padding: 16,
										margin: 0,
										whiteSpace: 'pre-wrap',
										fontFamily: 'inherit',
										fontSize: 13.5,
										lineHeight: 1.55,
									}}
								>
									{activeMessage.text || t('mailEmptyBody')}
								</pre>
							)}
						</div>

						{/* Attachments */}
						{activeMessage.attachments && activeMessage.attachments.length > 0 && (
							<div className={s.mobileAttachmentsRow}>
								{activeMessage.attachments.map((att, idx) => (
									<div key={idx} className={s.mobileAttachmentPill} title={att.contentType}>
										<Paperclip size={12} />
										<span>{att.filename}</span>
										<span style={{ fontSize: 9.5, opacity: 0.65 }}>
											({formatMailBytes(att.size)})
										</span>
									</div>
								))}
							</div>
						)}

						{/* Fixed Bottom Frosted Toolbar (Apple Mail Style) */}
						<div className={s.bottomToolbar}>
							{isTrashFolder && onRestore ? (
								<button
									type="button"
									className={s.toolbarBtn}
									onClick={onRestore}
									title={t('mailRestoreInbox')}
								>
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

							<button
								type="button"
								className={s.toolbarBtn}
								onClick={onToggleStar}
								title={activeMessage.flagged ? t('mailUnstar') : t('mailStarAction')}
							>
								<Star
									size={18}
									color={activeMessage.flagged ? '#ffb340' : 'currentColor'}
									fill={activeMessage.flagged ? '#ffb340' : 'none'}
								/>
								<span>{t('mailStar')}</span>
							</button>

							<button
								type="button"
								className={s.toolbarBtn}
								onClick={onToggleRead}
								title={activeMessage.seen ? t('mailMarkUnread') : t('mailMarkRead')}
							>
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

						{/* Reply Action Sheet for Mobile */}
						{isReplySheetOpen && (
							<div
								className={s.sheetOverlay}
								onClick={() => setIsReplySheetOpen(false)}
							>
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
									<button
										type="button"
										onClick={() => {
											setIsReplySheetOpen(false);
											onReply(false);
										}}
										style={{
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
										}}
									>
										<Reply size={18} color="var(--accent)" />
										<span>{t('mailReplySender')}</span>
									</button>

									{activeMessage.to.length + (activeMessage.cc?.length || 0) > 1 && (
										<button
											type="button"
											onClick={() => {
												setIsReplySheetOpen(false);
												onReply(true);
											}}
											style={{
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
											}}
										>
											<ReplyAll size={18} color="var(--accent)" />
											<span>{t('mailReplyAll')}</span>
										</button>
									)}

									<button
										type="button"
										onClick={() => setIsReplySheetOpen(false)}
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
						)}
					</div>
				)}
			</div>
		);
	}

	// --------------------------------------------------------------------------
	// Render Screen 2: İleti Listesi (Message List - Default screen)
	// --------------------------------------------------------------------------
	return (
		<div className={s.root}>
			{/* Top Navigation Bar with Back to Mailboxes button & Selection Controls */}
			<div className={s.navBar}>
				{isSelecting ? (
					<>
						<button
							type="button"
							className={s.selectTextBtn}
							onClick={isAllSelected ? onDeselectAll : onSelectAll}
						>
							{isAllSelected ? t('mailDeselectAll') : t('mailSelectAll')}
						</button>

						<span className={s.navTitle} style={{ fontSize: 13, fontWeight: 600 }}>
							{fill(t('mailSelectedCount'), { count: selectedUids.size })}
						</span>

						<button
							type="button"
							className={s.selectTextBtn}
							onClick={() => {
								setIsSelecting(false);
								onDeselectAll?.();
							}}
							style={{ fontWeight: 600 }}
						>
							{t('mailDoneMode')}
						</button>
					</>
				) : (
					<>
						<button
							type="button"
							className={s.backBtn}
							onClick={() => setScreen('mailboxes')}
						>
							<ChevronLeft size={20} />
							<span>{t('mailMailboxes')}</span>
						</button>

						<span className={s.navTitle} style={{ fontSize: 13, color: 'var(--text-muted)' }}>
							{totalMessages > 0 ? fill(t('mailCountMessages'), { count: totalMessages }) : ''}
						</span>

						<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
							{messages.length > 0 && (
								<button
									type="button"
									className={s.selectTextBtn}
									onClick={() => setIsSelecting(true)}
								>
									{t('mailSelectMode')}
								</button>
							)}
							<button
								type="button"
								className={s.composeIconBtn}
								onClick={onOpenCompose}
								title={t('mailNewMessage')}
							>
								<PenSquare size={16} />
							</button>
						</div>
					</>
				)}
			</div>

			{/* Large Folder Title, Empty Trash and Quick Refresh */}
			<div className={s.largeTitleWrap}>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
					<h1 className={s.largeTitle}>{activeFolderTitle}</h1>
					<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
						{isTrashFolder && totalMessages > 0 && onEmptyTrash && (
							<button
								type="button"
								className={s.emptyTrashMobileBtn}
								onClick={onEmptyTrash}
								title={t('mailEmptyTrash')}
							>
								<Trash2 size={13} />
								<span>{t('mailEmptyTrash')}</span>
							</button>
						)}
						<button
							type="button"
							className={s.iconBtn}
							onClick={onRefresh}
							disabled={isLoadingList}
							title={t('refresh')}
						>
							<RefreshCw size={15} className={isLoadingList ? 'spin-animation' : ''} />
						</button>
					</div>
				</div>
			</div>

			{/* iOS Search Bar */}
			<div className={s.searchWrap}>
				<div className={s.searchBox}>
					<Search size={14} color="var(--text-muted)" />
					<input
						type="text"
						className={s.searchInput}
						placeholder={t('mailSearchPh')}
						value={searchQuery}
						onChange={(e) => onSearchChange(e.target.value)}
					/>
					{searchQuery && (
						<button
							type="button"
							className={s.clearSearchBtn}
							onClick={() => onSearchChange('')}
							title={t('mailClearSearch')}
						>
							<X size={14} />
						</button>
					)}
				</div>
			</div>

			{/* Scrollable Message Cards */}
			<div className={s.messageListScroll} ref={messageListScrollRef}>
				{isLoadingList && messages.length === 0 ? (
					<div className={s.centerEmptyState}>
						<RefreshCw size={26} className="spin-animation" color="var(--accent)" />
						<p style={{ fontSize: 13 }}>{t('mailLoadingList')}</p>
					</div>
				) : messages.length === 0 ? (
					<div className={s.centerEmptyState}>
						<MailOpen size={34} style={{ opacity: 0.4 }} />
						<p style={{ fontSize: 13 }}>
							{searchQuery
								? t('mailNoSearchMatch')
								: t('mailEmptyFolder')}
						</p>
					</div>
				) : (
					messages.map((msg) => {
						const isSelected = selectedUid === msg.uid;
						const isChecked = selectedUids.has(msg.uid);
						return (
							<div
								key={msg.id || msg.uid}
								className={s.messageCard}
								style={{
									borderLeft: isSelected ? '3px solid var(--accent)' : undefined,
									background: isChecked ? 'var(--accent-subtle)' : undefined,
								}}
								onClick={() => {
									if (isSelecting && onToggleSelectUid) {
										onToggleSelectUid(msg.uid);
									} else {
										onSelectMessage(msg.uid);
										setScreen('detail');
									}
								}}
							>
								<div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%' }}>
									{isSelecting && (
										<div
											className={`${s.selectionCheckbox} ${isChecked ? s.selectionCheckboxChecked : ''}`}
											style={{ marginTop: 2 }}
										>
											{isChecked && <Check size={12} strokeWidth={3} />}
										</div>
									)}
									<div style={{ flex: 1, minWidth: 0 }}>
										<div className={s.cardTopRow}>
											<div className={s.senderWrap}>
												{!msg.seen ? (
													<span className={s.unreadDot} title={t('mailUnread')} />
												) : (
													<span style={{ width: 8 }} />
												)}
												<span title={msg.from.address || msg.from.name}>
													{msg.from.name}
												</span>
											</div>
											<span
												className={`${s.cardDate} ${!msg.seen ? s.cardDateUnread : ''}`}
											>
												{formatMailDate(msg.date, locale, t('mailYesterday'))}
											</span>
										</div>

										<div className={s.cardSubject}>{msg.subject || t('mailNoSubject')}</div>

										{msg.snippet && <div className={s.cardSnippet}>{msg.snippet}</div>}

										{(msg.hasAttachments || msg.flagged) && (
											<div className={s.cardIconsRow}>
												{msg.hasAttachments && (
													<span
														title={t('mailHasAttachments')}
														style={{ display: 'inline-flex', alignItems: 'center' }}
													>
														<Paperclip size={12} />
													</span>
												)}
												{msg.flagged && (
													<span
														title={t('mailStarred')}
														style={{
															display: 'inline-flex',
															alignItems: 'center',
															color: '#ffb340',
														}}
													>
														<Star size={12} fill="#ffb340" />
													</span>
												)}
											</div>
										)}
									</div>
								</div>
							</div>
						);
					})
				)}
			</div>

			{/* Pagination Bar if multiple pages */}
			{totalPages > 1 && (
				<div
					style={{
						padding: '8px 16px',
						borderTop: '1px solid var(--border-subtle)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						fontSize: 12,
						color: 'var(--text-secondary)',
						background: 'var(--settings-sidebar-bg)',
					}}
				>
					<button
						type="button"
						style={{
							border: 'none',
							background: 'transparent',
							color: page <= 1 ? 'var(--text-muted)' : 'var(--accent)',
							fontWeight: 600,
							cursor: page <= 1 ? 'default' : 'pointer',
							padding: '4px 8px',
						}}
						disabled={page <= 1 || isLoadingList}
						onClick={() => onPageChange(page - 1)}
					>
						‹ {t('mailPrevPage')}
					</button>

					<span>
						{fill(t('mailPageOf'), { page, totalPages, n: page, total: totalPages })}
					</span>

					<button
						type="button"
						style={{
							border: 'none',
							background: 'transparent',
							color: page >= totalPages ? 'var(--text-muted)' : 'var(--accent)',
							fontWeight: 600,
							cursor: page >= totalPages ? 'default' : 'pointer',
							padding: '4px 8px',
						}}
						disabled={page >= totalPages || isLoadingList}
						onClick={() => onPageChange(page + 1)}
					>
						{t('mailNextPage')} ›
					</button>
				</div>
			)}

			{isSelecting ? (
				<div className={s.bottomToolbar}>
					<button
						type="button"
						className={s.toolbarBtn}
						onClick={() => onBatchToggleRead?.(true)}
						disabled={selectedUids.size === 0}
						style={{ opacity: selectedUids.size === 0 ? 0.4 : 1 }}
					>
						<MailOpen size={18} />
						<span>{t('mailBatchMarkRead')}</span>
					</button>

					<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
						{fill(t('mailSelectedCount'), { count: selectedUids.size })}
					</span>

					<button
						type="button"
						className={`${s.toolbarBtn} ${s.toolbarBtnDestructive}`}
						onClick={() => {
							onBatchTrash?.();
							setIsSelecting(false);
						}}
						disabled={selectedUids.size === 0}
						style={{ opacity: selectedUids.size === 0 ? 0.4 : 1 }}
					>
						<Trash2 size={18} />
						<span>{isTrashFolder ? t('mailBatchDelete') : t('mailBatchTrash')}</span>
					</button>
				</div>
			) : (
				<MobileBottomTabBar
					tabs={tabs}
					activeTabId={activeTabId}
					onTabChange={handleTabChange}
					ariaLabel={t('mailMobNavAria')}
				/>
			)}

			{isComposeOpen && (
				<MobileComposeSheet
					composeInitial={composeInitial}
					onClose={onCloseCompose}
					onSendSuccess={onSendSuccess}
				/>
			)}
		</div>
	);
};
