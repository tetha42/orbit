'use client';

import React, { useState, useEffect } from 'react';
import { Send as SendIcon, AlertCircle } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import s from '../../MailMobile.module.css';

interface MobileComposeSheetProps {
	composeInitial?: { to?: string; subject?: string; body?: string };
	onClose: () => void;
	onSendSuccess: () => void;
}

export function MobileComposeSheet({ composeInitial, onClose, onSendSuccess }: MobileComposeSheetProps) {
	const { t } = useI18n();
	const [composeTo, setComposeTo] = useState(composeInitial?.to || '');
	const [composeSubject, setComposeSubject] = useState(composeInitial?.subject || '');
	const [composeBody, setComposeBody] = useState(composeInitial?.body || '');
	const [isSending, setIsSending] = useState(false);
	const [composeError, setComposeError] = useState<string | null>(null);
	const [groups, setGroups] = useState<{ id: string; label: string; count: number; emails: string[] }[]>([]);

	useEffect(() => {
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
	}, []);

	const addGroup = (id: string) => {
		const group = groups.find((item) => item.id === id);
		if (!group) return;
		const current = composeTo.split(',').map((value) => value.trim()).filter(Boolean);
		setComposeTo([...new Set([...current, ...group.emails])].join(', '));
	};

	const handleSendSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!composeTo.trim()) {
			setComposeError(t('mailErrTo'));
			return;
		}
		if (!composeSubject.trim()) {
			setComposeError(t('mailErrSubject'));
			return;
		}
		if (!composeBody.trim()) {
			setComposeError(t('mailErrBody'));
			return;
		}
		setIsSending(true);
		setComposeError(null);
		try {
			const formattedHtml = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #222;">
				${composeBody.replace(/\n/g, '<br/>')}
			</div>`;
			const res = await fetch('/api/mail', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					to: composeTo.trim(),
					subject: composeSubject.trim(),
					text: composeBody,
					html: formattedHtml,
				}),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error || t('mailErrSend'));
			onSendSuccess();
			onClose();
		} catch (err: unknown) {
			setComposeError(err instanceof Error ? err.message : t('mailErrSendGeneral'));
		} finally {
			setIsSending(false);
		}
	};

	return (
		<div className={s.sheetOverlay} onClick={onClose}>
			<div className={s.sheetCard} onClick={(e) => e.stopPropagation()}>
				<div className={s.sheetHeader}>
					<button type="button" className={s.sheetCancelBtn} onClick={onClose} disabled={isSending}>
						{t('cancel')}
					</button>
					<span className={s.sheetTitle}>
						{composeInitial?.subject ? t('mailReply') : t('mailMobTabCompose')}
					</span>
					<button type="button" className={s.sheetSendBtn} onClick={handleSendSubmit} disabled={isSending}>
						<SendIcon size={12} />
						<span>{isSending ? t('sending') : t('send')}</span>
					</button>
				</div>
				{composeError && (
					<div
					style={{
						padding: '8px 16px',
						background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
						color: 'var(--danger)',
						fontSize: 12,
						display: 'flex',
						alignItems: 'center',
						gap: 6,
					}}
				>
						<AlertCircle size={14} />
						<span>{composeError}</span>
					</div>
				)}
				<form className={s.sheetForm} onSubmit={handleSendSubmit}>
					<div className={s.sheetFieldRow}>
						<span className={s.sheetFieldLabel}>{t('mailToLabel')}</span>
						<input
							type="text"
							className={s.sheetFieldInput}
							placeholder="recipient@example.com"
							value={composeTo}
							onChange={(e) => setComposeTo(e.target.value)}
							required
						/>
					</div>
					<div className={s.sheetFieldRow}>
						<span className={s.sheetFieldLabel}>{t('mailRecipientGroup')}</span>
						<select className={s.sheetFieldInput} value="" onChange={(e) => addGroup(e.target.value)}>
							<option value="">{t('mailGroupPlaceholder')}</option>
							{groups.map((group) => (
								<option key={group.id} value={group.id}>
									{group.label} ({group.count})
								</option>
							))}
						</select>
					</div>
					<div className={s.sheetFieldRow}>
						<span className={s.sheetFieldLabel}>{t('mailSubjectLabel')}</span>
						<input
							type="text"
							className={s.sheetFieldInput}
							placeholder={t('mailSubjectPh')}
							value={composeSubject}
							onChange={(e) => setComposeSubject(e.target.value)}
							required
						/>
					</div>
					<textarea
						className={s.sheetTextArea}
						placeholder={t('mailBodyPh')}
						value={composeBody}
						onChange={(e) => setComposeBody(e.target.value)}
						required
					/>
				</form>
			</div>
		</div>
	);
}
