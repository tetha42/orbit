'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { Pencil, Trash2, Reply, Forward } from 'lucide-react';
import type { ChatMessageItem } from '../types';
import { PollMessageCard } from './poll/PollMessageCard';
import { ChatAttachments } from './ChatAttachments';
import { useChatMessageMenu } from './useChatMessageMenu';
import s from '../Chat.module.css';

export interface ChatMessageRowProps {
	msg: ChatMessageItem;
	currentUserId: string;
	isAdmin: boolean;
	onStartEdit?: (message: ChatMessageItem) => void;
	onDelete?: (messageId: string) => void;
	onReply?: (message: ChatMessageItem) => void;
	onForward?: (message: ChatMessageItem) => void;
	onVotePoll?: (pollId: string, optionId: string) => Promise<boolean>;
	onClosePoll?: (pollId: string) => Promise<boolean>;
	formatTime: (timestamp: number) => string;
	formatDateTime: (timestamp: number) => string;
}

export function ChatMessageRow({
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
	const isMine = msg.senderId === currentUserId;
	const isDeleted = Boolean(msg.deletionDate);
	const isEdited = Boolean(msg.editDate) && !isDeleted;

	const { contextMenuProps, confirmDelete } = useChatMessageMenu({
		msg,
		isMine,
		isAdmin,
		isDeleted,
		onStartEdit,
		onDelete,
		onReply,
		onForward,
	});

	return (
		<div
			className={`${s.messageRow} ${isMine ? s.messageRowMine : ''} ${isDeleted ? s.messageRowDeleted : ''} cv-auto-row`}
			data-message-id={msg.id}
		>
			{!isMine && (
				<div className={s.messageAvatar}>
					{msg.senderPhoto ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							src={msg.senderPhoto}
							alt={msg.senderName || t('spotKindMember')}
							style={{ width: '100%', height: '100%', objectFit: 'cover' }}
						/>
					) : (
						(msg.senderName || '?').slice(0, 1).toUpperCase()
					)}
				</div>
			)}

			<div className={s.messageBody}>
				{!isMine && (
					<div className={s.messageHeader}>
						<span className={s.messageSender}>{msg.senderName || t('spotKindMember')}</span>
						<span>{formatTime(msg.date)}</span>
					</div>
				)}

				<div className={s.bubbleContainer} {...contextMenuProps}>
					{msg.poll ? (
						<PollMessageCard
							poll={msg.poll}
							currentUserId={currentUserId}
							isAdmin={isAdmin}
							onVote={onVotePoll || (async () => false)}
							onClosePoll={onClosePoll || (async () => false)}
						/>
					) : (
						<div
							className={`${s.messageBubble} ${
								!isDeleted && (msg.attachments?.length ?? 0) > 0 ? s.messageBubbleMedia : ''
							} ${isDeleted ? s.messageBubbleDeleted : ''}`}
						>
							{msg.isDelivered && !isDeleted && (
								<div className={`${s.forwardedTag} ${isMine ? s.forwardedTagMine : ''}`}>
									<Forward size={11} />
									<span>{t('chatForwarded')}</span>
								</div>
							)}

							{msg.repliedMessage && !isDeleted && (
								<div className={`${s.quotedBubble} ${isMine ? s.quotedBubbleMine : ''}`}>
									<div className={s.quotedBar} />
									<div className={s.quotedContent}>
										<span className={s.quotedAuthor}>{msg.repliedMessage.senderName}</span>
										<span className={s.quotedSnippet}>{msg.repliedMessage.content}</span>
									</div>
								</div>
							)}

							{isDeleted && (
								<span className={s.deletedInlineNotice}>[{t('chatDelete').toUpperCase()}] </span>
							)}
							{msg.content && <div className={s.messageTextContent}>{msg.content}</div>}
							{!isDeleted && msg.attachments?.length > 0 && <ChatAttachments attachments={msg.attachments} />}
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

					{!isDeleted && (
						<div className={s.messageActions}>
							{onReply && !msg.poll && (
								<button
									type="button"
									className={s.actionBtn}
									title={t('chatReply')}
									onClick={() => onReply(msg)}
								>
									<Reply size={12} />
								</button>
							)}
							{onForward && !msg.poll && (
								<button
									type="button"
									className={s.actionBtn}
									title={t('chatForward')}
									onClick={() => onForward(msg)}
								>
									<Forward size={12} />
								</button>
							)}
							{isMine && !msg.poll && onStartEdit && (
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
									onClick={() => void confirmDelete()}
								>
									<Trash2 size={12} />
								</button>
							)}
						</div>
					)}
				</div>

				{isDeleted && msg.deletionDate && (
					<div className={s.deletedBadge}>
						<span>🗑️ {fill(t('chatDeletedAt'), { time: formatDateTime(msg.deletionDate) })}</span>
						<span className={s.adminOnlyTag}>{t('chatAdminDeletedBadge')}</span>
					</div>
				)}

				{isEdited && msg.editDate && (
					<div className={s.editedBadge}>
						<span>✏️ {fill(t('chatEditedAt'), { time: formatTime(msg.editDate) })}</span>
					</div>
				)}
			</div>
		</div>
	);
}
