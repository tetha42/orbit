'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '@/core/i18n';
import mailContract from '../mail.contract.json';
import type { MailFolderInfo, MailMessageSummary, MailMessageDetail } from '../types';

export interface SelectedMessageRef {
	uid: number;
	folder: string;
}

export function useMailMailbox(isAdmin: boolean) {
	const { t } = useI18n();
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
	const [selectedUids, setSelectedUids] = useState<Set<number>>(new Set());

	const forceMailboxRefreshRef = useRef<boolean>(false);
	const detailCacheRef = useRef<Map<string, MailMessageDetail>>(new Map());
	const listRequestIdRef = useRef<number>(0);
	const detailRequestIdRef = useRef<number>(0);

	useEffect(() => {
		const trimmed = searchQuery.trim();
		if (trimmed === debouncedSearch) return;
		const timer = setTimeout(() => {
			setPage(1);
			setDebouncedSearch(trimmed);
		}, 300);
		return () => clearTimeout(timer);
	}, [searchQuery, debouncedSearch]);

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
				const params = new URLSearchParams({ folder: activeFolder, page: String(page), limit: String(pageSize) });
				if (debouncedSearch) params.set('search', debouncedSearch);
				if (shouldForceRefresh) params.set('refresh', 'true');

				const res = await fetch(`/api/mail?${params.toString()}`, { signal: controller.signal });
				const data = await res.json().catch(() => ({}));
				if (reqId !== listRequestIdRef.current) return;
				if (data.configured === false) {
					throw new Error(data.error || t('mailErrNotConfigured'));
				}
				if (!res.ok) {
					const matched = mailContract.errorCodes.find((entry) => data.code === entry.code);
					throw new Error(matched ? t(matched.i18nKey, matched.description) : data.error || t('mailErrServer'));
				}
				if (Array.isArray(data.messages)) setMessages(data.messages);
				if (typeof data.total === 'number') setTotalMessages(data.total);
				if (Array.isArray(data.folders)) setFolders(data.folders);
				if (data.user) setUserEmail(data.user);
			} catch (err: unknown) {
				if (controller.signal.aborted || reqId !== listRequestIdRef.current) return;
				setError(err instanceof Error ? err.message : t('mailErrFetch'));
			} finally {
				if (reqId === listRequestIdRef.current) {
					setIsLoadingList(false);
					setIsLoadingFolders(false);
				}
			}
		};
		void loadFolderData();
		return () => controller.abort();
	}, [isAdmin, activeFolder, page, pageSize, debouncedSearch, reloadToken, t]);

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
				const res = await fetch(`/api/mail/${uid}?folder=${encodeURIComponent(folder)}`, { signal: controller.signal });
				const data = await res.json().catch(() => ({}));
				if (reqId !== detailRequestIdRef.current) return;
				if (!res.ok) throw new Error(data.error || `${t('mailErrDetailFetch')} (HTTP ${res.status})`);
				detailCacheRef.current.set(cacheKey, data);
				setActiveMessage(data);
				setMessages((prev) => {
					const target = prev.find((m) => m.uid === uid);
					if (target && !target.seen) {
						setFolders((fPrev) =>
							fPrev.map((f) => (f.id === folder && f.unread > 0 ? { ...f, unread: f.unread - 1 } : f))
						);
					}
					return prev.map((m) => (m.uid === uid ? { ...m, seen: true } : m));
				});
			} catch (err: unknown) {
				if (controller.signal.aborted || reqId !== detailRequestIdRef.current) return;
				setDetailError(err instanceof Error ? err.message : t('mailErrDetailFetch'));
			} finally {
				if (reqId === detailRequestIdRef.current) setIsLoadingDetail(false);
			}
		};
		void loadDetail();
		return () => controller.abort();
	}, [selectedRef, detailReloadToken, t]);

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
				setReloadToken((n) => n + 1);
				return;
			}
			setMessages([]);
			setTotalMessages(0);
			setIsLoadingList(true);
			setActiveFolder(folderId);
		},
		[activeFolder]
	);

	const handleSelectMessage = useCallback(
		(uid: number) => {
			const msg = messages.find((m) => m.uid === uid);
			setDetailReloadToken(0);
			setSelectedRef({ uid, folder: msg?.folder || activeFolder });
		},
		[messages, activeFolder]
	);

	const handleRefresh = useCallback(() => {
		setSelectedUids(new Set());
		forceMailboxRefreshRef.current = true;
		setReloadToken((n) => n + 1);
	}, []);

	return {
		folders, setFolders, activeFolder, messages, setMessages, page, setPage, pageSize,
		totalMessages, setTotalMessages, selectedRef, setSelectedRef, activeMessage, setActiveMessage,
		isLoadingFolders, isLoadingList, isLoadingDetail, searchQuery, setSearchQuery, userEmail,
		error, detailError, setDetailError, setDetailReloadToken, selectedUids, setSelectedUids,
		detailCacheRef, handleSelectFolder, handleSelectMessage, handleRefresh,
	};
}
