'use client';

import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { useI18n } from '@/core/i18n';
import { useDialog } from '@/components/Common/DialogProvider';
import { fill } from '@/lib/text';
import { Pencil, Trash2, Reply, Forward, Copy } from 'lucide-react';
import { useContextMenu } from '@/core/shell';
import { copyToClipboard } from '@/lib/clipboard';
import type { MenuItem } from '@/types/workspace';
import type { ChatMessageItem } from '../types';
import { PollMessageCard } from './poll/PollMessageCard';
import { ChatAttachments } from './ChatAttachments';
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
	onVotePoll?: (pollId: string, secenekId: string) => Promise<boolean>;
	onClosePoll?: (pollId: string) => Promise<boolean>;
	focusedMessageId?: string | null;
	onFocusMessageHandled?: () => void;
}

interface ChatMessageRowProps {
	msg: ChatMessageItem;
	currentUserId: string;
	isAdmin: boolean;
	onStartEdit?: (message: ChatMessageItem) => void;
	onDelete?: (messageId: string) => void;
	onReply?: (message: ChatMessageItem) => void;
	onForward?: (message: ChatMessageItem) => void;
	onVotePoll?: (pollId: string, secenekId: string) => Promise<boolean>;
	onClosePoll?: (pollId: string) => Promise<boolean>;
	formatTime: (timestamp: number) => string;
	formatDateTime: (timestamp: number) => string;
}

