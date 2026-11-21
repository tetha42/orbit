import { useCallback } from 'react';
import type { OAuthClient } from '@/db/oauth';
import type { Notify } from '@/core/ui/Toast';
import type { DialogApi } from '@/components/Common/DialogProvider';
import { fill } from '@/lib/text';
import type { RevealedOAuthCreds } from './oauthClientTypes';

interface UseOAuthClientActionsParams {
	t: (key: string, fallback?: string) => string;
	notify: Notify;
	dialog: DialogApi;
	fetchClients: () => Promise<void>;
	setRevealedCreds: (creds: RevealedOAuthCreds | null) => void;
}

export function useOAuthClientActions({
	t,
	notify,
	dialog,
	fetchClients,
	setRevealedCreds,
}: UseOAuthClientActionsParams) {
	const handleRegenerateSecret = useCallback(
		async (client: OAuthClient) => {
			const confirmed = await dialog.confirm({
				title: t('oauthRegenTitle'),
				message: fill(t('oauthRegenConfirm'), { name: client.name }),
				tone: 'danger',
				confirmLabel: t('oauthRegenAction'),
			});
			if (!confirmed) return;

			try {
				const res = await fetch('/api/oauth/clients', {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id: client.id, action: 'regenerate_secret' }),
				});
				const data = await res.json();
				if (res.ok && data.plainSecret) {
					notify(t('oauthRegenSuccess'));
					setRevealedCreds({
						name: client.name,
						clientId: client.id,
						clientSecret: data.plainSecret,
					});
				} else {
					notify(data.error || t('oauthRegenError'), 'error');
				}
			} catch {
				notify(t('connError'), 'error');
			}
		},
		[dialog, notify, setRevealedCreds, t],
	);

	const handleDelete = useCallback(
		async (client: OAuthClient) => {
			const confirmed = await dialog.confirm({
				title: t('oauthDeleteTitle'),
				message: fill(t('oauthDeleteConfirm'), { name: client.name }),
				tone: 'danger',
				confirmLabel: t('oauthDeleteTitle'),
			});
			if (!confirmed) return;

			try {
				const res = await fetch(`/api/oauth/clients?id=${client.id}`, { method: 'DELETE' });
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
		},
		[dialog, fetchClients, notify, t],
	);

	return {
		handleRegenerateSecret,
		handleDelete,
	};
}
