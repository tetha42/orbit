'use client';

import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { OAuthClient } from '@/db/oauth';
import { useToast } from '@/core/ui/Toast';
import { useSound } from '@/core/sound';
import { useDialog } from '@/components/Common/DialogProvider';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import {
	buildAvailableScopes,
	DEFAULT_OAUTH_SCOPES,
	type OAuthScopeMeta,
	type RevealedOAuthCreds,
} from './oauthClientTypes';
import { useOAuthClientActions } from './useOAuthClientActions';

export type { OAuthScopeMeta, RevealedOAuthCreds };

export function useOAuthClients() {
	const { t } = useI18n();
	const notify = useToast();
	const { playSystemSound } = useSound();
	const dialog = useDialog();

	const availableScopes = buildAvailableScopes(t);
	const [clients, setClients] = useState<OAuthClient[]>([]);
	const [loading, setLoading] = useState(true);
	const [showAddModal, setShowAddModal] = useState(false);
	const [editingClient, setEditingClient] = useState<OAuthClient | null>(null);

	const [formName, setFormName] = useState('');
	const [formDesc, setFormDesc] = useState('');
	const [formRedirects, setFormRedirects] = useState('');
	const [formTrusted, setFormTrusted] = useState(false);
	const [formAllowedScopes, setFormAllowedScopes] = useState<string[]>(DEFAULT_OAUTH_SCOPES);
	const [formBusy, setFormBusy] = useState(false);

	const [revealedCreds, setRevealedCreds] = useState<RevealedOAuthCreds | null>(null);
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
		setFormAllowedScopes(DEFAULT_OAUTH_SCOPES);
		setShowAddModal(true);
	};

	const openEditModal = (client: OAuthClient) => {
		setEditingClient(client);
		setFormName(client.name);
		setFormDesc(client.description);
		setFormRedirects(client.redirectUris.join('\n'));
		setFormTrusted(client.trusted);
		setFormAllowedScopes(
			Array.isArray(client.allowedScopes) && client.allowedScopes.length > 0
				? client.allowedScopes
				: DEFAULT_OAUTH_SCOPES,
		);
		setShowAddModal(true);
	};

	const handleFormSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setFormBusy(true);
		const redirectUris = formRedirects.split('\n').map((u) => u.trim()).filter(Boolean);
		const allowedScopes = Array.from(new Set(['openid', ...formAllowedScopes]));

		try {
			const isEdit = Boolean(editingClient);
			const res = await fetch('/api/oauth/clients', {
				method: isEdit ? 'PATCH' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...(editingClient ? { id: editingClient.id } : {}),
					name: formName,
					description: formDesc,
					redirectUris,
					allowedScopes,
					trusted: formTrusted,
				}),
			});
			const data = await res.json();
			if (res.ok) {
				notify(t(isEdit ? 'oauthAppUpdated' : 'oauthAppCreated'));
				setShowAddModal(false);
				if (!isEdit && data.client && data.plainSecret) {
					setRevealedCreds({
						name: data.client.name,
						clientId: data.client.id,
						clientSecret: data.plainSecret,
					});
				}
				await fetchClients();
			} else {
				notify(data.error || t('saveFailed'), 'error');
			}
		} catch {
			notify(t('serverError'), 'error');
		} finally {
			setFormBusy(false);
		}
	};

	const actions = useOAuthClientActions({
		t,
		notify,
		dialog,
		fetchClients,
		setRevealedCreds,
	});

	return {
		availableScopes,
		clients,
		loading,
		showAddModal,
		setShowAddModal,
		editingClient,
		formName,
		setFormName,
		formDesc,
		setFormDesc,
		formRedirects,
		setFormRedirects,
		formTrusted,
		setFormTrusted,
		formAllowedScopes,
		setFormAllowedScopes,
		formBusy,
		revealedCreds,
		setRevealedCreds,
		copiedField,
		copyToClipboard,
		openCreateModal,
		openEditModal,
		handleFormSubmit,
		...actions,
	};
}
