'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from '@/core/session/SessionProvider';
import { useAppCommand } from '@/core/commands';
import { useIsMobile } from '@/lib/client/useClientValue';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import type { AppID } from '@/types/workspace';
import { MailSidebar } from './components/MailSidebar';
import { MailList } from './components/MailList';
import { MailDetail } from './components/MailDetail';
import { MailComposeModal } from './components/MailComposeModal';
import { MailMobileView } from './components/MailMobileView';
import type { MailFolderInfo, MailMessageSummary, MailMessageDetail } from './types';
import { getFolderDisplayName } from './utils';
import { ShieldAlert, MailWarning, RefreshCw } from 'lucide-react';
import { useDialog } from '@/components/Common/DialogProvider';
import styles from './Mail.module.css';

interface SelectedMessageRef {
	uid: number;
	folder: string;
}

export const MailApp: React.FC = () => {
	const dialog = useDialog();
	const { isAdmin } = useSession();
	const isMobile = useIsMobile();
	const { t, language } = useI18n();
	const locale = language === 'tr' ? 'tr-TR' : 'en-US';

	const [folders, setFolders] = useState<MailFolderInfo[]>([]);
	const [activeFolder, setActiveFolder] = useState<string>('INBOX');
	const [messages, setMessages] = useState<MailMessageSummary[]>([]);
	const [page, setPage] = useState<number>(1);
	const [pageSize] = useState<number>(25);
	const [totalMessages, setTotalMessages] = useState<number>(0);

	const [selectedRef, setSelectedRef] = useState<SelectedMessageRef | null>(null);
	const [activeMessage, setActiveMessage] = useState<MailMessageDetail | null>(null);

	const [isLoadingFolders, setIsLoadingFolders] = useState<boolean>(true);
	const [isLoadingList, setIsLoadingList] = useState<boolean>(true);
	const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);

	const [searchQuery, setSearchQuery] = useState<string>('');
	const [debouncedSearch, setDebouncedSearch] = useState<string>('');
	const [userEmail, setUserEmail] = useState<string>('');

	const [error, setError] = useState<string | null>(null);
	const [detailError, setDetailError] = useState<string | null>(null);
	const [reloadToken, setReloadToken] = useState<number>(0);
	const [detailReloadToken, setDetailReloadToken] = useState<number>(0);
	const forceMailboxRefreshRef = useRef<boolean>(false);

	// Client-side cache for opened message details: key = `${folder}:${uid}`
	const detailCacheRef = useRef<Map<string, MailMessageDetail>>(new Map());
	const listRequestIdRef = useRef<number>(0);
	const detailRequestIdRef = useRef<number>(0);

	const [selectedUids, setSelectedUids] = useState<Set<number>>(new Set());

	const [isComposeOpen, setIsComposeOpen] = useState<boolean>(false);
	const [composeInitial, setComposeInitial] = useState<
		| {
				to?: string;
				subject?: string;
				body?: string;
		  }
		| undefined
	>(undefined);

	// Debounce searchQuery -> debouncedSearch
	useEffect(() => {
		const trimmed = searchQuery.trim();
		if (trimmed === debouncedSearch) return;
		const timer = setTimeout(() => {
			setPage(1);
			setDebouncedSearch(trimmed);
		}, 300);
		return () => clearTimeout(timer);
	}, [searchQuery, debouncedSearch]);

	// Single unified effect for loading folder messages + mailbox list
	useEffect(() => {
		if (!isAdmin) return;

		const reqId = ++listRequestIdRef.current;
		const controller = new AbortController();
		const shouldForceRefresh = forceMailboxRefreshRef.current;
		forceMailboxRefreshRef.current = false;

		const loadFolderData = async () => {
			setIsLoadingList(true);
			setError(null);

			try {
				const params = new URLSearchParams({
					folder: activeFolder,
					page: String(page),
					limit: String(pageSize),
				});
				if (debouncedSearch) {
					params.set('search', debouncedSearch);
				}
				if (shouldForceRefresh) {
					params.set('refresh', 'true');
				}

				const res = await fetch(`/api/mail?${params.toString()}`, {
					signal: controller.signal,
				});
				const data = await res.json().catch(() => ({}));

				if (reqId !== listRequestIdRef.current) return;

				if (!res.ok) {
					throw new Error(data.error || t('mailErrServer'));
				}

				if (Array.isArray(data.messages)) {
					setMessages(data.messages);
				}
				if (typeof data.total === 'number') {
					setTotalMessages(data.total);
				}
				if (Array.isArray(data.folders)) {
					setFolders(data.folders);
				}
				if (data.user) {
					setUserEmail(data.user);
				}
			} catch (err: unknown) {
				if (controller.signal.aborted || reqId !== listRequestIdRef.current) return;
				const msg = err instanceof Error ? err.message : t('mailErrFetch');
				setError(msg);
			} finally {
				if (reqId === listRequestIdRef.current) {
					setIsLoadingList(false);
					setIsLoadingFolders(false);
				}
			}
		};

		loadFolderData();

		return () => {
			controller.abort();
		};
	}, [isAdmin, activeFolder, page, pageSize, debouncedSearch, reloadToken, t]);

	// Fetch message detail when selectedRef changes
	useEffect(() => {
		if (!selectedRef) return;

		const { uid, folder } = selectedRef;
		const cacheKey = `${folder}:${uid}`;
		const cached = detailCacheRef.current.get(cacheKey);

		if (cached && detailReloadToken === 0) {
			setActiveMessage(cached);
			setDetailError(null);
			setIsLoadingDetail(false);
			return;
		}

		const reqId = ++detailRequestIdRef.current;
		const controller = new AbortController();

		const loadDetail = async () => {
			setIsLoadingDetail(true);
			setDetailError(null);

			try {
				const res = await fetch(
					`/api/mail/${uid}?folder=${encodeURIComponent(folder)}`,
					{ signal: controller.signal }
				);
				const data = await res.json().catch(() => ({}));

				if (reqId !== detailRequestIdRef.current) return;

				if (!res.ok) {
					throw new Error(data.error || `${t('mailErrDetailFetch')} (HTTP ${res.status})`);
				}

				detailCacheRef.current.set(cacheKey, data);
				setActiveMessage(data);

				// Mark as seen in local list & decrement unread counter if it was unread
				setMessages((prev) => {
					const target = prev.find((m) => m.uid === uid);
					if (target && !target.seen) {
						setFolders((fPrev) =>
							fPrev.map((f) =>
								f.id === folder && f.unread > 0 ? { ...f, unread: f.unread - 1 } : f
							)
						);
					}
					return prev.map((m) => (m.uid === uid ? { ...m, seen: true } : m));
				});
			} catch (err: unknown) {
				if (controller.signal.aborted || reqId !== detailRequestIdRef.current) return;
				const msg = err instanceof Error ? err.message : t('mailErrDetailFetch');
				setDetailError(msg);
			} finally {
				if (reqId === detailRequestIdRef.current) {
					setIsLoadingDetail(false);
				}
			}
		};

		loadDetail();

		return () => {
			controller.abort();
		};
	}, [selectedRef, detailReloadToken, t]);

	// Handle folder selection
	const handleSelectFolder = useCallback(
		(folderId: string) => {
			setSelectedRef(null);
			setActiveMessage(null);
			setDetailError(null);
			setSelectedUids(new Set());
			setSearchQuery('');
			setDebouncedSearch('');
			setPage(1);

			if (folderId === activeFolder) {
				forceMailboxRefreshRef.current = true;
				setReloadToken((t) => t + 1);
				return;
			}

			// Clear list immediately so stale UIDs from the old folder cannot be clicked
			setMessages([]);
			setTotalMessages(0);
			setIsLoadingList(true);
			setActiveFolder(folderId);
		},
		[activeFolder]
	);

	// Handle message selection
	const handleSelectMessage = useCallback(
		(uid: number) => {
			const msg = messages.find((m) => m.uid === uid);
			const msgFolder = msg?.folder || activeFolder;
			setDetailReloadToken(0);
			setSelectedRef({ uid, folder: msgFolder });
		},
		[messages, activeFolder]
	);

	const handleRefresh = useCallback(() => {
		setSelectedUids(new Set());
		forceMailboxRefreshRef.current = true;
		setReloadToken((t) => t + 1);
	}, []);

	// Actions: Star, Read, Trash, Restore
	const toggleStarForMessage = useCallback(async (msg: Pick<MailMessageSummary, 'uid' | 'folder' | 'flagged'>) => {
		const targetFolder = msg.folder || activeFolder;
		const nextFlagged = !msg.flagged;

		if (selectedRef?.uid === msg.uid && activeMessage) {
			const updated = { ...activeMessage, flagged: nextFlagged };
			setActiveMessage(updated);
			detailCacheRef.current.set(`${targetFolder}:${msg.uid}`, updated);
		} else {
			const cached = detailCacheRef.current.get(`${targetFolder}:${msg.uid}`);
			if (cached) {
				detailCacheRef.current.set(`${targetFolder}:${msg.uid}`, { ...cached, flagged: nextFlagged });
			}
		}

		setMessages((prev) =>
			prev.map((m) => (m.uid === msg.uid ? { ...m, flagged: nextFlagged } : m))
		);

		await fetch('/api/mail/action', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				folder: targetFolder,
				uid: msg.uid,
				action: nextFlagged ? 'star' : 'unstar',
			}),
		}).catch(() => {});
	}, [activeFolder, selectedRef, activeMessage]);

	const toggleReadForMessage = useCallback(async (msg: Pick<MailMessageSummary, 'uid' | 'folder' | 'seen'>) => {
		const targetFolder = msg.folder || activeFolder;
		const nextSeen = !msg.seen;

		if (selectedRef?.uid === msg.uid && activeMessage) {
			const updated = { ...activeMessage, seen: nextSeen };
			setActiveMessage(updated);
			detailCacheRef.current.set(`${targetFolder}:${msg.uid}`, updated);
		} else {
			const cached = detailCacheRef.current.get(`${targetFolder}:${msg.uid}`);
			if (cached) {
				detailCacheRef.current.set(`${targetFolder}:${msg.uid}`, { ...cached, seen: nextSeen });
			}
		}

		setMessages((prev) =>
			prev.map((m) => (m.uid === msg.uid ? { ...m, seen: nextSeen } : m))
		);
		setFolders((prev) =>
			prev.map((f) =>
				f.id === targetFolder
					? { ...f, unread: Math.max(0, f.unread + (nextSeen ? -1 : 1)) }
					: f
			)
		);

		await fetch('/api/mail/action', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				folder: targetFolder,
				uid: msg.uid,
				action: nextSeen ? 'read' : 'unread',
			}),
		}).catch(() => {});
	}, [activeFolder, selectedRef, activeMessage]);

	const handleToggleStar = async () => {
		if (!selectedRef || !activeMessage) return;
		await toggleStarForMessage(activeMessage);
	};

	const handleToggleRead = async () => {
		if (!selectedRef || !activeMessage) return;
		await toggleReadForMessage(activeMessage);
	};

	const activeFolderObj = folders.find((f) => f.id === activeFolder);
	const isTrashFolder =
		activeFolderObj?.role === 'trash' ||
		activeFolder.toLowerCase().includes('trash') ||
		activeFolder.toLowerCase().includes('çöp');

	const handleTrash = async () => {
		if (!selectedRef) return;
		const { uid, folder } = selectedRef;
		setSelectedRef(null);
		setActiveMessage(null);
		setDetailError(null);
		detailCacheRef.current.delete(`${folder}:${uid}`);
		setMessages((prev) => prev.filter((m) => m.uid !== uid));
		setTotalMessages((prev) => Math.max(0, prev - 1));

		await fetch('/api/mail/action', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				folder,
				uid,
				action: isTrashFolder ? 'delete' : 'trash',
			}),
		}).catch(() => {});
	};

	const handleRestore = async () => {
		if (!selectedRef) return;
		const { uid, folder } = selectedRef;
		setSelectedRef(null);
		setActiveMessage(null);
		setDetailError(null);
		detailCacheRef.current.delete(`${folder}:${uid}`);
		setMessages((prev) => prev.filter((m) => m.uid !== uid));
		setTotalMessages((prev) => Math.max(0, prev - 1));

		await fetch('/api/mail/action', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				folder,
				uid,
				action: 'restore',
			}),
		}).catch(() => {});
	};

	// Multi-select & Batch Handlers
	const handleToggleSelectUid = useCallback((uid: number) => {
		setSelectedUids((prev) => {
			const next = new Set(prev);
			if (next.has(uid)) {
				next.delete(uid);
			} else {
				next.add(uid);
			}
			return next;
		});
	}, []);

	const handleSelectAll = useCallback(() => {
		setSelectedUids(new Set(messages.map((m) => m.uid)));
	}, [messages]);

	const handleDeselectAll = useCallback(() => {
		setSelectedUids(new Set());
	}, []);

	const handleBatchTrash = useCallback(async () => {
		if (selectedUids.size === 0) return;
		const count = selectedUids.size;
		if (isTrashFolder) {
			const confirmed = await dialog.confirm({
				message: fill(t('mailBatchDeleteConfirm'), { count }),
				tone: 'danger',
			});
			if (!confirmed) return;
		}

		const uidsToDelete = Array.from(selectedUids);
		const uidsSet = new Set(selectedUids);

		// Optimistically clear selection
		setSelectedUids(new Set());

		// If currently open message is deleted, close detail view
		if (selectedRef && uidsSet.has(selectedRef.uid)) {
			setSelectedRef(null);
			setActiveMessage(null);
			setDetailError(null);
		}

		// Clear cached details for deleted items
		uidsToDelete.forEach((uid) => {
			detailCacheRef.current.delete(`${activeFolder}:${uid}`);
		});

		// Optimistically update list and total counter
		setMessages((prev) => prev.filter((m) => !uidsSet.has(m.uid)));
		setTotalMessages((prev) => Math.max(0, prev - uidsToDelete.length));

		try {
			const res = await fetch('/api/mail/action', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					folder: activeFolder,
					uids: uidsToDelete,
					action: isTrashFolder ? 'delete' : 'trash',
				}),
			});
			if (!res.ok) {
				handleRefresh();
			}
		} catch {
			handleRefresh();
		}
	}, [selectedUids, isTrashFolder, dialog, t, selectedRef, activeFolder, handleRefresh]);

	const handleBatchToggleRead = useCallback(
		async (markSeen: boolean) => {
			if (selectedUids.size === 0) return;
			const uidsToUpdate = Array.from(selectedUids);
			const uidsSet = new Set(selectedUids);

			// Optimistically update list items
			setMessages((prev) =>
				prev.map((m) => (uidsSet.has(m.uid) ? { ...m, seen: markSeen } : m))
			);

			// If current open message is affected, update active state
			if (selectedRef && uidsSet.has(selectedRef.uid) && activeMessage) {
				setActiveMessage((prev) => (prev ? { ...prev, seen: markSeen } : null));
			}

			// Update folder unread badge count
			setFolders((prev) =>
				prev.map((f) =>
					f.id === activeFolder
						? {
								...f,
								unread: markSeen
									? Math.max(0, f.unread - uidsToUpdate.length)
									: f.unread + uidsToUpdate.length,
						  }
						: f
				)
			);

			try {
				await fetch('/api/mail/action', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						folder: activeFolder,
						uids: uidsToUpdate,
						action: markSeen ? 'read' : 'unread',
					}),
				});
			} catch {
				handleRefresh();
			}
		},
		[selectedUids, selectedRef, activeMessage, activeFolder, handleRefresh]
	);

	const handleEmptyTrash = useCallback(async () => {
		if (!isTrashFolder) return;
		const confirmed = await dialog.confirm({
			message: t('mailEmptyTrashConfirm'),
			tone: 'danger',
			confirmLabel: t('mailEmptyTrash'),
		});
		if (!confirmed) return;

		// Optimistic clearing
		setSelectedRef(null);
		setActiveMessage(null);
		setDetailError(null);
		setSelectedUids(new Set());
		setMessages([]);
		setTotalMessages(0);
		detailCacheRef.current.clear();

		// Update folder counters
		setFolders((prev) =>
			prev.map((f) => (f.id === activeFolder ? { ...f, unread: 0, total: 0 } : f))
		);

		try {
			const res = await fetch('/api/mail/action', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					folder: activeFolder,
					action: 'emptyTrash',
				}),
			});
			if (!res.ok) {
				handleRefresh();
			}
		} catch {
			handleRefresh();
		}
	}, [isTrashFolder, dialog, t, activeFolder, handleRefresh]);

	// Reply handler
	const handleReply = (all: boolean = false) => {
		if (!activeMessage) return;
		let recipients = activeMessage.from.address || activeMessage.from.name;
		if (all && activeMessage.to) {
			const others = activeMessage.to
				.map((t) => t.address)
				.filter((addr) => addr && addr !== userEmail && addr !== recipients);
			if (others.length > 0) {
				recipients += `, ${others.join(', ')}`;
			}
		}
		const subject = activeMessage.subject.startsWith('Re:')
			? activeMessage.subject
			: `Re: ${activeMessage.subject}`;
		const dateStr = new Date(activeMessage.date).toLocaleString(locale);
		const replyHeader = fill(t('mailQuotedReplyHeader'), {
			date: dateStr,
			name: activeMessage.from.name || activeMessage.from.address || t('mailMemberFallback'),
			address: activeMessage.from.address || '',
		});
		const quotedBody = `\n\n${replyHeader}\n> ${activeMessage.text.replace(/\n/g, '\n> ')}`;

		setComposeInitial({
			to: recipients,
			subject,
			body: quotedBody,
		});
		setIsComposeOpen(true);
	};

	const handleOpenCompose = () => {
		setComposeInitial(undefined);
		setIsComposeOpen(true);
	};

	// Handle menu / app commands
	useAppCommand('mail' as AppID, (cmd) => {
		if (cmd === 'mail-compose') handleOpenCompose();
		if (cmd === 'mail-refresh') handleRefresh();
	});

	// Restrict to admins
	if (!isAdmin) {
		return (
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					height: '100%',
					padding: 30,
					textAlign: 'center',
					color: 'var(--text-secondary)',
				}}
			>
				<ShieldAlert size={48} color="#ff453a" style={{ marginBottom: 16 }} />
				<h2 style={{ color: 'var(--text-primary)', margin: '0 0 8px 0', fontSize: 18 }}>
					{t('mailUnauthorizedTitle')}
				</h2>
				<p style={{ maxWidth: 420, fontSize: 13, lineHeight: 1.5 }}>
					{t('mailUnauthorizedDesc')}
				</p>
			</div>
		);
	}

	if (error && folders.length === 0 && !isLoadingFolders) {
		return (
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					height: '100%',
					padding: 30,
					textAlign: 'center',
					color: 'var(--text-secondary)',
				}}
			>
				<MailWarning size={48} color="var(--accent)" style={{ marginBottom: 16 }} />
				<h2 style={{ color: 'var(--text-primary)', margin: '0 0 8px 0', fontSize: 18 }}>
					{t('mailConnErrorTitle')}
				</h2>
				<p style={{ maxWidth: 480, fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>{error}</p>
				<button
					type="button"
					className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
					onClick={handleRefresh}
				>
					<RefreshCw size={14} />
					<span>{t('retry')}</span>
				</button>
			</div>
		);
	}

	const activeFolderTitle = activeFolderObj ? getFolderDisplayName(activeFolderObj, t) : t('mailFolderInbox');
	const selectedUid = selectedRef?.uid ?? null;

	// --------------------------------------------------------------------------
	// Mobile View (< 768px): Dedicated Apple iOS Mail Experience
	// --------------------------------------------------------------------------
	if (isMobile) {
		return (
			<MailMobileView
				folders={folders}
				activeFolder={activeFolder}
				onSelectFolder={handleSelectFolder}
				messages={messages}
				totalMessages={totalMessages}
				page={page}
				pageSize={pageSize}
				onPageChange={setPage}
				selectedUid={selectedUid}
				onSelectMessage={handleSelectMessage}
				onDeselectMessage={() => {
					setSelectedRef(null);
					setActiveMessage(null);
				}}
				activeMessage={activeMessage}
				isLoadingList={isLoadingList}
				isLoadingDetail={isLoadingDetail}
				detailError={detailError}
				onRetryDetail={() => {
					if (selectedRef) {
						detailCacheRef.current.delete(`${selectedRef.folder}:${selectedRef.uid}`);
						setDetailReloadToken((t) => t + 1);
					}
				}}
				searchQuery={searchQuery}
				onSearchChange={setSearchQuery}
				onRefresh={handleRefresh}
				onToggleStar={handleToggleStar}
				onToggleRead={handleToggleRead}
				onTrash={handleTrash}
				onRestore={handleRestore}
				isTrashFolder={isTrashFolder}
				userEmail={userEmail}
				onOpenCompose={handleOpenCompose}
				onReply={handleReply}
				isComposeOpen={isComposeOpen}
				onCloseCompose={() => setIsComposeOpen(false)}
				composeInitial={composeInitial}
				onSendSuccess={handleRefresh}
				selectedUids={selectedUids}
				onToggleSelectUid={handleToggleSelectUid}
				onSelectAll={handleSelectAll}
				onDeselectAll={handleDeselectAll}
				onBatchTrash={handleBatchTrash}
				onBatchToggleRead={handleBatchToggleRead}
				onEmptyTrash={handleEmptyTrash}
			/>
		);
	}

	// --------------------------------------------------------------------------
	// Desktop View (>= 768px): macOS Sequoia 3-Pane Mail Metaphor
	// --------------------------------------------------------------------------
	return (
		<div className={styles.container}>
			<MailSidebar
				folders={folders}
				activeFolder={activeFolder}
				onSelectFolder={handleSelectFolder}
				onOpenCompose={handleOpenCompose}
				userEmail={userEmail}
				isLoading={isLoadingFolders || isLoadingList}
				onRefresh={handleRefresh}
			/>
			<MailList
				folderTitle={activeFolderTitle}
				messages={messages}
				selectedUid={selectedUid}
				onSelectMessage={handleSelectMessage}
				searchQuery={searchQuery}
				onSearchChange={setSearchQuery}
				isLoading={isLoadingList}
				onRefresh={handleRefresh}
				page={page}
				pageSize={pageSize}
				total={totalMessages}
				selectedUids={selectedUids}
				onToggleSelectUid={handleToggleSelectUid}
				onSelectAll={handleSelectAll}
				onDeselectAll={handleDeselectAll}
				onBatchTrash={handleBatchTrash}
				onBatchToggleRead={handleBatchToggleRead}
				onToggleStar={toggleStarForMessage}
				onToggleRead={toggleReadForMessage}
				isTrashFolder={isTrashFolder}
				onEmptyTrash={handleEmptyTrash}
				onPageChange={(nextPage) => {
					setSelectedRef(null);
					setActiveMessage(null);
					setSelectedUids(new Set());
					setPage(nextPage);
				}}
			/>
			<MailDetail
				message={activeMessage}
				isLoading={isLoadingDetail}
				error={detailError}
				onRetry={() => {
					if (selectedRef) {
						detailCacheRef.current.delete(`${selectedRef.folder}:${selectedRef.uid}`);
						setDetailReloadToken((t) => t + 1);
					}
				}}
				onReply={handleReply}
				onToggleStar={handleToggleStar}
				onToggleRead={handleToggleRead}
				onTrash={handleTrash}
				onRestore={isTrashFolder ? handleRestore : undefined}
				isTrashFolder={isTrashFolder}
			/>
			<MailComposeModal
				isOpen={isComposeOpen}
				onClose={() => setIsComposeOpen(false)}
				onSendSuccess={() => {
					handleRefresh();
				}}
				initial={composeInitial}
			/>
		</div>
	);
};

export default MailApp;
