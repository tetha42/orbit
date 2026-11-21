'use client';

import React from 'react';
import { Mail } from 'lucide-react';
import type { WebhookConfig } from '../../../types';
import type { MODALS_I18N } from '../i18nModals';
import s from '../SocModals.module.css';

interface WebhookPlatformFieldsProps {
	draft: WebhookConfig;
	setDraft: React.Dispatch<React.SetStateAction<WebhookConfig>>;
	copy: (typeof MODALS_I18N)['en'] | (typeof MODALS_I18N)['tr'];
}

export function WebhookPlatformFields({ draft, setDraft, copy }: WebhookPlatformFieldsProps) {
	if (draft.provider === 'telegram') {
		return (
			<>
				<div className={s.formField}>
					<label>{copy.webhookBotToken}</label>
					<input
						type="password"
						className={s.input}
						placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
						value={draft.botToken || ''}
						onChange={(e) => setDraft((prev) => ({ ...prev, botToken: e.target.value }))}
					/>
				</div>
				<div className={s.formField}>
					<label>{copy.webhookChatId}</label>
					<input
						type="text"
						className={s.input}
						placeholder="-1001234567890"
						value={draft.chatId || ''}
						onChange={(e) => setDraft((prev) => ({ ...prev, chatId: e.target.value }))}
					/>
				</div>
			</>
		);
	}

	if (draft.provider === 'email') {
		return (
			<div className={s.formField}>
				<label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
					<Mail size={13} />
					{copy.webhookEmailRecipients}
				</label>
				<input
					type="text"
					className={s.input}
					placeholder={copy.webhookEmailPlaceholder}
					value={draft.emailRecipients || ''}
					onChange={(e) => setDraft((prev) => ({ ...prev, emailRecipients: e.target.value }))}
				/>
			</div>
		);
	}

	return (
		<>
			<div className={s.formField}>
				<label>{copy.webhookUrlLabel}</label>
				<input
					type="url"
					className={s.input}
					placeholder={
						draft.provider === 'discord'
							? 'https://discord.com/api/webhooks/...'
							: 'https://siem.internal/api/alerts'
					}
					value={draft.webhookUrl || ''}
					onChange={(e) => setDraft((prev) => ({ ...prev, webhookUrl: e.target.value }))}
				/>
			</div>
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					gap: 6,
					padding: '8px 10px',
					background: 'var(--fill-soft, rgba(0,0,0,0.03))',
					borderRadius: 6,
					border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
				}}
			>
				<label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
					<input
						type="checkbox"
						checked={Boolean(draft.alsoSendEmail)}
						onChange={(e) => setDraft((prev) => ({ ...prev, alsoSendEmail: e.target.checked }))}
					/>
					{copy.webhookAlsoEmail}
				</label>
				{draft.alsoSendEmail && (
					<input
						type="text"
						className={s.input}
						placeholder={copy.webhookEmailPlaceholder}
						value={draft.emailRecipients || ''}
						onChange={(e) => setDraft((prev) => ({ ...prev, emailRecipients: e.target.value }))}
					/>
				)}
			</div>
		</>
	);
}
