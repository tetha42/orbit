'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ChatAttachmentItem, ChatMessageItem } from '../types';

interface UseChatMessageActionsParams {
	activeRoomId: string | null;
	activeRoomRef: React.RefObject<string | null>;
	fetchMessages: (roomId: string) => Promise<void>;
	fetchRooms: () => Promise<void>;
	setMessages: React.Dispatch<React.SetStateAction<ChatMessageItem[]>>;
}

export function useChatMessageActions({
	activeRoomId,
	activeRoomRef,
	fetchMessages,
	fetchRooms,
	setMessages,
}: UseChatMessageActionsParams) {
	const [replyingMessage, setReplyingMessage] = useState<ChatMessageItem | null>(null);
	const [sending, setSending] = useState(false);

	useEffect(() => {
		setReplyingMessage(null);
	}, [activeRoomId]);

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
		[activeRoomId, sending, replyingMessage, setMessages]
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
		[activeRoomRef, fetchMessages, fetchRooms]
	);

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

	return {
		sending,
		replyingMessage,
		setReplyingMessage,
		cancelReply,
		sendMessage,
		forwardMessage,
		deleteMessage,
		editMessage,
	};
}
