'use client';

import React from 'react';
import { Bell, X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useSoc } from '../../context/SocContext';
import { MODALS_I18N } from './i18nModals';
import { WebhookPlatformFields } from './webhook/WebhookPlatformFields';
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
	} = useSoc();
	const { language } = useI18n();
	const copy = MODALS_I18N[language] ?? MODALS_I18N.en;

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

	const handleToggleNotify = (
		key: 'lockdown' | 'autoban' | 'honeypot' | 'fim' | 'loginAnomalies',
		val: boolean
	) => {
		setDraft((prev) => ({
			...prev,
			notifyOn: {
				lockdown: prev?.notifyOn?.lockdown ?? true,
				autoban: prev?.notifyOn?.autoban ?? true,
				honeypot: prev?.notifyOn?.honeypot ?? true,
				fim: prev?.notifyOn?.fim ?? true,
				loginAnomalies: prev?.notifyOn?.loginAnomalies ?? false,
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
						<span>{copy.webhookTitle}</span>
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
						{copy.webhookDesc}
					</p>

					<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						<input
							type="checkbox"
							id="webhookEnabled"
							checked={draft.enabled}
							onChange={(e) => setDraft((prev) => ({ ...prev, enabled: e.target.checked }))}
						/>
						<label htmlFor="webhookEnabled" style={{ fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
							{copy.webhookEnableLabel}
						</label>
					</div>

					<div className={s.formField}>
						<label>{copy.webhookPlatformLabel}</label>
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
							<option value="email">{copy.webhookEmailSmtp}</option>
							<option value="generic">Generic JSON Webhook</option>
						</select>
					</div>

					<WebhookPlatformFields draft={draft} setDraft={setDraft} copy={copy} />

					<div className={s.formField}>
						<label>{copy.webhookMinSeverity}</label>
						<select
							className={s.select}
							value={draft.minSeverity}
							onChange={(e) =>
								setDraft((prev) => ({
									...prev,
									minSeverity: e.target.value as 'CRITICAL' | 'ERROR' | 'WARN',
								}))
							}
						>
							<option value="CRITICAL">{copy.webhookSevCritical}</option>
							<option value="ERROR">{copy.webhookSevError}</option>
							<option value="WARN">{copy.webhookSevWarn}</option>
						</select>
					</div>

					<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
						<label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
							{copy.webhookTriggers}
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
						{isTestingWebhook ? copy.webhookSending : copy.webhookTestAlert}
					</button>
					<button
						type="button"
						className={`${s.btn} ${s.btnPrimary}`}
						onClick={() => void handleSave()}
						disabled={isSubmitting}
					>
						{copy.webhookSave}
					</button>
				</div>
			</div>
		</div>
	);
});
