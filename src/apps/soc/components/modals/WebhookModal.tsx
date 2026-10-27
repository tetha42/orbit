'use client';

import React from 'react';
import { Bell, Mail, X } from 'lucide-react';
import { useSoc } from '../../context/SocContext';
import s from './SocModals.module.css';

export const WebhookModal = React.memo(function WebhookModal() {
	const {
		showWebhookModal,
		setShowWebhookModal,
		webhookConfig,
		setWebhookConfig,
		isTestingWebhook,
		handleSaveWebhook,
		handleTestWebhook,
		isSubmitting,
		isEn,
	} = useSoc();

	// Local form draft state: decoupled from background SSE/auto-refresh re-renders
	const [draft, setDraft] = React.useState(webhookConfig);

	React.useEffect(() => {
		if (showWebhookModal) {
			setDraft(webhookConfig);
		}
	}, [showWebhookModal, webhookConfig]);

	if (!showWebhookModal) return null;

	const handleSave = async () => {
		setWebhookConfig(draft);
		await handleSaveWebhook(draft);
	};

	const handleTest = async () => {
		await handleTestWebhook(draft);
	};

	const handleToggleNotify = (key: 'lockdown' | 'autoban' | 'honeypot' | 'fim' | 'loginAnomalies', val: boolean) => {
		setDraft((prev) => ({
			...prev,
			notifyOn: {
				lockdown: true,
				autoban: true,
				honeypot: true,
				fim: true,
				loginAnomalies: false,
				...(prev?.notifyOn || {}),
				[key]: val,
			},
		}));
	};

	return (
		<div className={s.backdrop} onClick={() => setShowWebhookModal(false)}>
			<div className={s.modal} onClick={(e) => e.stopPropagation()}>
				<div className={s.modalHeader}>
					<div className={s.modalHeaderTitle}>
						<Bell size={16} />
						<span>{isEn ? 'External Security Alert Webhooks' : 'Dış Güvenlik Alarm Webhook Bildirimleri'}</span>
					</div>
					<button
						type="button"
						className={s.closeBtn}
						onClick={() => setShowWebhookModal(false)}
					>
						<X size={14} />
					</button>
				</div>

				<div className={s.modalBody}>
					<p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
						{isEn
							? 'Dispatches non-blocking instant security alerts to your Discord channel, Telegram chat, or generic incident response webhook upon DEFCON 1 lockdown, IPS auto-bans, or honeypot trips.'
							: 'DEFCON 1 karantinası, IPS otomatik banları veya honeypot tuzakları tetiklendiğinde Discord kanalınıza veya Telegram grubunuza anlık adli bildirimler iletir.'}
					</p>

					<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						<input
							type="checkbox"
							id="webhookEnabled"
							checked={draft.enabled}
							onChange={(e) => setDraft((prev) => ({ ...prev, enabled: e.target.checked }))}
						/>
						<label htmlFor="webhookEnabled" style={{ fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
							{isEn ? 'Enable External Webhook Notifications' : 'Dış Webhook Bildirimlerini Etkinleştir'}
						</label>
					</div>

					<div className={s.formField}>
						<label>{isEn ? 'Notification Platform' : 'Bildirim Platformu'}</label>
						<select
							className={s.select}
							value={draft.provider}
							onChange={(e) =>
								setDraft((prev) => ({
									...prev,
									provider: e.target.value as 'discord' | 'telegram' | 'generic' | 'email',
								}))
							}
						>
							<option value="discord">Discord Webhook</option>
							<option value="telegram">Telegram Bot & Chat</option>
							<option value="email">{isEn ? 'Email (SMTP)' : 'E-Posta (SMTP)'}</option>
							<option value="generic">Generic JSON Webhook</option>
						</select>
					</div>

					{draft.provider === 'telegram' ? (
						<>
							<div className={s.formField}>
								<label>{isEn ? 'Telegram Bot Token' : 'Telegram Bot API Token'}</label>
								<input
									type="password"
									className={s.input}
									placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
									value={draft.botToken || ''}
									onChange={(e) => setDraft((prev) => ({ ...prev, botToken: e.target.value }))}
								/>
							</div>
							<div className={s.formField}>
								<label>{isEn ? 'Telegram Chat ID' : 'Telegram Chat / Kanal ID'}</label>
								<input
									type="text"
									className={s.input}
									placeholder="-1001234567890"
									value={draft.chatId || ''}
									onChange={(e) => setDraft((prev) => ({ ...prev, chatId: e.target.value }))}
								/>
							</div>
						</>
					) : draft.provider === 'email' ? (
						<div className={s.formField}>
							<label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
								<Mail size={13} />
								{isEn ? 'Alert Recipient Emails' : 'Alarm Alıcı E-Postaları'}
							</label>
							<input
								type="text"
								className={s.input}
								placeholder="security@club.org, admin@club.org"
								value={draft.emailRecipients || ''}
								onChange={(e) => setDraft((prev) => ({ ...prev, emailRecipients: e.target.value }))}
							/>
						</div>
					) : (
						<>
							<div className={s.formField}>
								<label>{isEn ? 'Webhook URL' : 'Webhook Adresi (URL)'}</label>
								<input
									type="url"
									className={s.input}
									placeholder={draft.provider === 'discord' ? 'https://discord.com/api/webhooks/...' : 'https://siem.internal/api/alerts'}
									value={draft.webhookUrl || ''}
									onChange={(e) => setDraft((prev) => ({ ...prev, webhookUrl: e.target.value }))}
								/>
							</div>
							<div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', background: 'var(--fill-soft, rgba(0,0,0,0.03))', borderRadius: 6, border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))' }}>
								<label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
									<input
										type="checkbox"
										checked={Boolean(draft.alsoSendEmail)}
										onChange={(e) => setDraft((prev) => ({ ...prev, alsoSendEmail: e.target.checked }))}
									/>
									{isEn ? 'Also dispatch alert to email addresses' : 'Ayrıca alarmları e-posta adreslerine de gönder'}
								</label>
								{draft.alsoSendEmail && (
									<input
										type="text"
										className={s.input}
										placeholder={isEn ? 'security@club.org, admin@club.org' : 'guvenlik@kulup.org, admin@kulup.org'}
										value={draft.emailRecipients || ''}
										onChange={(e) => setDraft((prev) => ({ ...prev, emailRecipients: e.target.value }))}
									/>
								)}
							</div>
						</>
					)}

					<div className={s.formField}>
						<label>{isEn ? 'Minimum Event Severity' : 'Minimum Alarm Seviyesi'}</label>
						<select
							className={s.select}
							value={draft.minSeverity}
							onChange={(e) => setDraft((prev) => ({ ...prev, minSeverity: e.target.value as 'CRITICAL' | 'ERROR' | 'WARN' }))}
						>
							<option value="CRITICAL">{isEn ? 'CRITICAL Only (Lockdown & Honeypot)' : 'Yalnızca CRITICAL'}</option>
							<option value="ERROR">{isEn ? 'ERROR and above (IPS Auto-Bans)' : 'ERROR ve üstü'}</option>
							<option value="WARN">{isEn ? 'WARN and above (All Security Events)' : 'WARN ve üstü'}</option>
						</select>
					</div>

					<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
						<label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
							{isEn ? 'Trigger Events' : 'Tetikleyici AppEvent Türleri'}
						</label>
						<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
							<label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
								<input
									type="checkbox"
									checked={Boolean(draft?.notifyOn?.lockdown)}
									onChange={(e) => handleToggleNotify('lockdown', e.target.checked)}
								/>
								DEFCON Lockdown
							</label>
							<label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
								<input
									type="checkbox"
									checked={Boolean(draft?.notifyOn?.autoban)}
									onChange={(e) => handleToggleNotify('autoban', e.target.checked)}
								/>
								IPS Auto-Ban
							</label>
							<label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
								<input
									type="checkbox"
									checked={Boolean(draft?.notifyOn?.honeypot)}
									onChange={(e) => handleToggleNotify('honeypot', e.target.checked)}
								/>
								Canary Honeypot
							</label>
							<label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
								<input
									type="checkbox"
									checked={Boolean(draft?.notifyOn?.fim)}
									onChange={(e) => handleToggleNotify('fim', e.target.checked)}
								/>
								FIM Web Shell
							</label>
						</div>
					</div>
				</div>

				<div className={s.modalFooter}>
					<button
						type="button"
						className={s.btn}
						onClick={() => void handleTest()}
						disabled={isTestingWebhook || isSubmitting}
					>
						{isTestingWebhook ? (isEn ? 'Sending...' : 'Gönderiliyor...') : (isEn ? 'Test Alert' : 'Test Gönder')}
					</button>
					<button
						type="button"
						className={`${s.btn} ${s.btnPrimary}`}
						onClick={() => void handleSave()}
						disabled={isSubmitting}
					>
						{isEn ? 'Save Webhook' : 'Kaydet'}
					</button>
				</div>
			</div>
		</div>
	);
});
