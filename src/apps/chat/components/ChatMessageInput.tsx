'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/core/i18n';
import { Send, Pencil, X, Check, Plus, Reply, Paperclip, Loader2, Mic, Square } from 'lucide-react';
import type { ChatAttachmentItem, ChatMessageItem } from '../types';
import { ComposerActionsMenu } from './composer/ComposerActionsMenu';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import s from '../Chat.module.css';

function formatDuration(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins}:${String(secs).padStart(2, '0')}`;
}

interface ChatMessageInputProps {
	onSendMessage: (text: string, attachments?: ChatAttachmentItem[]) => Promise<boolean>;
	/** Room the composer belongs to; required for uploads. */
	roomId?: string | null;
	disabled?: boolean;
	editingMessage?: ChatMessageItem | null;
	onSaveEdit?: (mesajId: string, text: string) => Promise<boolean>;
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
	const [attachments, setAttachments] = useState<ChatAttachmentItem[]>([]);
	const [isUploading, setIsUploading] = useState(false);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const voice = useVoiceRecorder();
	const inputRef = useRef<HTMLInputElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const previousRoomRef = useRef(roomId);

	// Sync text when editingMessage changes
	useEffect(() => {
		if (editingMessage) {
			setText(editingMessage.icerik);
			inputRef.current?.focus();
		} else {
			setText('');
		}
	}, [editingMessage]);

	// Focus input when replyingMessage is set
	useEffect(() => {
		if (replyingMessage) {
			inputRef.current?.focus();
		}
	}, [replyingMessage]);

	// A staged upload belongs to the room it was uploaded to; switching rooms
	// must not carry it into another conversation.
	useEffect(() => {
		if (previousRoomRef.current !== roomId) {
			previousRoomRef.current = roomId;
			setAttachments([]);
			setUploadError(null);
			if (voice.isRecording) void voice.cancel();
		}
		// Only a room change should cancel an in-flight take.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [roomId]);

	const uploadOne = async (file: File): Promise<ChatAttachmentItem | null> => {
		if (!roomId) return null;
		const formData = new FormData();
		formData.set('odaId', roomId);
		formData.set('file', file);
		const res = await fetch('/api/chat/upload', { method: 'POST', body: formData });
		const data = await res.json();
		if (!res.ok || !data.ok) {
			setUploadError(data.error || t('chatUploadFailed'));
			return null;
		}
		return data.attachment as ChatAttachmentItem;
	};

	const uploadFiles = async (files: FileList | null) => {
		if (!files || !roomId || editingMessage) return;
		setUploadError(null);
		setIsUploading(true);
		try {
			for (const file of Array.from(files).slice(0, 6)) {
				const attachment = await uploadOne(file);
				if (attachment) setAttachments((previous) => [...previous, attachment]);
			}
		} catch {
			setUploadError(t('chatUploadFailed'));
		} finally {
			setIsUploading(false);
			if (fileInputRef.current) fileInputRef.current.value = '';
		}
	};

	const finishVoice = async () => {
		const file = await voice.stop();
		if (!file) {
			setUploadError(t('chatVoiceFailed', 'The voice recording could not be created.'));
			return;
		}
		setUploadError(null);
		setIsUploading(true);
		try {
			const attachment = await uploadOne(file);
			if (attachment) {
				const ok = await onSendMessage('', [attachment]);
				if (!ok) setAttachments((previous) => [...previous, attachment]);
			}
		} catch {
			setUploadError(t('chatUploadFailed'));
		} finally {
			setIsUploading(false);
		}
	};

	const voiceError =
		voice.error === 'unsupported'
			? t('chatVoiceUnsupported', 'Voice recording is not supported by this browser.')
			: voice.error === 'permission'
				? t('chatVoicePermission', 'Microphone permission is required.')
				: voice.error === 'failed'
					? t('chatVoiceFailed', 'The voice recording could not be saved.')
					: null;

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
					setAttachments([]);
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

			{attachments.length > 0 && (
				<div className={s.pendingAttachments}>
					{attachments.map((attachment, index) => (
						<span key={`${attachment.url}-${index}`} className={s.pendingAttachment}>
							<Paperclip size={11} />
							<span>{attachment.ad}</span>
							<button
								type="button"
								onClick={() =>
									setAttachments((previous) =>
										previous.filter((_, itemIndex) => itemIndex !== index)
									)
								}
								title={t('delete')}
							>
								<X size={11} />
							</button>
						</span>
					))}
				</div>
			)}

			{uploadError && (
				<div role="alert" style={{ padding: '5px 12px 0', fontSize: 11, color: '#ff453a' }}>
					{uploadError}
				</div>
			)}

			{editingMessage && (
				<div className={s.editingBanner}>
					<div className={s.editingBannerInfo}>
						<Pencil size={13} className={s.editingBannerIcon} />
						<span>
							<strong>{t('chatEditingBanner')}:</strong>{' '}
							{editingMessage.icerik.slice(0, 48)}
							{editingMessage.icerik.length > 48 ? '…' : ''}
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
							<span style={{ fontWeight: 600 }}>{replyingMessage.gonderenAd}</span>{' '}
							&mdash; {replyingMessage.icerik.slice(0, 48)}
							{replyingMessage.icerik.length > 48 ? '…' : ''}
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

			{voice.isRecording && (
				<div className={s.recordingBar}>
					<span className={s.recordingDot} />
					<span className={s.recordingText}>{t('chatRecording', 'Recording voice message')} · {formatDuration(voice.seconds)}</span>
					<button type="button" className={s.recordingCancel} onClick={() => void voice.cancel()} title={t('cancel')}><X size={13} /></button>
					<button type="button" className={s.recordingDone} onClick={() => void finishVoice()} disabled={isUploading} title={t('chatSend')}><Check size={13} /></button>
				</div>
			)}
			{voiceError && <div role="alert" className={s.voiceError}>{voiceError}</div>}

			<form onSubmit={handleSend} className={s.inputBar}>
				<div className={s.composerActionWrapper}>
					<button
						type="button"
						className={`${s.composerPlusBtn} ${isActionsMenuOpen ? s.composerPlusBtnActive : ''}`}
						onClick={() => setIsActionsMenuOpen((prev) => !prev)}
						title={t('chatActionsMenu') || 'Ek Eylemler'}
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
