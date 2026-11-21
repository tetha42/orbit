'use client';

import React from 'react';
import { X, Pencil, Check, Paperclip, Reply } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { ChatAttachmentItem, ChatMessageItem } from '../../types';
import { formatVoiceDuration } from '../../hooks/useChatAttachmentsUpload';
import s from '../../ChatMobile.module.css';
import chatStyles from '../../Chat.module.css';

interface ChatMobileComposerBannersProps {
	editingMessage: ChatMessageItem | null;
	replyingMessage: ChatMessageItem | null;
	onCancelEdit: () => void;
	onCancelReply: () => void;
	isRecording: boolean;
	recordingSeconds: number;
	isUploading: boolean;
	onCancelVoice: () => void;
	onFinishVoice: () => void;
	voiceError?: string | null;
	attachments: ChatAttachmentItem[];
	onRemoveAttachment: (index: number) => void;
	uploadError?: string | null;
}

export function ChatMobileComposerBanners({
	editingMessage,
	replyingMessage,
	onCancelEdit,
	onCancelReply,
	isRecording,
	recordingSeconds,
	isUploading,
	onCancelVoice,
	onFinishVoice,
	voiceError,
	attachments,
	onRemoveAttachment,
	uploadError,
}: ChatMobileComposerBannersProps) {
	const { t } = useI18n();

	return (
		<>
			{editingMessage && (
				<div className={s.mobileEditingBanner}>
					<div className={s.mobileEditingInfo}>
						<Pencil size={12} />
						<span>
							<strong>{t('chatEditingBanner')}:</strong> {editingMessage.content.slice(0, 32)}
							{editingMessage.content.length > 32 ? '…' : ''}
						</span>
					</div>
					<button
						type="button"
						className={s.mobileCancelEditBtn}
						onClick={onCancelEdit}
						title={t('chatCancelEdit')}
					>
						<X size={14} />
					</button>
				</div>
			)}

			{replyingMessage && !editingMessage && (
				<div className={s.mobileReplyBanner}>
					<div className={s.mobileReplyInfo}>
						<Reply size={12} />
						<span>
							<strong>{t('chatReplyingBanner')}:</strong>{' '}
							<span style={{ fontWeight: 600 }}>{replyingMessage.senderName}</span>{' '}
							&mdash; {replyingMessage.content.slice(0, 32)}
							{replyingMessage.content.length > 32 ? '…' : ''}
						</span>
					</div>
					<button
						type="button"
						className={s.mobileCancelEditBtn}
						onClick={onCancelReply}
						title={t('chatCancelReply')}
					>
						<X size={14} />
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
						<X size={14} />
					</button>
					<button type="button" className={s.recordingDone} onClick={onFinishVoice} disabled={isUploading} title={t('chatSend')}>
						<Check size={14} />
					</button>
				</div>
			)}
			{voiceError && <div role="alert" className={s.voiceError}>{voiceError}</div>}

			{attachments.length > 0 && (
				<div className={chatStyles.pendingAttachments}>
					{attachments.map((attachment, index) => (
						<span key={`${attachment.url}-${index}`} className={chatStyles.pendingAttachment}>
							<Paperclip size={11} />
							<span>{attachment.name}</span>
							<button type="button" onClick={() => onRemoveAttachment(index)}>
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
		</>
	);
}
