'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { Inbox, Star, Send as SendIcon, Folder as FolderIcon, PenSquare } from 'lucide-react';
import type { MailFolderInfo, MailMessageDetail, MailMessageSummary } from '../../types';
import { useMobileSubView } from '@/lib/client/useMobileSubView';
import { useI18n } from '@/core/i18n';
import { getFolderDisplayName } from '../../utils';
import { buildIframeSrcDoc } from './mailMobileUtils';
import type { MailMobileTab, MobileTabItem } from './MobileBottomTabBar';

interface UseMailMobileControllerArgs {
	folders: MailFolderInfo[];
	activeFolder: string;
	messages: MailMessageSummary[];
	totalMessages: number;
	pageSize: number;
	selectedUid: number | null;
	selectedUids: Set<number>;
	activeMessage: MailMessageDetail | null;
	onSelectFolder: (folderId: string) => void;
	onOpenCompose: () => void;
}

export function useMailMobileController({
	folders,
	activeFolder,
	messages,
	totalMessages,
	pageSize,
	selectedUid,
	selectedUids,
	activeMessage,
	onSelectFolder,
	onOpenCompose,
}: UseMailMobileControllerArgs) {
	const { t } = useI18n();
	const [screen, setScreen] = useState<'mailboxes' | 'list' | 'detail'>('list');
	useMobileSubView(screen === 'detail');
	const [loadRemoteImages, setLoadRemoteImages] = useState(false);
	const [isSelecting, setIsSelecting] = useState(false);

	const [prevSelectedUid, setPrevSelectedUid] = useState(selectedUid);
	if (selectedUid !== prevSelectedUid) {
		setPrevSelectedUid(selectedUid);
		setLoadRemoteImages(false);
		if (selectedUid) setScreen('detail');
		else if (screen === 'detail') setScreen('list');
	}

	const isAllSelected = messages.length > 0 && messages.every((m) => selectedUids.has(m.uid));
	const activeFolderObj = folders.find((f) => f.id === activeFolder);
	const activeFolderTitle = activeFolderObj ? getFolderDisplayName(activeFolderObj, t) : t('mailFolderInbox');
	const totalPages = Math.max(1, Math.ceil(totalMessages / pageSize));

	const messageHtml = activeMessage?.html || '';
	const hasRemoteImages = /<img[^>]+src=["']https?:\/\//i.test(messageHtml);
	const iframeSrcDoc = useMemo(
		() => buildIframeSrcDoc(messageHtml, loadRemoteImages, hasRemoteImages),
		[messageHtml, loadRemoteImages, hasRemoteImages]
	);

	const inboxFolder = useMemo(() => folders.find((f) => f.role === 'inbox') || folders[0], [folders]);
	const starredFolder = useMemo(() => folders.find((f) => f.role === 'starred'), [folders]);
	const sentFolder = useMemo(() => folders.find((f) => f.role === 'sent'), [folders]);

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
				if (screen === 'mailboxes') mailboxesScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
				else setScreen('mailboxes');
				return;
			}
			let target = sentFolder;
			if (tabId === 'inbox') target = inboxFolder;
			else if (tabId === 'starred') target = starredFolder;
			if (!target) return;
			if (activeFolder === target.id && screen === 'list') {
				messageListScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
			} else {
				onSelectFolder(target.id);
				setScreen('list');
				messageListScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
			}
		},
		[onOpenCompose, screen, inboxFolder, activeFolder, onSelectFolder, starredFolder, sentFolder]
	);

	const tabs: MobileTabItem[] = [
		{ id: 'inbox', label: t('mailMobTabInbox'), Icon: Inbox, badgeCount: inboxFolder?.unread || undefined },
		{ id: 'starred', label: t('mailMobTabStarred'), Icon: Star, badgeCount: starredFolder?.unread || undefined },
		{ id: 'sent', label: t('mailMobTabSent'), Icon: SendIcon, badgeCount: sentFolder?.unread || undefined },
		{ id: 'folders', label: t('mailMobTabFolders'), Icon: FolderIcon },
		{ id: 'compose', label: t('mailMobTabCompose'), Icon: PenSquare },
	];

	return {
		screen,
		setScreen,
		loadRemoteImages,
		setLoadRemoteImages,
		isSelecting,
		setIsSelecting,
		isAllSelected,
		activeFolderTitle,
		totalPages,
		hasRemoteImages,
		iframeSrcDoc,
		activeTabId,
		mailboxesScrollRef,
		messageListScrollRef,
		handleTabChange,
		tabs,
	};
}
