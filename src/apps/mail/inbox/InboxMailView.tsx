'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { MailOpen } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useAppCommand } from '@/core/commands';
import { useDialog } from '@/components/Common/DialogProvider';
import { useToast } from '@/core/ui/Toast';
import { useFocusTarget } from '@/lib/client/useFocusTarget';
import type { AppID } from '@/types/workspace';
import type { MailAction } from '@/lib/messages';
import { useInboxMail } from './useInboxMail';
import { MailFolderNav } from './MailFolderNav';
import { MailThreadList } from './MailThreadList';
import { MailThreadView } from './MailThreadView';
import { MailComposeDialog } from './MailComposeDialog';

/** The portal's internal mail: folders, conversations, replies and the per-member e-mail notice. */
export function InboxMailView() {
	const { t, language } = useI18n();
	const notify = useToast();
	const dialog = useDialog();
	const mail = useInboxMail();
	const [composeOpen, setComposeOpen] = useState(false);
	const [composeRecipientId, setComposeRecipientId] = useState<string | null>(null);
	const [emailNotify, setEmailNotify] = useState(false);
	const [emailNotifyBusy, setEmailNotifyBusy] = useState(true);
	const [pendingThread, setPendingThread] = useState<string | null>(null);

	const formatTime = (value: number) =>
		new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
	const formatDate = (value: number) =>
		new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

	useEffect(() => {
		fetch('/api/messages/settings', { cache: 'no-store' })
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => setEmailNotify(Boolean(data?.emailWithNews ?? data?.notifyByEmail)))
			.catch(() => {})
			.finally(() => setEmailNotifyBusy(false));
	}, []);

	useAppCommand('mail' as AppID, (cmd) => {
		if (cmd === 'mail-compose') {
			setComposeRecipientId(null);
			setComposeOpen(true);
		}
		if (cmd === 'mail-refresh') void mail.reload();
	});

	useFocusTarget('mail', {
		ready: !mail.loading,
		apply: (target) => {
			if (target.section === 'compose') {
				setComposeRecipientId(target.itemId ?? null);
				setComposeOpen(true);
			} else if (target.itemId) {
				void mail.openThread(target.itemId);
			}
		},
		refetch: mail.reload,
	});

	// The composer closes onto the Sent folder with the new conversation already open.
	useEffect(() => {
		if (!pendingThread || mail.folder !== 'sent' || mail.loading) return;
		void mail.openThread(pendingThread);
		setPendingThread(null);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pendingThread, mail.folder, mail.loading]);

	const toggleEmailNotify = async (next: boolean) => {
		setEmailNotifyBusy(true);
		const previous = emailNotify;
		setEmailNotify(next);
		try {
			const res = await fetch('/api/messages/settings', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ emailWithNews: next }),
			});
			if (!res.ok) throw new Error();
		} catch {
			setEmailNotify(previous);
			notify(t('mailErrSendGeneral'), 'error');
		} finally {
			setEmailNotifyBusy(false);
		}
	};

	const handleAction = async (action: MailAction) => {
		const thread = mail.thread;
		if (!thread) return;
		if (action === 'delete') {
			const ok = await dialog.confirm({ message: t('mailDeleteConfirm'), tone: 'danger', confirmLabel: t('mailDeleteBtn') });
			if (!ok) return;
		}
		try {
			const res = await fetch(`/api/messages/${encodeURIComponent(thread.id)}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action }),
			});
			const data = await res.json().catch(() => null);
			if (!res.ok) throw new Error(data?.error || t('mailErrFetch'));
			const toastKey =
				action === 'archive' ? 'mailArchived' : action === 'trash' ? 'mailTrashed' : action === 'delete' ? 'mailDeleted' : 'mailRestored';
			notify(t(toastKey));
			mail.closeThread();
			await mail.reload();
		} catch (e) {
			notify(e instanceof Error ? e.message : t('mailErrFetch'), 'error');
		}
	};

	const reply = useCallback(
		async (body: string) => {
			const thread = mail.thread;
			if (!thread) return false;
			try {
				const res = await fetch(`/api/messages/${encodeURIComponent(thread.id)}`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ body }),
				});
				const data = await res.json().catch(() => null);
				if (!res.ok) {
					notify(data?.error || t('mailErrSend'), 'error');
					return false;
				}
				notify(t('mailReplySent'));
				await mail.openThread(thread.id);
				await mail.reload();
				return true;
			} catch {
				notify(t('mailErrSendGeneral'), 'error');
				return false;
			}
		},
		[mail, notify, t]
	);

	return (
		<div data-mail-app style={{ display: 'flex', height: '100%', minHeight: 0, padding: '14px 16px', gap: 4, color: 'var(--text-primary)' }}>
			<MailFolderNav
				active={mail.folder}
				unread={mail.unread}
				emailNotify={emailNotify}
				emailNotifyBusy={emailNotifyBusy}
				onSelect={(key) => mail.setFolder(key)}
				onToggleEmailNotify={(next) => void toggleEmailNotify(next)}
			/>

			<MailThreadList
				topics={mail.topics}
				loading={mail.loading}
				selectedId={mail.thread?.id ?? null}
				onSelect={(id) => void mail.openThread(id)}
				onCompose={() => {
					setComposeRecipientId(null);
					setComposeOpen(true);
				}}
				formatTime={formatTime}
			/>

			{mail.error && (
				<div role="alert" style={{ fontSize: 12, padding: 10, color: 'var(--danger)' }}>
					{mail.error}
				</div>
			)}

			{mail.thread ? (
				<MailThreadView
					thread={mail.thread}
					folder={mail.folder}
					loading={mail.threadLoading}
					onReply={reply}
					onAction={(action) => void handleAction(action)}
					formatDate={formatDate}
				/>
			) : (
				<div
					style={{
						flex: 1,
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						gap: 8,
						opacity: 0.5,
						fontSize: 12.5,
						textAlign: 'center',
						padding: 20,
					}}
				>
					<MailOpen size={26} />
					<strong style={{ fontSize: 13 }}>{t('mailNoThreadSelected')}</strong>
					<span>{t('mailSelectConversation')}</span>
				</div>
			)}

			{composeOpen && (
				<MailComposeDialog
					initialRecipientId={composeRecipientId}
					onClose={() => {
						setComposeOpen(false);
						setComposeRecipientId(null);
					}}
					onSent={(threadId) => {
						setComposeOpen(false);
						setComposeRecipientId(null);
						setPendingThread(threadId || null);
						mail.setFolder('sent');
					}}
				/>
			)}
		</div>
	);
}
