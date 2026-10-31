'use client';

import React, { useState } from 'react';
import { X, Send, AlertCircle } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import styles from '../Mail.module.css';

interface MailComposeModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSendSuccess: () => void;
	initial?: {
		to?: string;
		subject?: string;
		body?: string;
	};
}

export const MailComposeModal: React.FC<MailComposeModalProps> = ({
	isOpen,
	onClose,
	onSendSuccess,
	initial,
}) => {
	const { t } = useI18n();
	const [to, setTo] = useState(initial?.to || '');
	const [subject, setSubject] = useState(initial?.subject || '');
	const [body, setBody] = useState(initial?.body || '');
	const [isSending, setIsSending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [groups, setGroups] = useState<
		{ id: string; label: string; kind: string; count: number; emails: string[] }[]
	>([]);

	React.useEffect(() => {
		if (!isOpen) return;
		let cancelled = false;
		fetch('/api/mail/groups', { cache: 'no-store' })
			.then((res) => (res.ok ? res.json() : null))
			.then((payload) => {
				if (!cancelled && Array.isArray(payload?.groups)) setGroups(payload.groups);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [isOpen]);

	const addGroup = (id: string) => {
		const group = groups.find((item) => item.id === id);
		if (!group) return;
		const current = to
			.split(',')
			.map((value) => value.trim())
			.filter(Boolean);
		setTo([...new Set([...current, ...group.emails])].join(', '));
	};

	React.useEffect(() => {
		if (isOpen) {
			setTo(initial?.to || '');
			setSubject(initial?.subject || '');
			setBody(initial?.body || '');
			setError(null);
		}
	}, [isOpen, initial]);

	if (!isOpen) return null;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!to.trim()) {
			setError(t('mailErrTo'));
			return;
		}
		if (!subject.trim()) {
			setError(t('mailErrSubject'));
			return;
		}
		if (!body.trim()) {
			setError(t('mailErrBody'));
			return;
		}

		setIsSending(true);
		setError(null);

		try {
			// Convert plain text breaks into HTML paragraphs/breaks
			const formattedHtml = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #222;">
				${body.replace(/\n/g, '<br/>')}
			</div>`;

			const res = await fetch('/api/mail', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					to: to.trim(),
					subject: subject.trim(),
					text: body,
					html: formattedHtml,
				}),
			});

			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error || t('mailErrSend'));
			}

			onSendSuccess();
			onClose();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : t('mailErrSendGeneral');
			setError(msg);
		} finally {
			setIsSending(false);
		}
	};

	return (
		<div className={styles.modalOverlay} onClick={onClose}>
			<div className={styles.composeModal} onClick={(e) => e.stopPropagation()}>
				<div className={styles.composeHeader}>
					<span className={styles.composeHeaderTitle}>
						{initial?.subject ? `${t('mailReplyPrompt')}: ${initial.subject}` : t('mailNewMessage')}
					</span>
					<button type="button" className={styles.composeCloseBtn} onClick={onClose} title={t('close')}>
						<X size={16} />
					</button>
				</div>

				<form className={styles.composeForm} onSubmit={handleSubmit}>
					{error && (
						<div
							style={{
								padding: '8px 16px',
								background: 'rgba(255, 69, 58, 0.1)',
								color: '#ff453a',
								fontSize: 12,
								display: 'flex',
								alignItems: 'center',
								gap: 6,
							}}
						>
							<AlertCircle size={14} />
							<span>{error}</span>
						</div>
					)}

					<div className={styles.composeFieldRow}>
						<label className={styles.composeFieldLabel}>{t('mailToLabel')}</label>
						<input
							type="text"
							className={styles.composeFieldInput}
							placeholder="alici@example.com"
							value={to}
							onChange={(e) => setTo(e.target.value)}
							required
							autoFocus
						/>
					</div>

					<div className={styles.composeFieldRow}>
						<label className={styles.composeFieldLabel}>{t('mailRecipientGroup')}</label>
						<select
							className={styles.composeFieldInput}
							value=""
							onChange={(e) => addGroup(e.target.value)}
						>
							<option value="">{t('mailGroupPlaceholder')}</option>
							{groups.map((group) => (
								<option key={group.id} value={group.id}>
									{group.label} ({group.count})
								</option>
							))}
						</select>
					</div>

					<div className={styles.composeFieldRow}>
						<label className={styles.composeFieldLabel}>{t('mailSubjectLabel')}</label>
						<input
							type="text"
							className={styles.composeFieldInput}
							placeholder={t('mailSubjectPh')}
							value={subject}
							onChange={(e) => setSubject(e.target.value)}
							required
						/>
					</div>

					<textarea
						className={styles.composeTextArea}
						placeholder={t('mailBodyPh')}
						value={body}
						onChange={(e) => setBody(e.target.value)}
						required
					/>

					<div className={styles.composeFooter}>
						<button
							type="button"
							className={styles.actionBtn}
							onClick={onClose}
							disabled={isSending}
						>
							{t('cancel')}
						</button>
						<button
							type="submit"
							className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
							disabled={isSending}
						>
							<Send size={13} />
							<span>{isSending ? t('sending') : t('send')}</span>
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};
