'use client';

import { useCallback } from 'react';
import type { ChatMessageItem } from '../types';

export function useChatPolls({
	activeRoomId,
	setMessages,
}: {
	activeRoomId: string | null;
	setMessages: React.Dispatch<React.SetStateAction<ChatMessageItem[]>>;
}) {
	const votePoll = useCallback(
		async (pollId: string, optionId: string): Promise<boolean> => {
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
		},
		[setMessages]
	);

	const closePoll = useCallback(
		async (pollId: string): Promise<boolean> => {
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
		},
		[setMessages]
	);

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
		[activeRoomId, setMessages]
	);

	return { votePoll, closePoll, createPoll };
}
