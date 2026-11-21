'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { Pencil, X, Check, Reply, Paperclip } from 'lucide-react';
import type { ChatAttachmentItem, ChatMessageItem } from '../../types';
import { formatVoiceDuration } from '../../hooks/useChatAttachmentsUpload';
import s from '../../Chat.module.css';

interface ChatMessageInputBannersProps {
	attachments: ChatAttachmentItem[];
	onRemoveAttachment: (index: number) => void;
	uploadError: string | null;
	editingMessage?: ChatMessageItem | null;
	onCancelEdit?: () => void;
	replyingMessage?: ChatMessageItem | null;
	onCancelReply?: () => void;
	isRecording: boolean;
	recordingSeconds: number;
	isUploading: boolean;
	onCancelVoice: () => void;
	onFinishVoice: () => void;
	voiceError: string | null;
}

export function ChatMessageInputBanners({
	attachments,
	onRemoveAttachment,
	uploadError,
	editingMessage,
	onCancelEdit,
	replyingMessage,
	onCancelReply,
	isRecording,
	recordingSeconds,
	isUploading,
	onCancelVoice,
	onFinishVoice,
	voiceError,
}: ChatMessageInputBannersProps) {
	const { t } = useI18n();

	return (
		<>
			{attachments.length > 0 && (
				<div className={s.pendingAttachments}>
					{attachments.map((attachment, index) => (
						<span key={`${attachment.url}-${index}`} className={s.pendingAttachment}>
							<Paperclip size={11} />
							<span>{attachment.name}</span>
							<button
								type="button"
								onClick={() => onRemoveAttachment(index)}
								title={t('delete')}
							>
								<X size={11} />
							</button>
						</span>
					))}
				</div>
			)}

			{uploadError && (
				<div role="alert" style={{ padding: '5px 12px 0', fontSize: 11, color: 'var(--danger)' }}>
					{uploadError}
				</div>
			)}

			{editingMessage && (
				<div className={s.editingBanner}>
					<div className={s.editingBannerInfo}>
						<Pencil size={13} className={s.editingBannerIcon} />
						<span>
							<strong>{t('chatEditingBanner')}:</strong>{' '}
							{editingMessage.content.slice(0, 48)}
							{editingMessage.content.length > 48 ? '…' : ''}
						</span>
					</div>
					<button
						type="button"
						className={s.cancelEditBtn}
						onClick={onCancelEdit}
						title={t('chatCancelEdit')}
					>
						<X size={14} />
						<span>{t('chatCancelEdit')}</span>
					</button>
				</div>
			)}

			{replyingMessage && !editingMessage && (
				<div className={s.replyBanner}>
					<div className={s.replyBannerInfo}>
						<Reply size={13} className={s.replyBannerIcon} />
						<span>
							<strong>{t('chatReplyingBanner')}:</strong>{' '}
							<span style={{ fontWeight: 600 }}>{replyingMessage.senderName}</span>{' '}
							&mdash; {replyingMessage.content.slice(0, 48)}
							{replyingMessage.content.length > 48 ? '…' : ''}
						</span>
					</div>
					<button
						type="button"
						className={s.cancelReplyBtn}
						onClick={onCancelReply}
						title={t('chatCancelReply')}
					>
						<X size={14} />
						<span>{t('cancel')}</span>
					</button>
				</div>
			)}

			{isRecording && (
				<div className={s.recordingBar}>
					<span className={s.recordingDot} />
					<span className={s.recordingText}>
						{t('chatRecording', 'Recording voice message')} · {formatVoiceDuration(recordingSeconds)}
					</span>
					<button type="button" className={s.recordingCancel} onClick={onCancelVoice} title={t('cancel')}>
						<X size={13} />
					</button>
					<button
						type="button"
						className={s.recordingDone}
						onClick={onFinishVoice}
						disabled={isUploading}
						title={t('chatSend')}
					>
						<Check size={13} />
					</button>
				</div>
			)}

			{voiceError && <div role="alert" className={s.voiceError}>{voiceError}</div>}
		</>
	);
}
