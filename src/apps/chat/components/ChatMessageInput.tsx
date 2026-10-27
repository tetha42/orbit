'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/core/i18n';
import { Send, Pencil, X, Check, Plus, Reply } from 'lucide-react';
import type { ChatMesajItem } from '../types';
import { ComposerActionsMenu } from './composer/ComposerActionsMenu';
import s from '../Chat.module.css';

interface ChatMessageInputProps {
	onSendMessage: (text: string) => Promise<boolean>;
	disabled?: boolean;
	editingMessage?: ChatMesajItem | null;
	onSaveEdit?: (mesajId: string, text: string) => Promise<boolean>;
	onCancelEdit?: () => void;
	replyingMessage?: ChatMesajItem | null;
	onCancelReply?: () => void;
	onOpenPollModal?: () => void;
	isAdmin?: boolean;
}

export function ChatMessageInput({
	onSendMessage,
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
	const inputRef = useRef<HTMLInputElement>(null);

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

	const handleSend = async (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		const trimmed = text.trim();
		if (!trimmed || disabled || isSubmitting) return;

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
				const ok = await onSendMessage(trimmed);
				if (!ok) {
					setText(trimmed);
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

			<form onSubmit={handleSend} className={s.inputBar}>
				<div className={s.composerActionWrapper}>
					<button
						type="button"
						className={`${s.composerPlusBtn} ${isActionsMenuOpen ? s.composerPlusBtnActive : ''}`}
						onClick={() => setIsActionsMenuOpen((prev) => !prev)}
						title={t('chatActionsMenu') || 'Ek Eylemler'}
						disabled={disabled}
						aria-expanded={isActionsMenuOpen}
					>
						<Plus size={16} />
					</button>
					<ComposerActionsMenu
						isOpen={isActionsMenuOpen}
						onClose={() => setIsActionsMenuOpen(false)}
						isAdmin={Boolean(isAdmin)}
						onSelectAction={(actionId) => {
							if (actionId === 'poll' && onOpenPollModal) {
								onOpenPollModal();
							}
						}}
					/>
				</div>

				<input
					ref={inputRef}
					type="text"
					className={s.chatInput}
					placeholder={t('chatTypePlaceholder')}
					value={text}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={handleKeyDown}
					disabled={disabled}
				/>

				<button
					type="submit"
					className={s.sendBtn}
					disabled={disabled || isSubmitting || !text.trim()}
					title={editingMessage ? t('chatSaveEdit') : t('chatSend')}
				>
					{editingMessage ? <Check size={16} /> : <Send size={16} />}
				</button>
			</form>
		</div>
	);
}
