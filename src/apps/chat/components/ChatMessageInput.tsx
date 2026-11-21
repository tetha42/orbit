'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/core/i18n';
import { Send, Check, Plus, Loader2, Mic, Square } from 'lucide-react';
import type { ChatAttachmentItem, ChatMessageItem } from '../types';
import { ComposerActionsMenu } from './composer/ComposerActionsMenu';
import { ChatMessageInputBanners } from './composer/ChatMessageInputBanners';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { useChatAttachmentsUpload } from '../hooks/useChatAttachmentsUpload';
import s from '../Chat.module.css';

interface ChatMessageInputProps {
	onSendMessage: (text: string, attachments?: ChatAttachmentItem[]) => Promise<boolean>;
	/** Room the composer belongs to; required for uploads. */
	roomId?: string | null;
	disabled?: boolean;
	editingMessage?: ChatMessageItem | null;
	onSaveEdit?: (messageId: string, text: string) => Promise<boolean>;
	onCancelEdit?: () => void;
	replyingMessage?: ChatMessageItem | null;
	onCancelReply?: () => void;
	onOpenPollModal?: () => void;
	isAdmin?: boolean;
}

export function ChatMessageInput({
	onSendMessage,
	roomId,
	disabled,
	editingMessage,
	onSaveEdit,
	onCancelEdit,
	replyingMessage,
	onCancelReply,
	onOpenPollModal,
	isAdmin,
}: ChatMessageInputProps) {
	const { t } = useI18n();
	const [text, setText] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
	const voice = useVoiceRecorder();
	const inputRef = useRef<HTMLInputElement>(null);

	const {
		attachments,
		isUploading,
		uploadError,
		fileInputRef,
		uploadFiles,
		finishVoice,
		removeAttachment,
		clearAttachments,
		voiceError,
	} = useChatAttachmentsUpload({
		roomId,
		isEditing: Boolean(editingMessage),
		voice,
		onSendMessage,
	});

	useEffect(() => {
		if (editingMessage) {
			setText(editingMessage.content);
			inputRef.current?.focus();
		} else {
			setText('');
		}
	}, [editingMessage]);

	useEffect(() => {
		if (replyingMessage) {
			inputRef.current?.focus();
		}
	}, [replyingMessage]);

	const handleSend = async (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		const trimmed = text.trim();
		const pending = editingMessage ? [] : attachments;
		if ((!trimmed && pending.length === 0) || disabled || isSubmitting || isUploading) return;
		inputRef.current?.focus();
		setIsSubmitting(true);
		try {
			if (editingMessage && onSaveEdit) {
				const ok = await onSaveEdit(editingMessage.id, trimmed);
				if (ok && onCancelEdit) {
					onCancelEdit();
				}
			} else {
				setText('');
				const ok = await onSendMessage(trimmed, pending);
				if (!ok) {
					setText(trimmed);
				} else {
					clearAttachments();
				}
			}
		} finally {
			setIsSubmitting(false);
			requestAnimationFrame(() => {
				inputRef.current?.focus();
			});
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Escape' && editingMessage && onCancelEdit) {
			e.preventDefault();
			onCancelEdit();
			return;
		}
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			void handleSend();
		}
	};

	return (
		<div className={s.inputContainer}>
			<input
				ref={fileInputRef}
				type="file"
				multiple
				hidden
				accept="image/*,video/*,audio/*,.pdf,.md,.markdown,.txt,.csv,.json,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.epub"
				onChange={(event) => void uploadFiles(event.target.files)}
			/>

			<ChatMessageInputBanners
				attachments={attachments}
				onRemoveAttachment={removeAttachment}
				uploadError={uploadError}
				editingMessage={editingMessage}
				onCancelEdit={onCancelEdit}
				replyingMessage={replyingMessage}
				onCancelReply={onCancelReply}
				isRecording={voice.isRecording}
				recordingSeconds={voice.seconds}
				isUploading={isUploading}
				onCancelVoice={() => void voice.cancel()}
				onFinishVoice={() => void finishVoice()}
				voiceError={voiceError}
			/>

			<form onSubmit={handleSend} className={s.inputBar}>
				<div className={s.composerActionWrapper}>
					<button
						type="button"
						className={`${s.composerPlusBtn} ${isActionsMenuOpen ? s.composerPlusBtnActive : ''}`}
						onClick={() => setIsActionsMenuOpen((prev) => !prev)}
						title={t('chatActionsMenu')}
						disabled={disabled || isUploading || Boolean(editingMessage)}
						aria-expanded={isActionsMenuOpen}
					>
						{isUploading ? <Loader2 size={16} /> : <Plus size={16} />}
					</button>
					<ComposerActionsMenu
						isOpen={isActionsMenuOpen}
						onClose={() => setIsActionsMenuOpen(false)}
						isAdmin={Boolean(isAdmin)}
						onSelectAction={(actionId) => {
							if (actionId === 'poll' && onOpenPollModal) {
								onOpenPollModal();
							} else if (actionId === 'attach') {
								fileInputRef.current?.click();
							}
						}}
					/>
				</div>

				<input
					ref={inputRef}
					type="text"
					className={s.chatInput}
					placeholder={voice.isRecording ? t('chatRecording', 'Recording voice message') : t('chatTypePlaceholder')}
					value={text}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={handleKeyDown}
					disabled={disabled || voice.isRecording}
				/>

				{!text.trim() && attachments.length === 0 && !editingMessage ? (
					<button
						type="button"
						className={`${s.micBtn} ${voice.isRecording ? s.micBtnRecording : ''}`}
						onClick={() => (voice.isRecording ? void finishVoice() : void voice.start())}
						disabled={disabled || isSubmitting || isUploading}
						title={voice.isRecording ? t('chatStopRecording', 'Stop and send') : t('chatRecordVoice', 'Record voice message')}
						aria-label={voice.isRecording ? t('chatStopRecording', 'Stop and send') : t('chatRecordVoice', 'Record voice message')}
					>
						{voice.isRecording ? <Square size={14} /> : <Mic size={16} />}
					</button>
				) : (
					<button
						type="submit"
						className={s.sendBtn}
						disabled={disabled || isSubmitting || isUploading || (!text.trim() && attachments.length === 0)}
						title={editingMessage ? t('chatSaveEdit') : t('chatSend')}
					>
						{editingMessage ? <Check size={16} /> : <Send size={16} />}
					</button>
				)}
			</form>
		</div>
	);
}
