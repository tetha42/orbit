'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from '@/core/session';
import { useSound } from '@/core/sound';
import { useWindowFocusTarget } from '@/core/windows';
import { useAppCommand } from '@/core/commands';
import {
	getNotificationPermission,
	requestNotificationPermission,
	showAppNotification,
} from '@/lib/client/notifications';
import type { ChatAttachmentItem, ChatRoomItem, ChatMessageItem, ChatPollItem } from '../types';

export function useChat(initialRoomId?: string | null) {
	const { currentUser, isAdmin } = useSession();
	const { playSystemSound } = useSound();
	const { focusTarget, clearFocusTarget } = useWindowFocusTarget();
	const [rooms, setRooms] = useState<ChatRoomItem[]>([]);
	const [activeRoomId, setActiveRoomId] = useState<string | null>(initialRoomId || null);
	const [messages, setMessages] = useState<ChatMessageItem[]>([]);
	const [replyingMessage, setReplyingMessage] = useState<ChatMessageItem | null>(null);
	const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);
	const [loadingRooms, setLoadingRooms] = useState(true);
	const [loadingMessages, setLoadingMessages] = useState(false);
	const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
	const [hasMoreMessages, setHasMoreMessages] = useState(false);
	const [sending, setSending] = useState(false);

	const activeRoomRef = useRef<string | null>(activeRoomId);
	const currentUserIdRef = useRef<string | null>(currentUser?.id ?? null);
	const isAdminRef = useRef<boolean>(Boolean(isAdmin));
	const playSystemSoundRef = useRef(playSystemSound);
	const fetchMessagesAbortRef = useRef<AbortController | null>(null);
	const loadOlderAbortRef = useRef<AbortController | null>(null);
	const activeFetchIdRef = useRef<number>(0);
	const focusTargetRef = useRef(focusTarget);
	const messagesRef = useRef<ChatMessageItem[]>([]);
	const hasMoreMessagesRef = useRef(false);
	const loadingOlderRef = useRef(false);

	useEffect(() => {
		messagesRef.current = messages;
	}, [messages]);

	useEffect(() => {
		if (initialRoomId) {
			setActiveRoomId(initialRoomId);
		}
	}, [initialRoomId]);

	useEffect(() => {
		focusTargetRef.current = focusTarget;
	}, [focusTarget]);

	useEffect(() => {
		activeRoomRef.current = activeRoomId;
	}, [activeRoomId]);

	useEffect(() => {
		currentUserIdRef.current = currentUser?.id ?? null;
		isAdminRef.current = Boolean(isAdmin);
	}, [currentUser?.id, isAdmin]);

	useEffect(() => {
		playSystemSoundRef.current = playSystemSound;
	}, [playSystemSound]);

	// Prompt for notification permission once when Chat is opened if still 'default'
	useEffect(() => {
		if (getNotificationPermission() === 'default') {
			void requestNotificationPermission().catch(() => {});
		}
	}, []);

	// 1. Fetch Rooms
	const fetchRooms = useCallback(async () => {
		try {
			const res = await fetch('/api/chat/rooms', { cache: 'no-store' });
			const data = await res.json();
			if (data.ok && Array.isArray(data.rooms)) {
				setRooms(data.rooms);
				if (!activeRoomRef.current && !focusTargetRef.current && data.rooms.length > 0) {
					setActiveRoomId(data.rooms[0].id);
				}
			}
		} catch {
			// Handled gracefully in UI
		} finally {
			setLoadingRooms(false);
		}
	}, []);

	const fetchRoomsRef = useRef(fetchRooms);
	useEffect(() => {
		fetchRoomsRef.current = fetchRooms;
	}, [fetchRooms]);

	// 2. Fetch Messages for active room with AbortController and race condition guard
	const fetchMessages = useCallback(async (roomId: string) => {
		fetchMessagesAbortRef.current?.abort();
		loadOlderAbortRef.current?.abort();
		loadingOlderRef.current = false;
		setLoadingOlderMessages(false);
		const controller = new AbortController();
		fetchMessagesAbortRef.current = controller;
		const fetchId = ++activeFetchIdRef.current;

		setLoadingMessages(true);
		setMessages([]); // Instant clean slate on room switch
		hasMoreMessagesRef.current = false;
		setHasMoreMessages(false);

		try {
			const res = await fetch(`/api/chat/messages?roomId=${encodeURIComponent(roomId)}`, {
				cache: 'no-store',
				signal: controller.signal,
			});
			if (!res.ok) return;
			const data = await res.json();
			if (fetchId !== activeFetchIdRef.current) return; // Discard stale response

			if (data.ok && Array.isArray(data.messages)) {
				const safeMessages: ChatMessageItem[] = data.messages.map((m: ChatMessageItem) => ({
					...m,
					senderName: m.senderName || 'Üye',
					content: m.content || '',
				}));
				setMessages(safeMessages);
				const hasMore = Boolean(data.hasMore);
				hasMoreMessagesRef.current = hasMore;
				setHasMoreMessages(hasMore);
				// Mark as read
				void fetch('/api/chat/rooms', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: 'read', roomId }),
				});
				// Clear unread count locally
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
	}, []);

	/**
	 * Loads the page before the oldest message currently in memory.
	 *
	 * The cursor is the oldest message's (date, id), so two messages written in
	 * the same millisecond cannot be skipped or duplicated. The component keeps
	 * its scroll position while these rows are prepended.
	 */
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
					senderName: m.senderName || 'Üye',
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
	}, []);

	useEffect(() => {
		void fetchRooms();
	}, [fetchRooms]);

	useEffect(() => {
		setReplyingMessage(null);
		if (activeRoomId) {
			void fetchMessages(activeRoomId);
		} else {
			setMessages([]);
		}
	}, [activeRoomId, fetchMessages]);

	useEffect(() => {
		return () => {
			fetchMessagesAbortRef.current?.abort();
			loadOlderAbortRef.current?.abort();
		};
	}, []);



	// Support TopBar menu command "chat-refresh"
	useAppCommand('chat', (cmd) => {
		if (cmd === 'chat-refresh') {
			void fetchRooms();
			if (activeRoomRef.current) void fetchMessages(activeRoomRef.current);
		}
	});

	// 3. Connect to SSE Stream
	useEffect(() => {
		let eventSource: EventSource | null = null;
		let isUnmounted = false;

		const connectStream = () => {
			if (isUnmounted) return;
			eventSource = new EventSource('/api/chat/stream');

			eventSource.addEventListener('chat', (e) => {
				try {
					const data = JSON.parse(e.data);
					if (data.type === 'new_message' && data.message) {
						const rawMsg = data.message as ChatMessageItem;
						const newMsg: ChatMessageItem = {
							...rawMsg,
							senderName: rawMsg.senderName || 'Üye',
							content: rawMsg.content || '',
						};
						const myId = currentUserIdRef.current;
						const isFromOther = Boolean(myId && newMsg.senderId !== myId);
						const isActiveRoom = activeRoomRef.current === newMsg.roomId;

						// If active room, append message and mark read on server
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

						// Update room's latest message and unread count, or fetch rooms if this is a brand-new DM/Group
						setRooms((prev) => {
							const exists = prev.some((r) => r.id === newMsg.roomId);
							if (!exists) {
								void fetchRoomsRef.current();
								return prev;
							}
							const updated = prev.map((r) => {
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
							// Keep general rooms at top, sort others by newest message
							return updated;
						});

						// Show notification & play sound if message is from another user
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
						const updated = data.message as ChatMessageItem;
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
						const updatedPoll = data.poll as ChatPollItem;
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
				if (!isUnmounted) {
					setTimeout(connectStream, 4000);
				}
			};
		};

		connectStream();

		return () => {
			isUnmounted = true;
			if (eventSource) eventSource.close();
		};
	}, []);

	// 4. Send Message
	const sendMessage = useCallback(
		async (content: string, attachments: ChatAttachmentItem[] = []) => {
			if (!activeRoomId || (!content.trim() && attachments.length === 0) || sending) return false;
			setSending(true);
			const repliedMessageId = replyingMessage ? replyingMessage.id : null;
			const repliedMessage = replyingMessage
				? {
						id: replyingMessage.id,
						senderName: replyingMessage.senderName,
						content: replyingMessage.content.slice(0, 200),
				  }
				: null;
			try {
				const res = await fetch('/api/chat/messages', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						roomId: activeRoomId,
						content: content.trim(),
						attachments,
						repliedMessageId,
						repliedMessage,
					}),
				});
				const data = await res.json();
				if (data.ok && data.message) {
					setReplyingMessage(null);
					setMessages((prev) => {
						if (prev.some((m) => m.id === data.message.id)) return prev;
						return [...prev, data.message];
					});
					return true;
				}
				return false;
			} catch {
				return false;
			} finally {
				setSending(false);
			}
		},
		[activeRoomId, sending, replyingMessage]
	);

	const cancelReply = useCallback(() => {
		setReplyingMessage(null);
	}, []);

	const forwardMessage = useCallback(
		async (messageId: string, targetRoomIds: string[]): Promise<{ ok: boolean; count?: number }> => {
			if (!messageId || !Array.isArray(targetRoomIds) || targetRoomIds.length === 0) {
				return { ok: false };
			}
			try {
				const res = await fetch('/api/chat/messages', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						action: 'forward',
						messageId,
						targetRoomIds,
					}),
				});
				const data = await res.json();
				if (data.ok) {
					if (activeRoomRef.current && targetRoomIds.includes(activeRoomRef.current)) {
						void fetchMessages(activeRoomRef.current);
					}
					void fetchRooms();
					return { ok: true, count: data.forwardedCount };
				}
				return { ok: false };
			} catch {
				return { ok: false };
			}
		},
		[fetchMessages, fetchRooms]
	);

	const selectRoom = useCallback((roomId: string) => {
		setFocusedMessageId(null);
		setActiveRoomId(roomId);
	}, []);

	const createDm = useCallback(async (targetUserId: string): Promise<string | null> => {
		// Reuse a room the state already knows about; this also avoids a request
		// when a member card is clicked twice before the rooms list refreshes.
		const known = rooms.find((room) => room.typeValue === 'ozel' && room.peerUserId === targetUserId);
		if (known) {
			setActiveRoomId(known.id);
			return known.id;
		}
		try {
			const res = await fetch('/api/chat/rooms', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'create_dm', targetUserId }),
			});
			const data = await res.json();
			if (data.ok && data.roomId) {
				await fetchRooms();
				setActiveRoomId(data.roomId);
				return data.roomId;
			}
			return null;
		} catch {
			return null;
		}
	}, [fetchRooms, rooms]);

	const createGroupDm = useCallback(async (memberIds: string[], title?: string): Promise<string | null> => {
		try {
			const res = await fetch('/api/chat/rooms', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'create_group_dm', memberIds, title }),
			});
			const data = await res.json();
			if (data.ok && data.roomId) {
				await fetchRooms();
				setActiveRoomId(data.roomId);
				return data.roomId;
			}
			return null;
		} catch {
			return null;
		}
	}, [fetchRooms]);

	const addMembers = useCallback(async (roomId: string, memberIds: string[]): Promise<boolean> => {
		try {
			const res = await fetch('/api/chat/rooms', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'add_members', roomId, memberIds }),
			});
			const data = await res.json();
			if (data.ok) {
				await fetchRooms();
				await fetchMessages(roomId);
				return true;
			}
			return false;
		} catch {
			return false;
		}
	}, [fetchRooms, fetchMessages]);

	const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
		try {
			const res = await fetch(`/api/chat/messages?id=${encodeURIComponent(messageId)}`, {
				method: 'DELETE',
			});
			const data = await res.json();
			return Boolean(data.ok);
		} catch {
			return false;
		}
	}, []);

	const editMessage = useCallback(async (messageId: string, newContent: string): Promise<boolean> => {
		try {
			const res = await fetch('/api/chat/messages', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: messageId, content: newContent }),
			});
			const data = await res.json();
			return Boolean(data.ok);
		} catch {
			return false;
		}
	}, []);

	const votePoll = useCallback(async (pollId: string, optionId: string): Promise<boolean> => {
		try {
			const res = await fetch('/api/chat/poll', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'vote', pollId, optionId }),
			});
			const data = await res.json();
			if (data.ok && data.poll) {
				setMessages((prev) =>
					prev.map((m) => (m.poll?.id === pollId ? { ...m, poll: data.poll } : m))
				);
				return true;
			}
			return false;
		} catch {
			return false;
		}
	}, []);

	const closePoll = useCallback(async (pollId: string): Promise<boolean> => {
		try {
			const res = await fetch('/api/chat/poll', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'close', pollId }),
			});
			const data = await res.json();
			if (data.ok && data.poll) {
				setMessages((prev) =>
					prev.map((m) => (m.poll?.id === pollId ? { ...m, poll: data.poll } : m))
				);
				return true;
			}
			return false;
		} catch {
			return false;
		}
	}, []);

	const createPoll = useCallback(
		async (pollData: {
			question: string;
			options: string[];
			multipleSelection: boolean;
			anonymous: boolean;
			endsAt?: number | null;
			sureSeconds?: number | null;
		}): Promise<boolean> => {
			if (!activeRoomId) return false;
			try {
				const res = await fetch('/api/chat/poll', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: 'create', roomId: activeRoomId, ...pollData }),
				});
				const data = await res.json();
				if (data.ok && data.message) {
					setMessages((prev) => {
						if (prev.some((m) => m.id === data.message.id)) return prev;
						return [...prev, data.message];
					});
					return true;
				}
				return false;
			} catch {
				return false;
			}
		},
		[activeRoomId]
	);

	// Reveal target thread when clicked from Notification Center, Spotlight, or Member Card
	useEffect(() => {
		if (focusTarget && focusTarget.appId === 'chat') {
			const { section, itemId, kind, parentId } = focusTarget;
			if (kind === 'thread' && itemId) {
				setActiveRoomId(itemId);
				setFocusedMessageId(parentId || null);
			} else if (section === 'compose' || kind === 'dm') {
				if (itemId) {
					const existingDm = rooms.find(
						(r) => r.typeValue === 'ozel' && r.peerUserId === itemId
					);
					if (existingDm) {
						setActiveRoomId(existingDm.id);
					} else {
						void createDm(itemId);
					}
				}
			} else if (itemId) {
				setActiveRoomId(itemId);
			}
			clearFocusTarget(focusTarget.nonce);
		}
	}, [focusTarget, clearFocusTarget, rooms, createDm]);

	const activeRoom = rooms.find((r) => r.id === activeRoomId) || null;

	return {
		rooms,
		activeRoom,
		activeRoomId,
		messages,
		loadingRooms,
		loadingMessages,
		loadingOlderMessages,
		hasMoreMessages,
		loadOlderMessages,
		sending,
		sendMessage,
		deleteMessage,
		editMessage,
		selectRoom,
		refreshRooms: fetchRooms,
		refreshMessages: () => {
			if (activeRoomRef.current) void fetchMessages(activeRoomRef.current);
		},
		createDm,
		createGroupDm,
		addMembers,
		createPoll,
		votePoll,
		closePoll,
		replyingMessage,
		focusedMessageId,
		clearFocusedMessage: () => setFocusedMessageId(null),
		setReplyingMessage,
		cancelReply,
		forwardMessage,
	};
}
