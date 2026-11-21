'use client';

import React from 'react';
import { Globe, Plus, Shield } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import ui from '@/core/ui/ui.module.css';
import { useOAuthClients } from './oauth/useOAuthClients';
import { OAuthClientCard } from './oauth/OAuthClientCard';
import { OAuthClientModal } from './oauth/OAuthClientModal';
import { OAuthCredentialsModal } from './oauth/OAuthCredentialsModal';

export function OAuthAppsPanel() {
	const { t } = useI18n();
	const state = useOAuthClients();

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
			{/* Header */}
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
				<div>
					<h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{t('oauthTitle')}</h2>
					<p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
						{t('oauthDesc')}
					</p>
				</div>

				<button
					type="button"
					className={ui.primaryBtn}
					onClick={state.openCreateModal}
					style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
				>
					<Plus size={15} />
					<span>{t('oauthNewAppBtn')}</span>
				</button>
			</div>

			{/* OIDC Discovery Info Card */}
			<div
				style={{
					background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
					border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
					borderRadius: '10px',
					padding: '12px 16px',
					fontSize: '12.5px',
					display: 'flex',
					flexDirection: 'column',
					gap: '6px',
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--accent)' }}>
					<Globe size={15} />
					<span>{t('oauthDiscoveryTitle')}</span>
				</div>
				<div style={{ color: 'var(--text-secondary)', lineHeight: 1.45 }}>
					{t('oauthDiscoveryDesc')}
					<code style={{ background: 'rgba(0, 0, 0, 0.15)', padding: '2px 6px', borderRadius: '4px', marginLeft: 6 }}>
						/.well-known/openid-configuration
					</code>
				</div>
			</div>

			{/* Clients List */}
			{state.loading ? (
				<div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)', fontSize: '13px' }}>
					{t('loading')}
				</div>
			) : state.clients.length === 0 ? (
				<div
					style={{
						textAlign: 'center',
						padding: '40px 20px',
						background: 'var(--card-bg)',
						border: '1px dashed var(--card-border)',
						borderRadius: '12px',
						color: 'var(--text-secondary)',
						fontSize: '13px',
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						gap: '10px',
					}}
				>
					<Shield size={32} style={{ opacity: 0.5 }} />
					<div>{t('oauthNoApps')}</div>
					<button type="button" className={ui.btn} onClick={state.openCreateModal}>
						{t('oauthFirstAppBtn')}
					</button>
				</div>
			) : (
				<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
					{state.clients.map((client) => (
						<OAuthClientCard
							key={client.id}
							client={client}
							availableScopes={state.availableScopes}
							copiedField={state.copiedField}
							onCopy={state.copyToClipboard}
							onRegenerateSecret={(c) => void state.handleRegenerateSecret(c)}
							onEdit={state.openEditModal}
							onDelete={(c) => void state.handleDelete(c)}
						/>
					))}
				</div>
			)}

			{state.showAddModal && (
				<OAuthClientModal
					editingClient={state.editingClient}
					availableScopes={state.availableScopes}
					formName={state.formName}
					formDesc={state.formDesc}
					formRedirects={state.formRedirects}
					formTrusted={state.formTrusted}
					formAllowedScopes={state.formAllowedScopes}
					formBusy={state.formBusy}
					onNameChange={state.setFormName}
					onDescChange={state.setFormDesc}
					onRedirectsChange={state.setFormRedirects}
					onTrustedChange={state.setFormTrusted}
					onAllowedScopesChange={state.setFormAllowedScopes}
					onClose={() => state.setShowAddModal(false)}
					onSubmit={state.handleFormSubmit}
				/>
			)}

			{state.revealedCreds && (
				<OAuthCredentialsModal
					creds={state.revealedCreds}
					copiedField={state.copiedField}
					onCopy={state.copyToClipboard}
					onClose={() => state.setRevealedCreds(null)}
				/>
			)}
		</div>
	);
}
