'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
	Check,
	Copy,
	Globe,
	Key,
	Lock,
	Plus,
	RefreshCw,
	Shield,
	ShieldAlert,
	ShieldCheck,
	Trash2,
} from 'lucide-react';
import type { OAuthClient } from '@/db/oauth';
import { Sheet } from '@/core/ui/Sheet';
import { useToast } from '@/core/ui/Toast';
import { useSound } from '@/core/sound';
import { useDialog } from '@/components/Common/DialogProvider';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import ui from '@/core/ui/ui.module.css';

export function OAuthAppsPanel() {
	const { t } = useI18n();
	const notify = useToast();
	const { playSystemSound } = useSound();
	const dialog = useDialog();

	const availableScopes = [
		{ id: 'openid', label: t('oauthScopeOpenid'), desc: t('oauthScopeOpenidDesc'), required: true },
		{ id: 'profile', label: t('oauthScopeProfile'), desc: t('oauthScopeProfileDesc'), required: false },
		{ id: 'email', label: t('oauthScopeEmail'), desc: t('oauthScopeEmailDesc'), required: false },
		{ id: 'academic', label: t('oauthScopeAcademic'), desc: t('oauthScopeAcademicDesc'), required: false },
		{ id: 'roles', label: t('oauthScopeRoles'), desc: t('oauthScopeRolesDesc'), required: false },
	] as const;

	const [clients, setClients] = useState<OAuthClient[]>([]);
	const [loading, setLoading] = useState(true);

	// Modal states
	const [showAddModal, setShowAddModal] = useState(false);
	const [editingClient, setEditingClient] = useState<OAuthClient | null>(null);

	// Form fields
	const [formName, setFormName] = useState('');
	const [formDesc, setFormDesc] = useState('');
	const [formRedirects, setFormRedirects] = useState('');
	const [formTrusted, setFormTrusted] = useState(false);
	const [formAllowedScopes, setFormAllowedScopes] = useState<string[]>([
		'openid',
		'profile',
		'email',
		'academic',
		'roles',
	]);
	const [formBusy, setFormBusy] = useState(false);

	// Secret reveal modal
	const [revealedCreds, setRevealedCreds] = useState<{
		name: string;
		clientId: string;
		clientSecret: string;
	} | null>(null);

	const [copiedField, setCopiedField] = useState<string | null>(null);

	const copyToClipboard = (text: string, fieldName: string) => {
		navigator.clipboard.writeText(text);
		setCopiedField(fieldName);
		notify(fill(t('oauthCopiedPrompt'), { name: fieldName }));
		playSystemSound();
		setTimeout(() => setCopiedField(null), 2000);
	};

	const fetchClients = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch('/api/oauth/clients');
			const data = await res.json();
			if (res.ok && data.clients) {
				setClients(data.clients);
			} else {
				notify(data.error || t('oauthFetchError'), 'error');
			}
		} catch {
			notify(t('connError'), 'error');
		} finally {
			setLoading(false);
		}
	}, [notify, t]);

	useEffect(() => {
		let live = true;
		void fetch('/api/oauth/clients')
			.then((res) => res.json())
			.then((data) => {
				if (live && data.clients) setClients(data.clients);
			})
			.catch(() => {})
			.finally(() => {
				if (live) setLoading(false);
			});
		return () => {
			live = false;
		};
	}, []);

	const openCreateModal = () => {
		setEditingClient(null);
		setFormName('');
		setFormDesc('');
		setFormRedirects('');
		setFormTrusted(false);
		setFormAllowedScopes(['openid', 'profile', 'email', 'academic', 'roles']);
		setShowAddModal(true);
	};

	const openEditModal = (c: OAuthClient) => {
		setEditingClient(c);
		setFormName(c.ad);
		setFormDesc(c.aciklama);
		setFormRedirects(c.redirectUris.join('\n'));
		setFormTrusted(c.guvenilir);
		setFormAllowedScopes(
			Array.isArray(c.allowedScopes) && c.allowedScopes.length > 0
				? c.allowedScopes
				: ['openid', 'profile', 'email', 'academic', 'roles']
		);
		setShowAddModal(true);
	};

	const handleFormSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setFormBusy(true);

		const redirectUris = formRedirects.split('\n').map((u) => u.trim()).filter(Boolean);
		const allowedScopes = Array.from(new Set(['openid', ...formAllowedScopes]));

		try {
			if (editingClient) {
				const res = await fetch('/api/oauth/clients', {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						id: editingClient.id,
						ad: formName,
						aciklama: formDesc,
						redirectUris,
						allowedScopes,
						guvenilir: formTrusted,
					}),
				});
				const data = await res.json();
				if (res.ok) {
					notify(t('oauthAppUpdated'));
					setShowAddModal(false);
					await fetchClients();
				} else {
					notify(data.error || t('saveFailed'), 'error');
				}
			} else {
				const res = await fetch('/api/oauth/clients', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						ad: formName,
						aciklama: formDesc,
						redirectUris,
						allowedScopes,
						guvenilir: formTrusted,
					}),
				});
				const data = await res.json();
				if (res.ok) {
					notify(t('oauthAppCreated'));
					setShowAddModal(false);
					setRevealedCreds({
						name: data.client.ad,
						clientId: data.client.id,
						clientSecret: data.plainSecret,
					});
					await fetchClients();
				} else {
					notify(data.error || t('saveFailed'), 'error');
				}
			}
		} catch {
			notify(t('serverError'), 'error');
		} finally {
			setFormBusy(false);
		}
	};

	const handleRegenerateSecret = async (c: OAuthClient) => {
		const confirmed = await dialog.confirm({
			title: t('oauthRegenTitle'),
			message: fill(t('oauthRegenConfirm'), { name: c.ad }),
			tone: 'danger',
			confirmLabel: t('oauthRegenAction'),
		});
		if (!confirmed) {
			return;
		}

		try {
			const res = await fetch('/api/oauth/clients', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: c.id, action: 'regenerate_secret' }),
			});
			const data = await res.json();
			if (res.ok && data.plainSecret) {
				notify(t('oauthRegenSuccess'));
				setRevealedCreds({
					name: c.ad,
					clientId: c.id,
					clientSecret: data.plainSecret,
				});
			} else {
				notify(data.error || t('oauthRegenError'), 'error');
			}
		} catch {
			notify(t('connError'), 'error');
		}
	};

	const handleDelete = async (c: OAuthClient) => {
		const confirmed = await dialog.confirm({
			title: t('oauthDeleteTitle'),
			message: fill(t('oauthDeleteConfirm'), { name: c.ad }),
			tone: 'danger',
			confirmLabel: t('oauthDeleteTitle'),
		});
		if (!confirmed) {
			return;
		}

		try {
			const res = await fetch(`/api/oauth/clients?id=${c.id}`, { method: 'DELETE' });
			const data = await res.json();
			if (res.ok) {
				notify(t('oauthAppDeleted'));
				await fetchClients();
			} else {
				notify(data.error || t('oauthDeleteError'), 'error');
			}
		} catch {
			notify(t('connError'), 'error');
		}
	};

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
					onClick={openCreateModal}
					style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
				>
					<Plus size={15} />
					<span>{t('oauthNewAppBtn')}</span>
				</button>
			</div>

			{/* OIDC Discovery Info Card */}
			<div
				style={{
					background: 'rgba(10, 132, 255, 0.08)',
					border: '1px solid rgba(10, 132, 255, 0.25)',
					borderRadius: '10px',
					padding: '12px 16px',
					fontSize: '12.5px',
					display: 'flex',
					flexDirection: 'column',
					gap: '6px',
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#0a84ff' }}>
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
			{loading ? (
				<div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)', fontSize: '13px' }}>
					{t('loading')}
				</div>
			) : clients.length === 0 ? (
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
					<button type="button" className={ui.btn} onClick={openCreateModal}>
						{t('oauthFirstAppBtn')}
					</button>
				</div>
			) : (
				<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
					{clients.map((c) => (
						<div
							key={c.id}
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
									<div style={{ fontWeight: 700, fontSize: '15px' }}>{c.ad}</div>
									{c.guvenilir ? (
										<span
											style={{
												display: 'inline-flex',
												alignItems: 'center',
												gap: 4,
												padding: '2px 8px',
												borderRadius: '6px',
												background: 'rgba(48, 209, 88, 0.15)',
												color: '#30d158',
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
										onClick={() => handleRegenerateSecret(c)}
										title={t('oauthRegenerateSecretBtn')}
									>
										<RefreshCw size={12} /> {t('oauthRegenerateSecretBtn')}
									</button>
									<button
										type="button"
										className={ui.btn}
										style={{ height: '28px', fontSize: '11.5px' }}
										onClick={() => openEditModal(c)}
									>
										{t('edit')}
									</button>
									<button
										type="button"
										className={ui.btn}
										style={{ height: '28px', fontSize: '11.5px', color: '#ff453a' }}
										onClick={() => handleDelete(c)}
										title={t('delete')}
									>
										<Trash2 size={13} />
									</button>
								</div>
							</div>

							{c.aciklama && (
								<div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>{c.aciklama}</div>
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
										<code style={{ fontFamily: 'monospace', fontWeight: 600 }}>{c.id}</code>
										<button
											type="button"
											className={ui.btn}
											style={{ height: '22px', padding: '0 6px' }}
											onClick={() => copyToClipboard(c.id, 'Client ID')}
										>
											{copiedField === 'Client ID' ? <Check size={11} color="#30d158" /> : <Copy size={11} />}
										</button>
									</div>
								</div>

								<div>
									<div style={{ color: 'var(--text-secondary)', marginBottom: '2px' }}>{t('oauthRedirectUrisTitle')}</div>
									<div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
										{c.redirectUris.map((u, i) => (
											<code key={i} style={{ fontFamily: 'monospace', fontSize: '11px', color: '#0a84ff' }}>
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
										const isAllowed = (c.allowedScopes || []).includes(scope.id);
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
					))}
				</div>
			)}

			{/* Create / Edit Sheet Modal */}
			{showAddModal && (
				<Sheet
					title={editingClient ? fill(t('oauthEditAppTitle'), { name: editingClient.ad }) : t('oauthNewAppTitle')}
					label={t('oauthAppLabel')}
					icon={<Lock size={18} color="#0a84ff" />}
					onClose={() => setShowAddModal(false)}
					onSubmit={handleFormSubmit}
					maxWidth={580}
					footer={
						<>
							<button type="button" className={ui.btn} onClick={() => setShowAddModal(false)}>
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
								onChange={(e) => setFormName(e.target.value)}
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
								onChange={(e) => setFormDesc(e.target.value)}
							/>
						</label>

						<label className={ui.field}>
							<span className={ui.fieldLabel}>{t('oauthRedirectUriLabel')} *</span>
							<textarea
								className={ui.input}
								style={{ height: '70px', fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }}
								placeholder="https://lab.orbit.local/api/auth/callback&#10;http://localhost:4000/callback"
								value={formRedirects}
								onChange={(e) => setFormRedirects(e.target.value)}
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
														setFormAllowedScopes((prev) => [...prev, sc.id]);
													} else {
														setFormAllowedScopes((prev) => prev.filter((s) => s !== sc.id));
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
								onChange={(e) => setFormTrusted(e.target.checked)}
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
			)}

			{/* Revealed Credentials Modal */}
			{revealedCreds && (
				<Sheet
					title={t('oauthCredsTitle')}
					label={t('oauthCredsLabel')}
					icon={<Key size={18} color="#30d158" />}
					onClose={() => setRevealedCreds(null)}
					maxWidth={620}
					footer={
						<button type="button" className={ui.primaryBtn} onClick={() => setRevealedCreds(null)}>
							{t('oauthCredsCloseBtn')}
						</button>
					}
				>
					<div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
						<div
							style={{
								padding: '12px 14px',
								borderRadius: '8px',
								background: 'rgba(255, 159, 10, 0.12)',
								border: '1px solid rgba(255, 159, 10, 0.3)',
								color: '#ff9f0a',
								fontSize: '12.5px',
								display: 'flex',
								alignItems: 'center',
								gap: '10px',
							}}
						>
							<ShieldAlert size={20} style={{ flexShrink: 0 }} />
							<span>
								{t('oauthCredsWarning')}
							</span>
						</div>

						<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
							<div>
								<span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('oauthAppNameLabel')}:</span>
								<div style={{ fontSize: '14px', fontWeight: 700 }}>{revealedCreds.name}</div>
							</div>

							<div>
								<span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Client ID:</span>
								<div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
									<input className={ui.input} readOnly value={revealedCreds.clientId} style={{ fontFamily: 'monospace' }} />
									<button
										type="button"
										className={ui.btn}
										onClick={() => copyToClipboard(revealedCreds.clientId, 'Client ID')}
									>
										{copiedField === 'Client ID' ? <Check size={14} color="#30d158" /> : <Copy size={14} />}
									</button>
								</div>
							</div>

							<div>
								<span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Client Secret:</span>
								<div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
									<input
										className={ui.input}
										readOnly
										value={revealedCreds.clientSecret}
										style={{ fontFamily: 'monospace', color: '#30d158', fontWeight: 600 }}
									/>
									<button
										type="button"
										className={ui.btn}
										onClick={() => copyToClipboard(revealedCreds.clientSecret, 'Client Secret')}
									>
										{copiedField === 'Client Secret' ? <Check size={14} color="#30d158" /> : <Copy size={14} />}
									</button>
								</div>
							</div>
						</div>
					</div>
				</Sheet>
			)}
		</div>
	);
}