function ChatMessageRow({
	msg,
	currentUserId,
	isAdmin,
	onStartEdit,
	onDelete,
	onReply,
	onForward,
	onVotePoll,
	onClosePoll,
	formatTime,
	formatDateTime,
}: ChatMessageRowProps) {
	const { t } = useI18n();
	const dialog = useDialog();

	const isMine = msg.gonderenId === currentUserId;
	const isDeleted = Boolean(msg.silinmeTarihi);
	const isEdited = Boolean(msg.duzenlenmeTarihi) && !isDeleted;

	const menuItems = React.useMemo<MenuItem[]>(() => {
		if (isDeleted) return [];

		const items: MenuItem[] = [
			{
				id: `copy-${msg.id}`,
				label: t('ctxChatCopy'),
				icon: <Copy size={13} />,
				action: () => {
					void copyToClipboard(msg.icerik);
				},
			},
		];

		if (onReply && !msg.anket) {
			items.push({
				id: `reply-${msg.id}`,
				label: t('ctxChatReply'),
				icon: <Reply size={13} />,
				action: () => onReply(msg),
			});
		}

		if (onForward && !msg.anket) {
			items.push({
				id: `forward-${msg.id}`,
				label: t('ctxChatForward'),
				icon: <Forward size={13} />,
				action: () => onForward(msg),
			});
		}

		if (isMine && !msg.anket && onStartEdit) {
			items.push({
				id: `edit-${msg.id}`,
				label: t('ctxChatEdit'),
				icon: <Pencil size={13} />,
				action: () => onStartEdit(msg),
			});
		}

		if ((isMine || isAdmin) && onDelete) {
			items.push(
				{ id: `sep-${msg.id}`, label: '', separator: true },
				{
					id: `delete-${msg.id}`,
					label: t('ctxChatDelete'),
					icon: <Trash2 size={13} />,
					danger: true,
					action: async () => {
						if (await dialog.confirm({ message: t('chatDeleteConfirm'), tone: 'danger' })) {
							onDelete(msg.id);
						}
					},
				}
			);
		}

		return items;
	}, [isDeleted, msg, onReply, onForward, isMine, onStartEdit, isAdmin, onDelete, dialog, t]);

	const contextMenuProps = useContextMenu({ items: menuItems, disabled: isDeleted });

	return (
		<div
			className={`${s.messageRow} ${isMine ? s.messageRowMine : ''} ${isDeleted ? s.messageRowDeleted : ''} cv-auto-row`}
			data-message-id={msg.id}
		>
			{!isMine && (
				<div className={s.messageAvatar}>
					{msg.gonderenFoto ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							src={msg.gonderenFoto}
							alt={msg.gonderenAd || t('spotKindMember')}
							style={{ width: '100%', height: '100%', objectFit: 'cover' }}
						/>
					) : (
						(msg.gonderenAd || '?').slice(0, 1).toUpperCase()
					)}
				</div>
			)}

			<div className={s.messageBody}>
				{!isMine && (
					<div className={s.messageHeader}>
						<span className={s.messageSender}>{msg.gonderenAd || t('spotKindMember')}</span>
						<span>{formatTime(msg.date)}</span>
					</div>
				)}

				<div className={s.bubbleContainer} {...contextMenuProps}>
					{msg.anket ? (
						<PollMessageCard
							poll={msg.anket}
							currentUserId={currentUserId}
							isAdmin={isAdmin}
							onVote={onVotePoll || (async () => false)}
							onClosePoll={onClosePoll || (async () => false)}
						/>
					) : (
						<div
							className={`${s.messageBubble} ${
								!isDeleted && (msg.ekler?.length ?? 0) > 0 ? s.messageBubbleMedia : ''
							} ${isDeleted ? s.messageBubbleDeleted : ''}`}
						>
							{/* Forwarded Header */}
							{msg.iletildiMi && !isDeleted && (
								<div className={`${s.forwardedTag} ${isMine ? s.forwardedTagMine : ''}`}>
									<Forward size={11} />
									<span>{t('chatForwarded')}</span>
								</div>
							)}

							{/* Quoted Reply Bubble */}
							{msg.yanitlananMesaj && !isDeleted && (
								<div className={`${s.quotedBubble} ${isMine ? s.quotedBubbleMine : ''}`}>
									<div className={s.quotedBar} />
									<div className={s.quotedContent}>
										<span className={s.quotedAuthor}>{msg.yanitlananMesaj.gonderenAd}</span>
										<span className={s.quotedSnippet}>{msg.yanitlananMesaj.icerik}</span>
									</div>
								</div>
							)}

							{isDeleted && (
								<span className={s.deletedInlineNotice}>[{t('chatDelete').toUpperCase()}] </span>
							)}
							{msg.icerik && <div className={s.messageTextContent}>{msg.icerik}</div>}
							{!isDeleted && msg.ekler?.length > 0 && <ChatAttachments attachments={msg.ekler} />}
							{isMine && !isDeleted && (
								<div
									style={{
										fontSize: '10px',
										textAlign: 'right',
										marginTop: '4px',
										opacity: 0.7,
									}}
								>
									{formatTime(msg.date)}
								</div>
							)}
						</div>
					)}

					{/* Hover Action Menu */}
					{!isDeleted && (
						<div className={s.messageActions}>
							{onReply && !msg.anket && (
								<button
									type="button"
									className={s.actionBtn}
									title={t('chatReply')}
									onClick={() => onReply(msg)}
								>
									<Reply size={12} />
								</button>
							)}
							{onForward && !msg.anket && (
								<button
									type="button"
									className={s.actionBtn}
									title={t('chatForward')}
									onClick={() => onForward(msg)}
								>
									<Forward size={12} />
								</button>
							)}
							{isMine && !msg.anket && onStartEdit && (
								<button
									type="button"
									className={s.actionBtn}
									title={t('chatEdit')}
									onClick={() => onStartEdit(msg)}
								>
									<Pencil size={12} />
								</button>
							)}
							{(isMine || isAdmin) && onDelete && (
								<button
									type="button"
									className={`${s.actionBtn} ${s.actionBtnDanger}`}
									title={t('chatDelete')}
									onClick={async () => {
										if (await dialog.confirm({ message: t('chatDeleteConfirm'), tone: 'danger' })) {
											onDelete(msg.id);
										}
									}}
								>
									<Trash2 size={12} />
								</button>
							)}
						</div>
					)}
				</div>

				{/* Status Badges */}
				{isDeleted && msg.silinmeTarihi && (
					<div className={s.deletedBadge}>
						<span>🗑️ {fill(t('chatDeletedAt'), { time: formatDateTime(msg.silinmeTarihi) })}</span>
						<span className={s.adminOnlyTag}>{t('chatAdminDeletedBadge')}</span>
					</div>
				)}

				{isEdited && msg.duzenlenmeTarihi && (
					<div className={s.editedBadge}>
						<span>✏️ {fill(t('chatEditedAt'), { time: formatTime(msg.duzenlenmeTarihi) })}</span>
					</div>
				)}
			</div>
		</div>
	);
}

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
			target.scrollIntoView({ block: 'center', behavior: 'auto' });
			target.classList.add(s.messageFocused);
			const timer = setTimeout(() => target.classList.remove(s.messageFocused), 1400);
			onFocusMessageHandled?.();
			return () => clearTimeout(timer);
		}
		if (hasMore && !loadingOlder) onLoadOlder?.();
	}, [focusedMessageId, messages, hasMore, loadingOlder, onLoadOlder, onFocusMessageHandled]);

	const handleScroll = () => {
		const el = containerRef.current;
		if (!el || !hasMore || loadingOlder || !onLoadOlder) return;
		if (el.scrollTop < 80) onLoadOlder();
	};

	const formatTime = (ts: number) => {
		const d = new Date(ts);
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	};

	const formatDateTime = (ts: number) => {
		const d = new Date(ts);
		return `${d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
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
				// 1. WhatsApp style centered system notifications (e.g. "X created group", "Y added Z", "/clear" bot message)
				if (msg.gonderenId === 'sistem') {
					return (
						<div
							key={msg.id}
							data-message-id={msg.id}
							style={{
								display: 'flex',
								justifyContent: 'center',
								margin: '6px 0',
							}}
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
								{msg.icerik}
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
