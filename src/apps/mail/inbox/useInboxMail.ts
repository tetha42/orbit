'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MailConversation, MailFolder, MailThreadSummary } from '@/lib/messages';

interface FolderState {
	topics: MailThreadSummary[];
	total: number;
	unread: number;
}

const EMPTY: FolderState = { topics: [], total: 0, unread: 0 };

/** The internal mailbox: one folder's conversations, the open conversation and its read state. */
export function useInboxMail() {
	const [folder, setFolderState] = useState<MailFolder>('inbox');
	const [list, setList] = useState<FolderState>(EMPTY);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [thread, setThread] = useState<MailConversation | null>(null);
	const [threadLoading, setThreadLoading] = useState(false);
	const listRequest = useRef(0);
	const threadRequest = useRef(0);

	const loadList = useCallback(async (target: MailFolder) => {
		const req = ++listRequest.current;
		try {
			const res = await fetch(`/api/messages?folder=${encodeURIComponent(target)}`, { cache: 'no-store' });
			const data = await res.json().catch(() => null);
			if (req !== listRequest.current) return;
			if (!res.ok) throw new Error(data?.error || 'Failed to load mail.');
			setList({
				topics: Array.isArray(data?.topics) ? data.topics : [],
				total: Number(data?.total ?? 0),
				unread: Number(data?.unread ?? 0),
			});
			setError(null);
		} catch (e) {
			if (req !== listRequest.current) return;
			setError(e instanceof Error ? e.message : 'Failed to load mail.');
			setList(EMPTY);
		} finally {
			if (req === listRequest.current) setLoading(false);
		}
	}, []);

	const reload = useCallback(async () => {
		await loadList(folder);
	}, [folder, loadList]);

	const openThread = useCallback(
		async (id: string) => {
			const req = ++threadRequest.current;
			setThreadLoading(true);
			setError(null);
			try {
				const res = await fetch(`/api/messages/${encodeURIComponent(id)}`, { cache: 'no-store' });
				const data = await res.json().catch(() => null);
				if (req !== threadRequest.current) return;
				if (!res.ok) throw new Error(data?.error || 'Failed to load conversation.');
				setThread(data as MailConversation);
				// Reading a conversation marks it read; the folder counter follows the server.
				fetch(`/api/messages/${encodeURIComponent(id)}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: 'read' }),
				})
					.then(() => loadList(folder))
					.catch(() => {});
			} catch (e) {
				if (req !== threadRequest.current) return;
				setError(e instanceof Error ? e.message : 'Failed to load conversation.');
			} finally {
				if (req === threadRequest.current) setThreadLoading(false);
			}
		},
		[folder, loadList]
	);

	const setFolder = useCallback((next: MailFolder) => {
		threadRequest.current++;
		setFolderState(next);
		setThread(null);
		setLoading(true);
	}, []);

	useEffect(() => {
		threadRequest.current++;
		setThread(null);
		void loadList(folder);
	}, [folder, loadList]);

	return {
		folder,
		setFolder,
		topics: list.topics,
		total: list.total,
		unread: list.unread,
		loading,
		error,
		thread,
		threadLoading,
		reload,
		openThread,
		closeThread: () => {
			threadRequest.current++;
			setThread(null);
		},
	};
}
