'use client';

import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { ChatMessageItem } from '../../types';
import { ChatMobileMessageRow } from './ChatMobileMessageRow';
import s from '../../ChatMobile.module.css';

interface ChatMobileMessageListProps {
	screen: 'rooms' | 'chat';
	messages: ChatMessageItem[];
	currentUserId: string;
	isAdmin: boolean;
	loadingMessages: boolean;
	hasMoreMessages: boolean;
	loadingOlderMessages: boolean;
	loadOlderMessages: () => Promise<void>;
	focusedMessageId: string | null;
	clearFocusedMessage: () => void;
	activeActionsId: string | null;
	setActiveActionsId: React.Dispatch<React.SetStateAction<string | null>>;
	onReply: (msg: ChatMessageItem) => void;
	onForward: (msg: ChatMessageItem) => void;
	onStartEdit: (msg: ChatMessageItem) => void;
	onDelete: (messageId: string) => Promise<boolean>;
	onVotePoll: (pollId: string, optionId: string) => Promise<boolean>;
	onClosePoll: (pollId: string) => Promise<boolean>;
}

export function ChatMobileMessageList({
	screen,
	messages,
	currentUserId,
	isAdmin,
	loadingMessages,
	hasMoreMessages,
	loadingOlderMessages,
	loadOlderMessages,
	focusedMessageId,
	clearFocusedMessage,
	activeActionsId,
	setActiveActionsId,
	onReply,
	onForward,
	onStartEdit,
	onDelete,
	onVotePoll,
	onClosePoll,
}: ChatMobileMessageListProps) {
	const { t } = useI18n();
	const bottomRef = useRef<HTMLDivElement>(null);
	const messagesScrollRef = useRef<HTMLDivElement>(null);
	const prevMessagesRef = useRef<ChatMessageItem[]>([]);
	const prevScrollHeightRef = useRef(0);
	const prevScreenRef = useRef<'rooms' | 'chat'>('rooms');
	const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const focusedTargetRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		return () => {
			if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
		};
	}, []);

	useLayoutEffect(() => {
		if (screen !== 'chat') {
			prevMessagesRef.current = messages;
			prevScreenRef.current = screen;
			return;
		}
		const el = messagesScrollRef.current;
		const prev = prevMessagesRef.current;
		const screenChanged = prevScreenRef.current !== screen;
		const prevLastId = prev[prev.length - 1]?.id;
		const prevFirstId = prev[0]?.id;
		const lastId = messages[messages.length - 1]?.id;
		const firstId = messages[0]?.id;
		const prepended =
			prev.length > 0 &&
			messages.length > prev.length &&
			lastId === prevLastId &&
			firstId !== prevFirstId;

		if (el) {
			if (screenChanged || (messages.length > 0 && prev.length === 0)) {
				bottomRef.current?.scrollIntoView({ behavior: 'auto' });
			} else if (prepended) {
				el.scrollTop = el.scrollHeight - prevScrollHeightRef.current;
			} else if (messages.length > 0 && lastId !== prevLastId) {
				const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
				if (nearBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
			}
			prevScrollHeightRef.current = el.scrollHeight;
		}
		prevMessagesRef.current = messages;
		prevScreenRef.current = screen;
	}, [messages, screen]);

	useEffect(() => {
		if (!focusedMessageId || screen !== 'chat') return;
		const container = messagesScrollRef.current;
		if (!container) return;
		const target = container.querySelector<HTMLElement>(
			`[data-message-id="${focusedMessageId.replace(/"/g, '\\"')}"]`
		);
		if (target) {
			if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
			if (focusedTargetRef.current && focusedTargetRef.current !== target) {
				focusedTargetRef.current.classList.remove(s.messageFocused);
			}
			target.scrollIntoView({ block: 'center', behavior: 'auto' });
			target.classList.add(s.messageFocused);
			focusedTargetRef.current = target;
			focusTimerRef.current = setTimeout(() => {
				target.classList.remove(s.messageFocused);
				if (focusedTargetRef.current === target) focusedTargetRef.current = null;
				focusTimerRef.current = null;
			}, 1400);
			clearFocusedMessage();
			return;
		}
		if (hasMoreMessages && !loadingOlderMessages) void loadOlderMessages();
	}, [focusedMessageId, messages, hasMoreMessages, loadingOlderMessages, loadOlderMessages, clearFocusedMessage, screen]);

	const handleMessagesScroll = () => {
		const el = messagesScrollRef.current;
		if (!el || !hasMoreMessages || loadingOlderMessages) return;
		if (el.scrollTop < 80) void loadOlderMessages();
	};

	if (loadingMessages) {
		return <div className={s.centerState}>{t('chatLoadingMsgs')}</div>;
	}

	if (messages.length === 0) {
		return (
			<div className={s.centerState}>
				<MessageSquare size={40} opacity={0.3} color="var(--accent)" />
				<strong style={{ color: '#ffffff' }}>{t('chatNoMessages')}</strong>
				<span style={{ fontSize: '12px' }}>{t('chatFirstMessagePrompt')}</span>
			</div>
		);
	}

	return (
		<div className={s.messages} ref={messagesScrollRef} onScroll={handleMessagesScroll}>
			{hasMoreMessages && (
				<div className={s.loadOlderWrap}>
					<button
						type="button"
						className={s.loadOlderBtn}
						onClick={() => void loadOlderMessages()}
						disabled={loadingOlderMessages}
					>
						{loadingOlderMessages ? t('chatLoadingOlder') : t('chatLoadOlder')}
					</button>
				</div>
			)}
			{messages.map((msg) => {
				if (msg.senderId === 'system') {
					return (
						<div key={msg.id} className={s.systemMsg}>
							<span className={s.systemPill}>{msg.content}</span>
						</div>
					);
				}

				return (
					<ChatMobileMessageRow
						key={msg.id}
						msg={msg}
						currentUserId={currentUserId}
						isAdmin={isAdmin}
						isActionsActive={activeActionsId === msg.id}
						onToggleActions={(id) => setActiveActionsId((current) => (current === id ? null : id))}
						onShowActions={(id) => setActiveActionsId(id)}
						onReply={onReply}
						onForward={onForward}
						onStartEdit={onStartEdit}
						onDelete={onDelete}
						onVotePoll={onVotePoll}
						onClosePoll={onClosePoll}
					/>
				);
			})}
			<div ref={bottomRef} />
		</div>
	);
}
