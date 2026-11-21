'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ChatMessageItem, ChatRoomItem } from '../types';

interface UseChatMessagesParams {
	activeRoomId: string | null;
	activeRoomRef: React.RefObject<string | null>;
	messages: ChatMessageItem[];
	setMessages: React.Dispatch<React.SetStateAction<ChatMessageItem[]>>;
	setRooms: React.Dispatch<React.SetStateAction<ChatRoomItem[]>>;
}

export function useChatMessages({
	activeRoomId,
	activeRoomRef,
	messages,
	setMessages,
	setRooms,
}: UseChatMessagesParams) {
	const [loadingMessages, setLoadingMessages] = useState(false);
	const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
	const [hasMoreMessages, setHasMoreMessages] = useState(false);

	const fetchMessagesAbortRef = useRef<AbortController | null>(null);
	const loadOlderAbortRef = useRef<AbortController | null>(null);
	const activeFetchIdRef = useRef<number>(0);
	const messagesRef = useRef<ChatMessageItem[]>([]);
	const hasMoreMessagesRef = useRef(false);
	const loadingOlderRef = useRef(false);

	useEffect(() => {
		messagesRef.current = messages;
	}, [messages]);

	const fetchMessages = useCallback(
		async (roomId: string) => {
			fetchMessagesAbortRef.current?.abort();
			loadOlderAbortRef.current?.abort();
			loadingOlderRef.current = false;
			setLoadingOlderMessages(false);
			const controller = new AbortController();
			fetchMessagesAbortRef.current = controller;
			const fetchId = ++activeFetchIdRef.current;

			setLoadingMessages(true);
			setMessages([]);
			hasMoreMessagesRef.current = false;
			setHasMoreMessages(false);

			try {
				const res = await fetch(`/api/chat/messages?roomId=${encodeURIComponent(roomId)}`, {
					cache: 'no-store',
					signal: controller.signal,
				});
				if (!res.ok) return;
				const data = await res.json();
				if (fetchId !== activeFetchIdRef.current) return;

				if (data.ok && Array.isArray(data.messages)) {
					const safeMessages: ChatMessageItem[] = data.messages.map((m: ChatMessageItem) => ({
						...m,
						senderName: m.senderName || 'Member',
						content: m.content || '',
					}));
					setMessages(safeMessages);
					const hasMore = Boolean(data.hasMore);
					hasMoreMessagesRef.current = hasMore;
					setHasMoreMessages(hasMore);
					void fetch('/api/chat/rooms', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ action: 'read', roomId }),
					});
					setRooms((prev) =>
						prev.map((r) => (r.id === roomId ? { ...r, unreadCount: 0 } : r))
					);
				}
			} catch (err: unknown) {
				if ((err as Error)?.name === 'AbortError') return;
			} finally {
				if (fetchId === activeFetchIdRef.current) {
					setLoadingMessages(false);
				}
			}
		},
		[setMessages, setRooms]
	);

	const loadOlderMessages = useCallback(async () => {
		const roomId = activeRoomRef.current;
		const oldest = messagesRef.current[0];
		if (!roomId || !oldest || loadingOlderRef.current || !hasMoreMessagesRef.current) return;

		loadingOlderRef.current = true;
		setLoadingOlderMessages(true);
		const controller = new AbortController();
		loadOlderAbortRef.current = controller;
		const fetchId = activeFetchIdRef.current;

		try {
			const params = new URLSearchParams({
				roomId,
				before: String(oldest.date),
				beforeId: oldest.id,
			});
			const res = await fetch(`/api/chat/messages?${params.toString()}`, {
				cache: 'no-store',
				signal: controller.signal,
			});
			if (!res.ok) return;
			const data = await res.json();
			if (fetchId !== activeFetchIdRef.current) return;

			if (data.ok && Array.isArray(data.messages)) {
				const olderMessages: ChatMessageItem[] = data.messages.map((m: ChatMessageItem) => ({
					...m,
					senderName: m.senderName || 'Member',
					content: m.content || '',
				}));
				setMessages((prev) => {
					const existing = new Set(prev.map((m) => m.id));
					const fresh = olderMessages.filter((m) => !existing.has(m.id));
					return fresh.length > 0 ? [...fresh, ...prev] : prev;
				});
				const hasMore = Boolean(data.hasMore);
				hasMoreMessagesRef.current = hasMore;
				setHasMoreMessages(hasMore);
			}
		} catch (err: unknown) {
			if ((err as Error)?.name !== 'AbortError') {
				console.error('[Chat] Failed to load older messages:', err);
			}
		} finally {
			if (fetchId === activeFetchIdRef.current) {
				loadingOlderRef.current = false;
				setLoadingOlderMessages(false);
			}
		}
	}, [activeRoomRef, setMessages]);

	useEffect(() => {
		if (activeRoomId) {
			void fetchMessages(activeRoomId);
		} else {
			setMessages([]);
		}
	}, [activeRoomId, fetchMessages, setMessages]);

	useEffect(() => {
		return () => {
			fetchMessagesAbortRef.current?.abort();
			loadOlderAbortRef.current?.abort();
		};
	}, []);

	const jumpToMessage = useCallback(
		async (roomId: string, messageId: string) => {
			fetchMessagesAbortRef.current?.abort();
			const controller = new AbortController();
			fetchMessagesAbortRef.current = controller;
			const fetchId = ++activeFetchIdRef.current;
			setLoadingMessages(true);
			try {
				const params = new URLSearchParams({ roomId, aroundId: messageId });
				const res = await fetch(`/api/chat/messages?${params.toString()}`, {
					cache: 'no-store',
					signal: controller.signal,
				});
				if (!res.ok) return;
				const data = await res.json();
				if (fetchId !== activeFetchIdRef.current) return;
				if (data.ok && Array.isArray(data.messages)) {
					setMessages(
						data.messages.map((m: ChatMessageItem) => ({
							...m,
							senderName: m.senderName || 'Member',
							content: m.content || '',
						}))
					);
					const hasMore = Boolean(data.hasMore);
					hasMoreMessagesRef.current = hasMore;
					setHasMoreMessages(hasMore);
				}
			} catch (err: unknown) {
				if ((err as Error)?.name === 'AbortError') return;
			} finally {
				if (fetchId === activeFetchIdRef.current) {
					setLoadingMessages(false);
				}
			}
		},
		[setMessages]
	);

	return {
		loadingMessages,
		loadingOlderMessages,
		hasMoreMessages,
		fetchMessages,
		loadOlderMessages,
		jumpToMessage,
	};
}
