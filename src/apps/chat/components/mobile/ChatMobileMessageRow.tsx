'use client';

import React from 'react';
import { Pencil, Trash2, Reply, Forward } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useDialog } from '@/components/Common/DialogProvider';
import { fill } from '@/lib/text';
import type { ChatMessageItem } from '../../types';
import { PollMessageCard } from '../poll/PollMessageCard';
import { ChatAttachments } from '../ChatAttachments';
import { formatChatDateTime, formatChatTime } from './chatMobileFormat';
import s from '../../ChatMobile.module.css';

interface ChatMobileMessageRowProps {
	msg: ChatMessageItem;
	currentUserId: string;
	isAdmin: boolean;
	isActionsActive: boolean;
	onToggleActions: (msgId: string) => void;
	onShowActions: (msgId: string) => void;
	onReply: (msg: ChatMessageItem) => void;
	onForward: (msg: ChatMessageItem) => void;
	onStartEdit: (msg: ChatMessageItem) => void;
	onDelete: (messageId: string) => Promise<boolean>;
	onVotePoll: (pollId: string, optionId: string) => Promise<boolean>;
	onClosePoll: (pollId: string) => Promise<boolean>;
}

export function ChatMobileMessageRow({
	msg,
	currentUserId,
	isAdmin,
	isActionsActive,
	onToggleActions,
	onShowActions,
	onReply,
	onForward,
	onStartEdit,
	onDelete,
	onVotePoll,
	onClosePoll,
}: ChatMobileMessageRowProps) {
	const { t } = useI18n();
	const dialog = useDialog();

	const isMine = msg.senderId === currentUserId;
	const isDeleted = Boolean(msg.deletionDate);
	const isEdited = Boolean(msg.editDate) && !isDeleted;

	return (
		<div
			data-message-id={msg.id}
			className={`${s.msgRow} ${isMine ? s.msgRowMine : ''} ${isDeleted ? s.msgRowDeleted : ''} ${
				isActionsActive ? s.msgActionsVisible : ''
			}`}
		>
			{!isMine && (
				<div className={s.msgAvatar}>
					{msg.senderPhoto ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img src={msg.senderPhoto} alt={msg.senderName || t('spotKindMember')} />
					) : (
						(msg.senderName || '?').slice(0, 1).toUpperCase()
					)}
				</div>
			)}

			<div className={s.msgBody}>
				{!isMine && (
					<span className={s.msgSender}>{msg.senderName || t('spotKindMember')}</span>
				)}
				<div className={s.bubbleWrap}>
					{msg.poll ? (
						<PollMessageCard
							poll={msg.poll}
							currentUserId={currentUserId}
							isAdmin={isAdmin}
							onVote={onVotePoll}
							onClosePoll={onClosePoll}
						/>
					) : (
						<div
							className={`${s.bubble} ${isMine ? s.bubbleMine : ''} ${
								!isDeleted && (msg.attachments?.length ?? 0) > 0 ? s.bubbleMedia : ''
							} ${isDeleted ? s.bubbleDeleted : ''}`}
							onClick={(event) => {
								const target = event.target as HTMLElement;
								if (target.closest('button, a, img, video, audio, iframe, input, textarea, select')) return;
								onToggleActions(msg.id);
							}}
							onContextMenu={(event) => {
								event.preventDefault();
								onShowActions(msg.id);
							}}
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

							{isDeleted && <span className={s.deletedInlineNotice}>[{t('chatDelete').toUpperCase()}] </span>}
							{msg.content && <div className={s.msgTextContent}>{msg.content}</div>}
							{!isDeleted && msg.attachments?.length > 0 && <ChatAttachments attachments={msg.attachments} />}
							<div className={s.bubbleTime}>{formatChatTime(msg.date)}</div>
						</div>
					)}

					{!isDeleted && (
						<div className={s.mobileMsgActions}>
							{!msg.poll && (
								<button
									type="button"
									className={s.mobileActionBtn}
									onClick={() => onReply(msg)}
									title={t('chatReply')}
								>
									<Reply size={11} />
								</button>
							)}
							{!msg.poll && (
								<button
									type="button"
									className={s.mobileActionBtn}
									onClick={() => onForward(msg)}
									title={t('chatForward')}
								>
									<Forward size={11} />
								</button>
							)}
							{isMine && !msg.poll && (
								<button
									type="button"
									className={s.mobileActionBtn}
									onClick={() => onStartEdit(msg)}
									title={t('chatEdit')}
								>
									<Pencil size={11} />
								</button>
							)}
							{(isMine || isAdmin) && (
								<button
									type="button"
									className={`${s.mobileActionBtn} ${s.mobileActionBtnDanger}`}
									onClick={async () => {
										if (await dialog.confirm({ message: t('chatDeleteConfirm'), tone: 'danger' })) {
											void onDelete(msg.id);
										}
									}}
									title={t('chatDelete')}
								>
									<Trash2 size={11} />
								</button>
							)}
						</div>
					)}
				</div>

				{isDeleted && msg.deletionDate && (
					<div className={s.deletedBadge}>
						<span>🗑️ {fill(t('chatDeletedAt'), { time: formatChatDateTime(msg.deletionDate) })}</span>
						<span className={s.adminOnlyTag}>{t('chatAdminDeletedBadge')}</span>
					</div>
				)}

				{isEdited && msg.editDate && (
					<div className={s.editedBadge}>
						<span>✏️ {fill(t('chatEditedAt'), { time: formatChatTime(msg.editDate) })}</span>
					</div>
				)}
			</div>
		</div>
	);
}
