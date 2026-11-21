'use client';

import { useCallback } from 'react';
import { useI18n } from '@/core/i18n';
import { useDialog } from '@/components/Common/DialogProvider';
import { fill } from '@/lib/text';
import type { MailFolderInfo, MailMessageDetail, MailMessageSummary } from '../types';
import type { SelectedMessageRef } from './useMailMailbox';

interface UseMailActionsParams {
	activeFolder: string;
	isTrashFolder: boolean;
	selectedRef: SelectedMessageRef | null;
	setSelectedRef: React.Dispatch<React.SetStateAction<SelectedMessageRef | null>>;
	activeMessage: MailMessageDetail | null;
	setActiveMessage: React.Dispatch<React.SetStateAction<MailMessageDetail | null>>;
	setDetailError: React.Dispatch<React.SetStateAction<string | null>>;
	messages: MailMessageSummary[];
	setMessages: React.Dispatch<React.SetStateAction<MailMessageSummary[]>>;
	setFolders: React.Dispatch<React.SetStateAction<MailFolderInfo[]>>;
	setTotalMessages: React.Dispatch<React.SetStateAction<number>>;
	selectedUids: Set<number>;
	setSelectedUids: React.Dispatch<React.SetStateAction<Set<number>>>;
	detailCacheRef: React.MutableRefObject<Map<string, MailMessageDetail>>;
	handleRefresh: () => void;
}

