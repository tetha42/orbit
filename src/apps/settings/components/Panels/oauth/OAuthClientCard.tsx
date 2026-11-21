'use client';

import React from 'react';
import { Check, Copy, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import type { OAuthClient } from '@/db/oauth';
import { useI18n } from '@/core/i18n';
import ui from '@/core/ui/ui.module.css';
import type { OAuthScopeMeta } from './useOAuthClients';

interface OAuthClientCardProps {
	client: OAuthClient;
	availableScopes: readonly OAuthScopeMeta[];
	copiedField: string | null;
	onCopy: (text: string, fieldName: string) => void;
	onRegenerateSecret: (client: OAuthClient) => void;
	onEdit: (client: OAuthClient) => void;
	onDelete: (client: OAuthClient) => void;
}

export function OAuthClientCard({
	client,
	availableScopes,
	copiedField,
	onCopy,
	onRegenerateSecret,
	onEdit,
	onDelete,
}: OAuthClientCardProps) {
	const { t } = useI18n();

	return (
		<div
			style={{
				background: 'var(--card-bg)',
				border: '1px solid var(--card-border)',
				borderRadius: '12px',
				padding: '16px 18px',
				display: 'flex',
				flexDirection: 'column',
				gap: '12px',
			}}
		>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
					<div style={{ fontWeight: 700, fontSize: '15px' }}>{client.name}</div>
					{client.trusted ? (
						<span
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: 4,
								padding: '2px 8px',
								borderRadius: '6px',
								background: 'color-mix(in srgb, var(--success) 15%, transparent)',
								color: 'var(--success)',
								fontSize: '11px',
								fontWeight: 700,
							}}
						>
							<ShieldCheck size={12} /> {t('oauthTrustedBadge')}
						</span>
					) : (
						<span
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: 4,
								padding: '2px 8px',
								borderRadius: '6px',
								background: 'var(--accent-subtle)',
								color: 'var(--accent)',
								fontSize: '11px',
								fontWeight: 600,
							}}
						>
							{t('oauthStandardBadge')}
						</span>
					)}
				</div>

				<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
					<button
						type="button"
						className={ui.btn}
						style={{ height: '28px', fontSize: '11.5px' }}
						onClick={() => onRegenerateSecret(client)}
						title={t('oauthRegenerateSecretBtn')}
					>
						<RefreshCw size={12} /> {t('oauthRegenerateSecretBtn')}
					</button>
					<button
						type="button"
						className={ui.btn}
						style={{ height: '28px', fontSize: '11.5px' }}
						onClick={() => onEdit(client)}
					>
						{t('edit')}
					</button>
					<button
						type="button"
						className={ui.btn}
						style={{ height: '28px', fontSize: '11.5px', color: 'var(--danger)' }}
						onClick={() => onDelete(client)}
						title={t('delete')}
					>
						<Trash2 size={13} />
					</button>
				</div>
			</div>

			{client.description && (
				<div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>{client.description}</div>
			)}

			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
					gap: '10px',
					background: 'rgba(0, 0, 0, 0.04)',
					padding: '10px 14px',
					borderRadius: '8px',
					fontSize: '12px',
				}}
			>
				<div>
					<div style={{ color: 'var(--text-secondary)', marginBottom: '2px' }}>Client ID:</div>
					<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
						<code style={{ fontFamily: 'monospace', fontWeight: 600 }}>{client.id}</code>
						<button
							type="button"
							className={ui.btn}
							style={{ height: '22px', padding: '0 6px' }}
							onClick={() => onCopy(client.id, 'Client ID')}
						>
							{copiedField === 'Client ID' ? <Check size={11} color="var(--success)" /> : <Copy size={11} />}
						</button>
					</div>
				</div>

				<div>
					<div style={{ color: 'var(--text-secondary)', marginBottom: '2px' }}>{t('oauthRedirectUrisTitle')}</div>
					<div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
						{client.redirectUris.map((u, i) => (
							<code key={i} style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--accent)' }}>
								{u}
							</code>
						))}
					</div>
				</div>
			</div>

			<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
				<div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
					{t('oauthScopesTitle')}
				</div>
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
					{availableScopes.map((scope) => {
						const isAllowed = (client.allowedScopes || []).includes(scope.id);
						return (
							<span
								key={scope.id}
								style={{
									fontSize: '11px',
									padding: '2px 8px',
									borderRadius: '6px',
									display: 'inline-flex',
									alignItems: 'center',
									gap: '4px',
									fontWeight: isAllowed ? 600 : 400,
									background: isAllowed ? 'var(--accent-subtle)' : 'rgba(255, 255, 255, 0.04)',
									color: isAllowed ? 'var(--accent)' : 'var(--text-secondary)',
									opacity: isAllowed ? 1 : 0.5,
									border: `1px solid ${isAllowed ? 'var(--accent-border)' : 'transparent'}`,
								}}
							>
								{isAllowed ? '✓' : '✗'} {scope.label}
							</span>
						);
					})}
				</div>
			</div>
		</div>
	);
}
