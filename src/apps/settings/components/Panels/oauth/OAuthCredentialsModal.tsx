'use client';

import React from 'react';
import { Check, Copy, Key, ShieldAlert } from 'lucide-react';
import { Sheet } from '@/core/ui/Sheet';
import { useI18n } from '@/core/i18n';
import ui from '@/core/ui/ui.module.css';
import type { RevealedOAuthCreds } from './useOAuthClients';

interface OAuthCredentialsModalProps {
	creds: RevealedOAuthCreds;
	copiedField: string | null;
	onCopy: (text: string, fieldName: string) => void;
	onClose: () => void;
}

export function OAuthCredentialsModal({
	creds,
	copiedField,
	onCopy,
	onClose,
}: OAuthCredentialsModalProps) {
	const { t } = useI18n();

	return (
		<Sheet
			title={t('oauthCredsTitle')}
			label={t('oauthCredsLabel')}
			icon={<Key size={18} color="var(--success)" />}
			onClose={onClose}
			maxWidth={620}
			footer={
				<button type="button" className={ui.primaryBtn} onClick={onClose}>
					{t('oauthCredsCloseBtn')}
				</button>
			}
		>
			<div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
				<div
					style={{
						padding: '12px 14px',
						borderRadius: '8px',
						background: 'color-mix(in srgb, var(--warning) 12%, transparent)',
						border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
						color: 'var(--warning)',
						fontSize: '12.5px',
						display: 'flex',
						alignItems: 'center',
						gap: '10px',
					}}
				>
					<ShieldAlert size={20} style={{ flexShrink: 0 }} />
					<span>{t('oauthCredsWarning')}</span>
				</div>

				<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
					<div>
						<span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
							{t('oauthAppNameLabel')}:
						</span>
						<div style={{ fontSize: '14px', fontWeight: 700 }}>{creds.name}</div>
					</div>

					<div>
						<span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Client ID:</span>
						<div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
							<input className={ui.input} readOnly value={creds.clientId} style={{ fontFamily: 'monospace' }} />
							<button
								type="button"
								className={ui.btn}
								onClick={() => onCopy(creds.clientId, 'Client ID')}
							>
								{copiedField === 'Client ID' ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
							</button>
						</div>
					</div>

					<div>
						<span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Client Secret:</span>
						<div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
							<input
								className={ui.input}
								readOnly
								value={creds.clientSecret}
								style={{ fontFamily: 'monospace', color: 'var(--success)', fontWeight: 600 }}
							/>
							<button
								type="button"
								className={ui.btn}
								onClick={() => onCopy(creds.clientSecret, 'Client Secret')}
							>
								{copiedField === 'Client Secret' ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
							</button>
						</div>
					</div>
				</div>
			</div>
		</Sheet>
	);
}