async function postMailAction(body: Record<string, unknown>) {
	return fetch('/api/mail/action', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
}

export function useMailActions({
	activeFolder,
	isTrashFolder,
	selectedRef,
	setSelectedRef,
	activeMessage,
	setActiveMessage,
	setDetailError,
	messages,
	setMessages,
	setFolders,
	setTotalMessages,
	selectedUids,
	setSelectedUids,
	detailCacheRef,
	handleRefresh,
}: UseMailActionsParams) {
	const { t } = useI18n();
	const dialog = useDialog();

	const toggleStarForMessage = useCallback(async (msg: Pick<MailMessageSummary, 'uid' | 'folder' | 'flagged'>) => {
		const targetFolder = msg.folder || activeFolder;
		const nextFlagged = !msg.flagged;
		if (selectedRef?.uid === msg.uid && activeMessage) {
			const updated = { ...activeMessage, flagged: nextFlagged };
			setActiveMessage(updated);
			detailCacheRef.current.set(`${targetFolder}:${msg.uid}`, updated);
		} else {
			const cached = detailCacheRef.current.get(`${targetFolder}:${msg.uid}`);
			if (cached) detailCacheRef.current.set(`${targetFolder}:${msg.uid}`, { ...cached, flagged: nextFlagged });
		}
		setMessages((prev) => prev.map((m) => (m.uid === msg.uid ? { ...m, flagged: nextFlagged } : m)));
		await postMailAction({ folder: targetFolder, uid: msg.uid, action: nextFlagged ? 'star' : 'unstar' }).catch(() => {});
	}, [activeFolder, selectedRef, activeMessage, setActiveMessage, setMessages, detailCacheRef]);

	const toggleReadForMessage = useCallback(async (msg: Pick<MailMessageSummary, 'uid' | 'folder' | 'seen'>) => {
		const targetFolder = msg.folder || activeFolder;
		const nextSeen = !msg.seen;
		if (selectedRef?.uid === msg.uid && activeMessage) {
			const updated = { ...activeMessage, seen: nextSeen };
			setActiveMessage(updated);
			detailCacheRef.current.set(`${targetFolder}:${msg.uid}`, updated);
		} else {
			const cached = detailCacheRef.current.get(`${targetFolder}:${msg.uid}`);
			if (cached) detailCacheRef.current.set(`${targetFolder}:${msg.uid}`, { ...cached, seen: nextSeen });
		}
		setMessages((prev) => prev.map((m) => (m.uid === msg.uid ? { ...m, seen: nextSeen } : m)));
		setFolders((prev) =>
			prev.map((f) => (f.id === targetFolder ? { ...f, unread: Math.max(0, f.unread + (nextSeen ? -1 : 1)) } : f))
		);
		await postMailAction({ folder: targetFolder, uid: msg.uid, action: nextSeen ? 'read' : 'unread' }).catch(() => {});
	}, [activeFolder, selectedRef, activeMessage, setActiveMessage, setMessages, setFolders, detailCacheRef]);

	const removeSingleMessage = async (action: 'delete' | 'trash' | 'restore') => {
		if (!selectedRef) return;
		const { uid, folder } = selectedRef;
		setSelectedRef(null);
		setActiveMessage(null);
		setDetailError(null);
		detailCacheRef.current.delete(`${folder}:${uid}`);
		setMessages((prev) => prev.filter((m) => m.uid !== uid));
		setTotalMessages((prev) => Math.max(0, prev - 1));
		await postMailAction({ folder, uid, action }).catch(() => {});
	};

	const handleToggleSelectUid = useCallback((uid: number) => {
		setSelectedUids((prev) => {
			const next = new Set(prev);
			if (next.has(uid)) next.delete(uid);
			else next.add(uid);
			return next;
		});
	}, [setSelectedUids]);

	const handleSelectAll = useCallback(() => setSelectedUids(new Set(messages.map((m) => m.uid))), [messages, setSelectedUids]);
	const handleDeselectAll = useCallback(() => setSelectedUids(new Set()), [setSelectedUids]);

	const handleBatchTrash = useCallback(async () => {
		if (selectedUids.size === 0) return;
		if (isTrashFolder) {
			const confirmed = await dialog.confirm({
				message: fill(t('mailBatchDeleteConfirm'), { count: selectedUids.size }),
				tone: 'danger',
			});
			if (!confirmed) return;
		}
		const uidsToDelete = Array.from(selectedUids);
		const uidsSet = new Set(selectedUids);
		setSelectedUids(new Set());
		if (selectedRef && uidsSet.has(selectedRef.uid)) {
			setSelectedRef(null);
			setActiveMessage(null);
			setDetailError(null);
		}
		uidsToDelete.forEach((uid) => detailCacheRef.current.delete(`${activeFolder}:${uid}`));
		setMessages((prev) => prev.filter((m) => !uidsSet.has(m.uid)));
		setTotalMessages((prev) => Math.max(0, prev - uidsToDelete.length));
		try {
			const res = await postMailAction({ folder: activeFolder, uids: uidsToDelete, action: isTrashFolder ? 'delete' : 'trash' });
			if (!res.ok) handleRefresh();
		} catch {
			handleRefresh();
		}
	}, [
		selectedUids,
		isTrashFolder,
		dialog,
		t,
		selectedRef,
		activeFolder,
		handleRefresh,
		setSelectedUids,
		setSelectedRef,
		setActiveMessage,
		setDetailError,
		detailCacheRef,
		setMessages,
		setTotalMessages,
	]);

	const handleBatchToggleRead = useCallback(async (markSeen: boolean) => {
		if (selectedUids.size === 0) return;
		const uidsToUpdate = Array.from(selectedUids);
		const uidsSet = new Set(selectedUids);
		setMessages((prev) => prev.map((m) => (uidsSet.has(m.uid) ? { ...m, seen: markSeen } : m)));
		if (selectedRef && uidsSet.has(selectedRef.uid) && activeMessage) {
			setActiveMessage((prev) => (prev ? { ...prev, seen: markSeen } : null));
		}
		setFolders((prev) =>
			prev.map((f) =>
				f.id === activeFolder
					? { ...f, unread: markSeen ? Math.max(0, f.unread - uidsToUpdate.length) : f.unread + uidsToUpdate.length }
					: f
			)
		);
		try {
			await postMailAction({ folder: activeFolder, uids: uidsToUpdate, action: markSeen ? 'read' : 'unread' });
		} catch {
			handleRefresh();
		}
	}, [selectedUids, selectedRef, activeMessage, activeFolder, handleRefresh, setMessages, setActiveMessage, setFolders]);

	const handleEmptyTrash = useCallback(async () => {
		if (!isTrashFolder) return;
		const confirmed = await dialog.confirm({
			message: t('mailEmptyTrashConfirm'),
			tone: 'danger',
			confirmLabel: t('mailEmptyTrash'),
		});
		if (!confirmed) return;
		setSelectedRef(null);
		setActiveMessage(null);
		setDetailError(null);
		setSelectedUids(new Set());
		setMessages([]);
		setTotalMessages(0);
		detailCacheRef.current.clear();
		setFolders((prev) => prev.map((f) => (f.id === activeFolder ? { ...f, unread: 0, total: 0 } : f)));
		try {
			const res = await postMailAction({ folder: activeFolder, action: 'emptyTrash' });
			if (!res.ok) handleRefresh();
		} catch {
			handleRefresh();
		}
	}, [
		isTrashFolder,
		dialog,
		t,
		activeFolder,
		handleRefresh,
		setSelectedRef,
		setActiveMessage,
		setDetailError,
		setSelectedUids,
		setMessages,
		setTotalMessages,
		detailCacheRef,
		setFolders,
	]);

	return {
		toggleStarForMessage,
		toggleReadForMessage,
		handleToggleStar: async () => { if (selectedRef && activeMessage) await toggleStarForMessage(activeMessage); },
		handleToggleRead: async () => { if (selectedRef && activeMessage) await toggleReadForMessage(activeMessage); },
		handleTrash: () => removeSingleMessage(isTrashFolder ? 'delete' : 'trash'),
		handleRestore: () => removeSingleMessage('restore'),
		handleToggleSelectUid,
		handleSelectAll,
		handleDeselectAll,
		handleBatchTrash,
		handleBatchToggleRead,
		handleEmptyTrash,
	};
}
