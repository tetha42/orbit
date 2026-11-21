'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
	Send,
	Check,
	Plus,
	Loader2,
	Mic,
	Square,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { ChatAttachmentItem, ChatMessageItem } from '../../types';
import { ComposerActionsMenu } from '../composer/ComposerActionsMenu';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { useChatAttachmentsUpload } from '../../hooks/useChatAttachmentsUpload';
import { ChatMobileComposerBanners } from './ChatMobileComposerBanners';
import s from '../../ChatMobile.module.css';
import chatStyles from '../../Chat.module.css';

interface ChatMobileComposerProps {
	activeRoomId: string | null;
	isAdmin: boolean;
	sending: boolean;
	editingMessage: ChatMessageItem | null;
	replyingMessage: ChatMessageItem | null;
	onCancelEdit: () => void;
	onCancelReply: () => void;
	onSendMessage: (text: string, attachments?: ChatAttachmentItem[]) => Promise<boolean>;
	onEditMessage: (messageId: string, text: string) => Promise<boolean>;
	onOpenPollModal: () => void;
	inputRef?: React.RefObject<HTMLInputElement | null>;
}

export function ChatMobileComposer({
	activeRoomId,
	isAdmin,
	sending,
	editingMessage,
	replyingMessage,
	onCancelEdit,
	onCancelReply,
	onSendMessage,
	onEditMessage,
	onOpenPollModal,
	inputRef,
}: ChatMobileComposerProps) {
	const { t } = useI18n();
	const [text, setText] = useState('');
	const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
	const voice = useVoiceRecorder();
	const internalInputRef = useRef<HTMLInputElement>(null);
	const composerInputRef = inputRef ?? internalInputRef;

	const {
		attachments,
		isUploading,
		uploadError,
		fileInputRef: attachmentInputRef,
		uploadFiles,
		finishVoice,
		removeAttachment,
		clearAttachments,
		voiceError,
	} = useChatAttachmentsUpload({
		roomId: activeRoomId,
		isEditing: Boolean(editingMessage),
		voice,
		onSendMessage,
	});

	useEffect(() => {
		setText('');
	}, [activeRoomId]);

	useEffect(() => {
		if (editingMessage) {
			setText(editingMessage.content);
			composerInputRef.current?.focus();
		} else {
			setText('');
		}
	}, [editingMessage, composerInputRef]);

	useEffect(() => {
		if (replyingMessage) {
			composerInputRef.current?.focus();
		}
	}, [replyingMessage, composerInputRef]);

	const handleSend = async (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = text.trim();
		const pending = editingMessage ? [] : attachments;
		if ((!trimmed && pending.length === 0) || sending || isUploading) return;
		composerInputRef.current?.focus();
		if (editingMessage) {
			const ok = await onEditMessage(editingMessage.id, trimmed);
			if (ok) {
				onCancelEdit();
			}
		} else {
			setText('');
			const ok = await onSendMessage(trimmed, pending);
			if (!ok) setText(trimmed);
			else clearAttachments();
		}
		requestAnimationFrame(() => {
			composerInputRef.current?.focus();
		});
	};

	return (
		<>
			<ChatMobileComposerBanners
				editingMessage={editingMessage}
				replyingMessage={replyingMessage}
				onCancelEdit={onCancelEdit}
				onCancelReply={onCancelReply}
				isRecording={voice.isRecording}
				recordingSeconds={voice.seconds}
				isUploading={isUploading}
				onCancelVoice={() => void voice.cancel()}
				onFinishVoice={() => void finishVoice()}
				voiceError={voiceError}
				attachments={attachments}
				onRemoveAttachment={removeAttachment}
				uploadError={uploadError}
			/>

			<input
				ref={attachmentInputRef}
				type="file"
				multiple
				hidden
				accept="image/*,video/*,audio/*,.pdf,.md,.markdown,.txt,.csv,.json,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.epub"
				onChange={(event) => void uploadFiles(event.target.files)}
			/>

			<form className={s.composer} onSubmit={handleSend}>
				<div className={chatStyles.composerActionWrapper}>
					<button
						type="button"
						className={`${chatStyles.composerPlusBtn} ${isActionsMenuOpen ? chatStyles.composerPlusBtnActive : ''}`}
						onClick={() => setIsActionsMenuOpen((prev) => !prev)}
						title={t('chatActionsMenu')}
						aria-expanded={isActionsMenuOpen}
						disabled={isUploading || Boolean(editingMessage)}
					>
						{isUploading ? <Loader2 size={18} /> : <Plus size={18} />}
					</button>
					<ComposerActionsMenu
						isOpen={isActionsMenuOpen}
						onClose={() => setIsActionsMenuOpen(false)}
						isAdmin={isAdmin}
						onSelectAction={(actionId) => {
							if (actionId === 'poll') onOpenPollModal();
							else if (actionId === 'attach') attachmentInputRef.current?.click();
						}}
					/>
				</div>

				<input
					ref={composerInputRef}
					type="text"
					className={s.composerInput}
					placeholder={voice.isRecording ? t('chatRecording', 'Recording voice message') : t('chatTypePlaceholder')}
					value={text}
					onChange={(e) => setText(e.target.value)}
					disabled={voice.isRecording}
				/>
				{!text.trim() && attachments.length === 0 && !editingMessage ? (
					<button
						type="button"
						className={`${s.micBtn} ${voice.isRecording ? s.micBtnRecording : ''}`}
						onClick={() => (voice.isRecording ? void finishVoice() : void voice.start())}
						disabled={sending || isUploading}
						title={voice.isRecording ? t('chatStopRecording', 'Stop and send') : t('chatRecordVoice', 'Record voice message')}
						aria-label={voice.isRecording ? t('chatStopRecording', 'Stop and send') : t('chatRecordVoice', 'Record voice message')}
					>
						{voice.isRecording ? <Square size={14} /> : <Mic size={18} />}
					</button>
				) : (
					<button
						type="submit"
						className={s.sendBtn}
						disabled={sending || isUploading || (!text.trim() && attachments.length === 0)}
						title={editingMessage ? t('chatSaveEdit') : t('chatSend')}
					>
						{editingMessage ? <Check size={18} /> : <Send size={18} />}
					</button>
				)}
			</form>
		</>
	);
}
