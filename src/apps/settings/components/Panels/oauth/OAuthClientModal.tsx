'use client';

import React from 'react';
import { Lock } from 'lucide-react';
import type { OAuthClient } from '@/db/oauth';
import { Sheet } from '@/core/ui/Sheet';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import ui from '@/core/ui/ui.module.css';
import type { OAuthScopeMeta } from './useOAuthClients';

interface OAuthClientModalProps {
	editingClient: OAuthClient | null;
	availableScopes: readonly OAuthScopeMeta[];
	formName: string;
	formDesc: string;
	formRedirects: string;
	formTrusted: boolean;
	formAllowedScopes: string[];
	formBusy: boolean;
	onNameChange: (value: string) => void;
	onDescChange: (value: string) => void;
	onRedirectsChange: (value: string) => void;
	onTrustedChange: (value: boolean) => void;
	onAllowedScopesChange: React.Dispatch<React.SetStateAction<string[]>>;
	onClose: () => void;
	onSubmit: (e: React.FormEvent) => void;
}

export function OAuthClientModal({
	editingClient,
	availableScopes,
	formName,
	formDesc,
	formRedirects,
	formTrusted,
	formAllowedScopes,
	formBusy,
	onNameChange,
	onDescChange,
	onRedirectsChange,
	onTrustedChange,
	onAllowedScopesChange,
	onClose,
	onSubmit,
}: OAuthClientModalProps) {
	const { t } = useI18n();

	return (
		<Sheet
			title={editingClient ? fill(t('oauthEditAppTitle'), { name: editingClient.name }) : t('oauthNewAppTitle')}
			label={t('oauthAppLabel')}
			icon={<Lock size={18} color="var(--accent)" />}
			onClose={onClose}
			onSubmit={onSubmit}
			maxWidth={580}
			footer={
				<>
					<button type="button" className={ui.btn} onClick={onClose}>
						{t('btnCancel')}
					</button>
					<button type="submit" className={ui.primaryBtn} disabled={formBusy}>
						{formBusy ? t('saving') : editingClient ? t('oauthUpdateAppBtn') : t('oauthCreateAppBtn')}
					</button>
				</>
			}
		>
			<div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px' }}>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('oauthAppNameLabel')} *</span>
					<input
						className={ui.input}
						placeholder={t('oauthAppNamePlaceholder')}
						value={formName}
						onChange={(e) => onNameChange(e.target.value)}
						required
						autoFocus
					/>
				</label>

				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('oauthDescOptional')}</span>
					<input
						className={ui.input}
						placeholder={t('oauthDescPlaceholder')}
						value={formDesc}
						onChange={(e) => onDescChange(e.target.value)}
					/>
				</label>

				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('oauthRedirectUriLabel')} *</span>
					<textarea
						className={ui.input}
						style={{ height: '70px', fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }}
						placeholder="https://lab.orbit.local/api/auth/callback&#10;http://localhost:4000/callback"
						value={formRedirects}
						onChange={(e) => onRedirectsChange(e.target.value)}
						required
					/>
					<span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
						{t('oauthRedirectHelp')}
					</span>
				</label>

				<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
					<span className={ui.fieldLabel}>{t('oauthScopePolicyTitle')}</span>
					<p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0 }}>
						{t('oauthScopePolicyDesc')}
					</p>
					<div
						style={{
							display: 'flex',
							flexDirection: 'column',
							gap: '8px',
							background: 'rgba(0, 0, 0, 0.03)',
							border: '1px solid var(--card-border)',
							borderRadius: '8px',
							padding: '10px 12px',
						}}
					>
						{availableScopes.map((sc) => {
							const isChecked = formAllowedScopes.includes(sc.id) || sc.required;
							return (
								<label
									key={sc.id}
									style={{
										display: 'flex',
										alignItems: 'flex-start',
										gap: '10px',
										cursor: sc.required ? 'not-allowed' : 'pointer',
										opacity: sc.required ? 0.75 : 1,
									}}
								>
									<input
										type="checkbox"
										checked={isChecked}
										disabled={sc.required}
										onChange={(e) => {
											if (sc.required) return;
											if (e.target.checked) {
												onAllowedScopesChange((prev) => [...prev, sc.id]);
											} else {
												onAllowedScopesChange((prev) => prev.filter((s) => s !== sc.id));
											}
										}}
										style={{ marginTop: '3px', width: '15px', height: '15px' }}
									/>
									<div style={{ display: 'flex', flexDirection: 'column' }}>
										<span style={{ fontSize: '12.5px', fontWeight: 600 }}>
											{sc.label} <code style={{ fontSize: '11px', opacity: 0.7 }}>({sc.id})</code>
										</span>
										<span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{sc.desc}</span>
									</div>
								</label>
							);
						})}
					</div>
				</div>

				<label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginTop: '6px' }}>
					<input
						type="checkbox"
						checked={formTrusted}
						onChange={(e) => onTrustedChange(e.target.checked)}
						style={{ width: '16px', height: '16px', cursor: 'pointer' }}
					/>
					<div style={{ display: 'flex', flexDirection: 'column' }}>
						<span style={{ fontSize: '13px', fontWeight: 600 }}>{t('oauthTrustedLabel')}</span>
						<span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
							{t('oauthTrustedDesc')}
						</span>
					</div>
				</label>
			</div>
		</Sheet>
	);
}
