'use client';

import React, { useState } from 'react';
import { Archive, Inbox, Mail, Reply, Trash2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import ui from '@/core/ui/ui.module.css';
import type { MailAction, MailConversation, MailStorage } from '@/lib/messages';

interface MailThreadViewProps {
	thread: MailConversation;
	folder: MailStorage;
	loading: boolean;
	onReply: (body: string) => Promise<boolean>;
	onAction: (action: MailAction) => void;
	formatDate: (value: number) => string;
}

const actionStyle: React.CSSProperties = {
	display: 'inline-flex',
	alignItems: 'center',
	gap: 5,
	fontSize: 11.5,
	fontWeight: 650,
	borderRadius: 7,
	padding: '5px 9px',
	cursor: 'pointer',
	border: '1px solid var(--window-border)',
	background: 'transparent',
	color: 'inherit',
};

/** The right column: the conversation, its messages, the folder actions and the reply box. */
export function MailThreadView({ thread, folder, loading, onReply, onAction, formatDate }: MailThreadViewProps) {
	const { t } = useI18n();
	const [reply, setReply] = useState('');
	const [sending, setSending] = useState(false);

	const sendReply = async () => {
		if (!reply.trim() || sending) return;
		setSending(true);
		const ok = await onReply(reply.trim());
		if (ok) setReply('');
		setSending(false);
	};

	return (
		<div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, paddingLeft: 12 }}>
			<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingBottom: 8 }}>
				<h2 data-mail-subject-line style={{ margin: 0, fontSize: 15, lineHeight: 1.3, flex: 1, minWidth: 140 }}>
					{thread.topic}
				</h2>
				{folder !== 'trash' && (
					<button type="button" data-mail-action="archive" style={actionStyle} onClick={() => onAction('archive')}>
						<Archive size={12} /> {t('mailArchive')}
					</button>
				)}
				{folder === 'archived' && (
					<button type="button" data-mail-action="restore" style={actionStyle} onClick={() => onAction('restore')}>
						<Inbox size={12} /> {t('mailMoveToInbox')}
					</button>
				)}
				{folder !== 'trash' && (
					<button type="button" data-mail-action="trash" style={actionStyle} onClick={() => onAction('trash')}>
						<Trash2 size={12} /> {t('mailTrash')}
					</button>
				)}
				{folder === 'trash' && (
					<button type="button" data-mail-action="delete" style={actionStyle} onClick={() => onAction('delete')}>
						<Trash2 size={12} /> {t('mailDeleteBtn')}
					</button>
				)}
			</div>

			<div style={{ overflowY: 'auto', minHeight: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
				{loading ? (
					<div className={ui.muted} style={{ fontSize: 12 }}>
						{t('mailLoading')}
					</div>
				) : (
					thread.messages.map((message) => (
						<div
							key={message.id}
							data-mail-message
							style={{
								border: '1px solid var(--window-border)',
								borderRadius: 9,
								padding: '9px 11px',
								background: message.isMine ? 'color-mix(in srgb, var(--accent) 7%, transparent)' : 'rgba(255,255,255,0.025)',
							}}
						>
							<div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, opacity: 0.7, marginBottom: 5 }}>
								<Mail size={11} />
								<strong style={{ fontSize: 11.5, opacity: 0.95 }}>
									{message.sender.name} {message.sender.surname}
									{message.isMine ? ` (${t('mailYou')})` : ''}
								</strong>
								<span style={{ marginLeft: 'auto' }}>{formatDate(message.creation)}</span>
							</div>
							<div style={{ fontSize: 12.5, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{message.body}</div>
						</div>
					))
				)}
			</div>

			<div style={{ paddingTop: 9, borderTop: '1px solid var(--window-border)', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
				<textarea
					data-mail-reply
					className={ui.input}
					style={{ minHeight: 54, resize: 'vertical' }}
					placeholder={t('mailReplyPlaceholder')}
					maxLength={10_000}
					value={reply}
					onChange={(e) => setReply(e.target.value)}
				/>
				<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
					<button type="button" data-mail-reply-send className={ui.primaryBtn} disabled={sending || !reply.trim()} onClick={() => void sendReply()}>
						<Reply size={13} /> {t('mailReply')}
					</button>
				</div>
			</div>
		</div>
	);
}
