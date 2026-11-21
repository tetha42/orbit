'use client';

import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { useI18n } from '@/core/i18n';
import type { ChatMessageItem } from '../types';
import { ChatMessageRow } from './ChatMessageRow';
import s from '../Chat.module.css';

interface ChatMessageListProps {
	messages: ChatMessageItem[];
	currentUserId: string;
	isAdmin?: boolean;
	loading: boolean;
	hasMore?: boolean;
	loadingOlder?: boolean;
	onLoadOlder?: () => void;
	onStartEdit?: (message: ChatMessageItem) => void;
	onDelete?: (messageId: string) => void;
	onReply?: (message: ChatMessageItem) => void;
	onForward?: (message: ChatMessageItem) => void;
	onVotePoll?: (pollId: string, optionId: string) => Promise<boolean>;
	onClosePoll?: (pollId: string) => Promise<boolean>;
	focusedMessageId?: string | null;
	onFocusMessageHandled?: () => void;
}

const formatTime = (ts: number) =>
	new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatDateTime = (ts: number) => {
	const d = new Date(ts);
	return `${d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

export function ChatMessageList({
	messages,
	currentUserId,
	isAdmin = false,
	loading,
	hasMore = false,
	loadingOlder = false,
	onLoadOlder,
	onStartEdit,
	onDelete,
	onReply,
	onForward,
	onVotePoll,
	onClosePoll,
	focusedMessageId,
	onFocusMessageHandled,
}: ChatMessageListProps) {
	const { t } = useI18n();
	const bottomRef = useRef<HTMLDivElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const prevMessagesRef = useRef<ChatMessageItem[]>([]);
	const prevScrollHeightRef = useRef(0);
	const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const focusedTargetRef = useRef<HTMLElement | null>(null);

	// Keep the viewport stable when older messages are prepended, and only
	// follow new messages automatically when the reader is already near the
	// bottom (or just opened the room).
	useLayoutEffect(() => {
		const el = containerRef.current;
		const prev = prevMessagesRef.current;
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
			if (prepended) {
				el.scrollTop = el.scrollHeight - prevScrollHeightRef.current;
			} else if (messages.length > 0 && (prev.length === 0 || lastId !== prevLastId)) {
				const nearBottom =
					prev.length === 0 || el.scrollHeight - el.scrollTop - el.clientHeight < 160;
				if (nearBottom) {
					bottomRef.current?.scrollIntoView({
						behavior: prev.length === 0 ? 'auto' : 'smooth',
					});
				}
			}
			prevScrollHeightRef.current = el.scrollHeight;
		}
		prevMessagesRef.current = messages;
	}, [messages]);

	useEffect(() => {
		return () => {
			if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
		};
	}, []);

	// A notification can point at a specific message. Wait for the room's
	// messages, then reveal it (loading older pages if it is not in the first
	// window). The target is cleared after it has been shown once.
	useEffect(() => {
		if (!focusedMessageId) return;
		const container = containerRef.current;
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
			onFocusMessageHandled?.();
			return;
		}
		if (hasMore && !loadingOlder) onLoadOlder?.();
	}, [focusedMessageId, messages, hasMore, loadingOlder, onLoadOlder, onFocusMessageHandled]);

	const handleScroll = () => {
		const el = containerRef.current;
		if (!el || !hasMore || loadingOlder || !onLoadOlder) return;
		if (el.scrollTop < 80) onLoadOlder();
	};

	if (loading) {
		return (
			<div className={s.emptyState}>
				<span>{t('chatLoadingMsgs')}</span>
			</div>
		);
	}

	if (messages.length === 0) {
		return (
			<div className={s.emptyState}>
				<span style={{ fontSize: '14px', fontWeight: 600 }}>{t('chatNoMessages')}</span>
				<span style={{ fontSize: '12px' }}>{t('chatFirstMessagePrompt')}</span>
			</div>
		);
	}

	return (
		<div className={s.messagesArea} ref={containerRef} onScroll={handleScroll}>
			{hasMore && (
				<div className={s.loadOlderWrap}>
					<button
						type="button"
						className={s.loadOlderBtn}
						onClick={onLoadOlder}
						disabled={loadingOlder}
					>
						{loadingOlder ? t('chatLoadingOlder') : t('chatLoadOlder')}
					</button>
				</div>
			)}
			{messages.map((msg) => {
				if (msg.senderId === 'system') {
					return (
						<div
							key={msg.id}
							data-message-id={msg.id}
							style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}
						>
							<span
								style={{
									background: 'var(--fill-soft)',
									color: 'var(--text-secondary)',
									border: '1px solid var(--border-subtle)',
									fontSize: '11px',
									padding: '4px 14px',
									borderRadius: '12px',
									maxWidth: '85%',
									textAlign: 'center',
									backdropFilter: 'blur(4px)',
								}}
							>
								{msg.content}
							</span>
						</div>
					);
				}

				return (
					<ChatMessageRow
						key={msg.id}
						msg={msg}
						currentUserId={currentUserId}
						isAdmin={isAdmin}
						onStartEdit={onStartEdit}
						onDelete={onDelete}
						onReply={onReply}
						onForward={onForward}
						onVotePoll={onVotePoll}
						onClosePoll={onClosePoll}
						formatTime={formatTime}
						formatDateTime={formatDateTime}
					/>
				);
			})}
			<div ref={bottomRef} />
		</div>
	);
}
