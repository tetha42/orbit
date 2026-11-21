'use client';

import React, { useEffect, useRef, useState } from 'react';
import { PenLine, Search, X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { Sheet } from '@/core/ui/Sheet';
import { useToast } from '@/core/ui/Toast';
import ui from '@/core/ui/ui.module.css';
import { fill } from '@/lib/text';
import { useRecipientPicker } from './useRecipientPicker';

interface MailComposeDialogProps {
	initialRecipientId?: string | null;
	onClose: () => void;
	onSent: (threadId: string) => void;
}

/** The New Message sheet: recipient autocomplete, subject and body, sent through /api/messages. */
export function MailComposeDialog({ initialRecipientId, onClose, onSent }: MailComposeDialogProps) {
	const { t } = useI18n();
	const notify = useToast();
	const [subject, setSubject] = useState('');
	const [body, setBody] = useState('');
	const [sending, setSending] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const subjectRef = useRef<HTMLInputElement>(null);

	const picker = useRecipientPicker({
		initialRecipientId,
		onPrefillFocus: () => {
			setTimeout(() => subjectRef.current?.focus(), 0);
		},
	});

	useEffect(() => {
		if (!initialRecipientId) inputRef.current?.focus();
	}, [initialRecipientId]);

	const send = async (e: React.FormEvent) => {
		e.preventDefault();
		if (sending || picker.recipients.length === 0 || !subject.trim() || !body.trim()) return;
		setSending(true);
		try {
			const res = await fetch('/api/messages', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					subject: subject.trim(),
					body: body.trim(),
					recipients: picker.recipients.map((r) => r.id),
				}),
			});
			const data = await res.json().catch(() => null);
			if (!res.ok) {
				const skipped = Array.isArray(data?.skipped) ? data.skipped : [];
				const localizedSkipped = skipped
					.map((entry: { name: string; reason: string }) =>
						fill(t(entry.reason === 'role' ? 'mailSkippedRole' : 'mailSkippedInactive'), { name: entry.name })
					)
					.join(' ');
				notify(
					data?.code === 'MAIL_RATE_LIMITED'
						? t('mailErrRateLimited')
						: localizedSkipped || data?.error || t('mailErrSend'),
					'error'
				);
				return;
			}
			notify(t('mailSent'));
			onSent(String(data?.threadId ?? ''));
		} catch {
			notify(t('mailErrSendGeneral'), 'error');
		} finally {
			setSending(false);
		}
	};

	return (
		<Sheet
			title={t('mailComposeTitle')}
			label={t('mailComposeTitle')}
			icon={<PenLine size={18} />}
			onClose={onClose}
			onSubmit={send}
			maxWidth={560}
		>
			<div className={ui.field}>
				<label htmlFor="mail-recipient-input" className={ui.fieldLabel}>
					{t('mailTo')}
				</label>
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 5 }}>
					{picker.recipients.map((person) => (
						<span
							key={person.id}
							data-mail-chip={person.id}
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: 4,
								fontSize: 11.5,
								padding: '2px 6px',
								borderRadius: 6,
								background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
							}}
						>
							{person.name} {person.surname}
							<button
								type="button"
								aria-label={t('mailRemoveRecipient')}
								onClick={() => picker.removeRecipient(person.id)}
								style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
							>
								<X size={11} />
							</button>
						</span>
					))}
				</div>
				<div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
					<Search size={13} style={{ position: 'absolute', left: 9, opacity: 0.5, pointerEvents: 'none' }} />
					<input
						id="mail-recipient-input"
						ref={inputRef}
						type="text"
						data-mail-recipient-input
						className={ui.input}
						style={{ paddingLeft: 27 }}
						placeholder={t('mailToPlaceholder')}
						value={picker.query}
						onChange={(e) => picker.setQuery(e.target.value)}
						onKeyDown={picker.onInputKeyDown}
					/>
				</div>
				{(picker.visibleOptions.length > 0 || picker.showEmpty) && (
					<div
						data-mail-suggestions
						style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 5, maxHeight: 168, overflowY: 'auto' }}
					>
						{picker.isSuggestion && (
							<div data-mail-recent className={ui.muted} style={{ fontSize: 11, fontWeight: 600, padding: '2px 4px' }}>
								{t('mailRecent')}
							</div>
						)}
						{picker.visibleOptions.map((person, index) => (
							<button
								key={person.id}
								type="button"
								data-mail-option={person.id}
								aria-selected={person.reachable && index === picker.activeIndex ? 'true' : undefined}
								aria-disabled={!person.reachable ? 'true' : undefined}
								disabled={!person.reachable}
								onClick={() => picker.addRecipient(person)}
								style={{
									textAlign: 'left',
									border: '1px solid var(--window-border)',
									borderRadius: 6,
									padding: '5px 8px',
									fontSize: 11.5,
									color: 'inherit',
									background:
										person.reachable && index === picker.activeIndex
											? 'color-mix(in srgb, var(--accent) 12%, transparent)'
											: 'transparent',
									cursor: person.reachable ? 'pointer' : 'not-allowed',
									opacity: person.reachable ? 1 : 0.55,
								}}
							>
								{person.name} {person.surname}
								{!person.reachable && <span style={{ marginLeft: 6, color: 'var(--danger)' }}>· {t('mailUnreachable')}</span>}
							</button>
						))}
						{picker.showEmpty && (
							<div data-mail-no-matches className={ui.muted} style={{ fontSize: 12, padding: '6px 8px' }}>
								{t('mailNoMatches')}
							</div>
						)}
					</div>
				)}
			</div>

			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('mailSubject')}</span>
				<input
					ref={subjectRef}
					type="text"
					data-mail-subject
					className={ui.input}
					maxLength={120}
					value={subject}
					onChange={(e) => setSubject(e.target.value)}
				/>
			</label>

			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('mailBody')}</span>
				<textarea
					data-mail-body
					className={ui.input}
					style={{ minHeight: 150, resize: 'vertical' }}
					maxLength={10_000}
					value={body}
					onChange={(e) => setBody(e.target.value)}
				/>
			</label>

			<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
				<button type="button" className={ui.btn} onClick={onClose}>
					{t('cancel')}
				</button>
				<button
					type="submit"
					data-mail-send
					className={ui.primaryBtn}
					disabled={sending || picker.recipients.length === 0 || !subject.trim() || !body.trim()}
				>
					{t('mailSend')}
				</button>
			</div>
		</Sheet>
	);
}
