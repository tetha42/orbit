'use client';

import { useEffect } from 'react';
import { showAppNotification } from '@/lib/client/notifications';
import { parseSseJson, type ChatSsePayload } from '@/lib/sse/protocol';
import { handleRealtimeCallEvent } from '../call/callStore';
import type { ChatMessageItem, ChatPollItem, ChatRoomItem } from '../types';

interface UseChatStreamParams {
	activeRoomRef: React.RefObject<string | null>;
	currentUserIdRef: React.RefObject<string | null>;
	isAdminRef: React.RefObject<boolean>;
	playSystemSoundRef: React.RefObject<() => void>;
	fetchRoomsRef: React.RefObject<() => Promise<void>>;
	setMessages: React.Dispatch<React.SetStateAction<ChatMessageItem[]>>;
	setRooms: React.Dispatch<React.SetStateAction<ChatRoomItem[]>>;
}

export function useChatStream({
	activeRoomRef,
	currentUserIdRef,
	isAdminRef,
	playSystemSoundRef,
	fetchRoomsRef,
	setMessages,
	setRooms,
}: UseChatStreamParams) {
	useEffect(() => {
		let eventSource: EventSource | null = null;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
		let reconnectAttempt = 0;
		let isUnmounted = false;

		const scheduleReconnect = () => {
			if (isUnmounted) return;
			if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
			if (reconnectTimer) clearTimeout(reconnectTimer);
			const baseDelay = Math.min(30_000, 1500 * 2 ** Math.min(reconnectAttempt, 5));
			const jitter = Math.floor(Math.random() * 500);
			reconnectAttempt++;
			reconnectTimer = setTimeout(connectStream, baseDelay + jitter);
		};

		const connectStream = () => {
			if (isUnmounted) return;
			if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
			if (eventSource) {
				eventSource.close();
				eventSource = null;
			}
			eventSource = new EventSource('/api/chat/stream');
			eventSource.addEventListener('connected', () => {
				reconnectAttempt = 0;
			});

			eventSource.addEventListener('chat', (e) => {
				try {
					const data = parseSseJson<ChatSsePayload>(e.data);
					if (!data) return;
					const rawEvent = data as unknown as Record<string, unknown>;
					if (
						(rawEvent.type === 'call_state' ||
							rawEvent.type === 'call_ended' ||
							rawEvent.type === 'call_signal') &&
						currentUserIdRef.current
					) {
						handleRealtimeCallEvent(rawEvent, currentUserIdRef.current);
						return;
					}
					if (data.type === 'new_message' && data.message) {
						const rawMsg = data.message as unknown as ChatMessageItem;
						const newMsg: ChatMessageItem = {
							...rawMsg,
							senderName: rawMsg.senderName || 'Member',
							content: rawMsg.content || '',
						};
						const myId = currentUserIdRef.current;
						const isFromOther = Boolean(myId && newMsg.senderId !== myId);
						const isActiveRoom = activeRoomRef.current === newMsg.roomId;

						if (isActiveRoom) {
							setMessages((prev) => {
								if (prev.some((m) => m.id === newMsg.id)) return prev;
								return [...prev, newMsg];
							});
							if (isFromOther) {
								void fetch('/api/chat/rooms', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({ action: 'read', roomId: newMsg.roomId }),
								});
							}
						}

						setRooms((prev) => {
							const exists = prev.some((r) => r.id === newMsg.roomId);
							if (!exists) {
								void fetchRoomsRef.current();
								return prev;
							}
							return prev.map((r) => {
								if (r.id === newMsg.roomId) {
									return {
										...r,
										lastMessage: newMsg,
										unreadCount: isActiveRoom || !isFromOther
											? 0
											: (r.unreadCount || 0) + 1,
									};
								}
								return r;
							});
						});

						if (isFromOther) {
							const isHiddenOrDifferentRoom =
								typeof document !== 'undefined' &&
								(document.visibilityState !== 'visible' || !isActiveRoom);

							if (isHiddenOrDifferentRoom) {
								playSystemSoundRef.current();
								void showAppNotification(`${newMsg.senderName}`, {
									body: newMsg.content,
									tag: `chat-${newMsg.roomId}`,
								});
							}
						}
					} else if (data.type === 'message_deleted') {
						const { roomId, messageId, deletionDate } = data;
						if (activeRoomRef.current === roomId) {
							setMessages((prev) => {
								if (isAdminRef.current) {
									return prev.map((m) =>
										m.id === messageId ? { ...m, deletionDate: Number(deletionDate) } : m
									);
								}
								return prev.filter((m) => m.id !== messageId);
							});
						}
					} else if (data.type === 'messages_cleared') {
						const { roomId, deletedIds, deletionDate } = data;
						const idSet = new Set(Array.isArray(deletedIds) ? deletedIds : []);
						if (activeRoomRef.current === roomId) {
							setMessages((prev) => {
								if (isAdminRef.current) {
									return prev.map((m) =>
										idSet.has(m.id) ? { ...m, deletionDate: Number(deletionDate) } : m
									);
								}
								return prev.filter((m) => !idSet.has(m.id));
							});
						}
					} else if (data.type === 'message_edited' && data.message) {
						const updated = data.message as unknown as ChatMessageItem;
						if (activeRoomRef.current === updated.roomId) {
							setMessages((prev) =>
								prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
							);
						}
						setRooms((prev) =>
							prev.map((r) =>
								r.id === updated.roomId && r.lastMessage?.id === updated.id
									? { ...r, lastMessage: { ...r.lastMessage, ...updated } }
									: r
							)
						);
					} else if (data.type === 'poll_updated' && data.poll) {
						const updatedPoll = data.poll as unknown as ChatPollItem;
						if (activeRoomRef.current === data.roomId) {
							setMessages((prev) =>
								prev.map((m) =>
									m.poll?.id === updatedPoll.id ? { ...m, poll: updatedPoll } : m
								)
							);
						}
					}
				} catch {
					// Invalid SSE message format ignored silently
				}
			});

			eventSource.onerror = () => {
				if (eventSource) {
					eventSource.close();
					eventSource = null;
				}
				scheduleReconnect();
			};
		};

		const onVisibilityOrOnline = () => {
			if (isUnmounted) return;
			if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
				if (reconnectTimer) {
					clearTimeout(reconnectTimer);
					reconnectTimer = null;
				}
				return;
			}
			if (!eventSource || eventSource.readyState === EventSource.CLOSED) {
				reconnectAttempt = 0;
				connectStream();
			}
		};

		connectStream();
		if (typeof document !== 'undefined') {
			document.addEventListener('visibilitychange', onVisibilityOrOnline);
		}
		if (typeof window !== 'undefined') {
			window.addEventListener('online', onVisibilityOrOnline);
		}

		return () => {
			isUnmounted = true;
			if (reconnectTimer) clearTimeout(reconnectTimer);
			if (eventSource) eventSource.close();
			if (typeof document !== 'undefined') {
				document.removeEventListener('visibilitychange', onVisibilityOrOnline);
			}
			if (typeof window !== 'undefined') {
				window.removeEventListener('online', onVisibilityOrOnline);
			}
		};
	}, [
		activeRoomRef,
		currentUserIdRef,
		isAdminRef,
		playSystemSoundRef,
		fetchRoomsRef,
		setMessages,
		setRooms,
	]);
}
