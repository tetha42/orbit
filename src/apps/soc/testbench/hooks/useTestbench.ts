'use client';

import { useState, useCallback, useMemo } from 'react';
import { useJsonResource } from '@/core/data/useJsonResource';
import { sendJson } from '@/core/data/http';
import { useToast } from '@/core/ui/Toast';
import { useI18n } from '@/core/i18n';
import { useSession } from '@/core/session';
import { seviyeOf } from '@/core/permissions';
import { fill } from '@/lib/text';
import type {
	SystemDiagnostics,
	ApiTestItem,
	UserSessionInfo,
	OAuthSimulateResult,
	OAuthClientOption,
} from '../types';

const SUITE_ENDPOINTS: Array<{
	id: string;
	name: string;
	nameEn: string;
	endpoint: string;
	appId: string;
	requiredLevel: 'kullan' | 'yonet' | 'admin' | 'public';
}> = [
	{ id: 'butce', name: 'Bütçe & Kasa', nameEn: 'Budget & Vault', endpoint: '/api/budget', appId: 'budget', requiredLevel: 'kullan' },
	{ id: 'etkinlikler', name: 'Etkinlikler', nameEn: 'Events', endpoint: '/api/events', appId: 'events', requiredLevel: 'kullan' },
	{ id: 'projeler', name: 'Projeler', nameEn: 'Projects', endpoint: '/api/projects', appId: 'projects', requiredLevel: 'kullan' },
	{ id: 'haberler', name: 'Haberler & Duyurular', nameEn: 'News & Announcements', endpoint: '/api/news', appId: 'news', requiredLevel: 'kullan' },
	{ id: 'envanter', name: 'Donanım & Envanter', nameEn: 'Hardware & Inventory', endpoint: '/api/inventory', appId: 'inventory', requiredLevel: 'kullan' },
	{ id: 'uyeler', name: 'Üye Rehberi', nameEn: 'Member Directory', endpoint: '/api/members', appId: 'members', requiredLevel: 'kullan' },
	{ id: 'takimlar', name: 'Takımlar', nameEn: 'Teams', endpoint: '/api/teams', appId: 'teams', requiredLevel: 'kullan' },
	{ id: 'sohbet', name: 'Sohbet Odaları', nameEn: 'Chat Rooms', endpoint: '/api/chat/rooms', appId: 'chat', requiredLevel: 'kullan' },
	{ id: 'roller', name: 'Roller & Yetkiler', nameEn: 'Roles & Permissions', endpoint: '/api/roles', appId: 'settings', requiredLevel: 'admin' },
	{ id: 'denetim', name: 'Denetim Kayıtları', nameEn: 'Audit Logs', endpoint: '/api/audit', appId: 'settings', requiredLevel: 'admin' },
	{ id: 'jwks', name: 'OAuth 2.0 JWKS', nameEn: 'OAuth 2.0 JWKS', endpoint: '/api/oauth/jwks', appId: 'settings', requiredLevel: 'public' },
	{ id: 'oauth_clients', name: 'Entegre Uygulamalar', nameEn: 'Integrated Apps', endpoint: '/api/oauth/clients', appId: 'settings', requiredLevel: 'admin' },
];

/**
 * State for the test-lab tabs of the SoC Studio. The active tab is owned by the
 * SoC app, so this hook only holds data and actions.
 */
export function useTestbench(canManage: boolean) {
	const notify = useToast();
	const { t } = useI18n();
	const { currentUser, isAdmin } = useSession();

	// 1. Health Diagnostics
	const {
		data: health,
		isLoading: isHealthLoading,
		refetch: refetchHealth,
	} = useJsonResource<SystemDiagnostics>(canManage ? '/api/soc/testbench?action=health' : null);

	// 2. Session & Permissions
	const {
		data: sessionInfo,
		isLoading: isSessionLoading,
		refetch: refetchSession,
	} = useJsonResource<UserSessionInfo>('/api/soc/testbench?action=session');

	// 3. OAuth Clients
	const { data: clientsData, refetch: refetchClients } = useJsonResource<OAuthClientOption[]>(
		canManage ? '/api/soc/testbench?action=clients' : null
	);
	const clients = useMemo(() => clientsData ?? [], [clientsData]);

	// 4. API Suite State (Client-Side execution: tests actual browser connectivity & permissions)
	const [apiItems, setApiItems] = useState<ApiTestItem[]>([]);
	const [isRunningSuite, setIsRunningSuite] = useState(false);

	const runApiSuite = useCallback(async () => {
		setIsRunningSuite(true);
		try {
			const admin = Boolean(isAdmin || currentUser?.admin);
			const results: ApiTestItem[] = await Promise.all(
				SUITE_ENDPOINTS.map(async (item) => {
					let expectedStatus = 200;
					const userPerm = seviyeOf(currentUser?.izinler, item.appId);

					if (item.requiredLevel === 'admin') {
						expectedStatus = admin ? 200 : 403;
					} else if (item.requiredLevel === 'kullan') {
						expectedStatus = (admin || userPerm !== 'yok') ? 200 : 403;
					} else if (item.requiredLevel === 'yonet') {
						expectedStatus = (admin || userPerm === 'yonet') ? 200 : 403;
					}

					const start = performance.now();
					let status = 0;
					let statusText = 'Error';
					let snippet = '';

					try {
						const res = await fetch(item.endpoint, { cache: 'no-store' });
						status = res.status;
						statusText = res.statusText || (res.ok ? 'OK' : 'Hata');
						const text = await res.text();
						snippet = text.slice(0, 180);
					} catch (fetchErr) {
						status = 0;
						statusText = fetchErr instanceof Error ? fetchErr.message : 'Ağ Hatası';
					}

					const latencyMs = Math.round((performance.now() - start) * 10) / 10;
					const pass = status === expectedStatus || (status >= 200 && status < 300 && expectedStatus === 200);

					return {
						...item,
						status,
						statusText,
						latencyMs,
						expectedStatus,
						pass,
						responseSnippet: snippet,
					};
				})
			);

			setApiItems(results);
			notify(fill(t('tbNotifySuiteSuccess'), { count: results.length }), 'success');
		} catch (err) {
			notify(err instanceof Error ? err.message : t('tbNotifySuiteFail'), 'error');
		} finally {
			setIsRunningSuite(false);
		}
	}, [currentUser, isAdmin, notify, t]);

	// 5. OAuth Simulator State
	const [userSelectedClientId, setSelectedClientId] = useState<string>('');
	const selectedClientId = userSelectedClientId || clients[0]?.id || '';
	const [selectedScopes, setSelectedScopes] = useState<string[]>([
		'openid',
		'profile',
		'email',
		'roles',
		'academic',
	]);
	const [oauthLoading, setOauthLoading] = useState(false);
	const [oauthResult, setOauthResult] = useState<OAuthSimulateResult | null>(null);

	const toggleScope = (scope: string) => {
		setSelectedScopes((prev) =>
			prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
		);
	};

	const runOAuthSimulation = async () => {
		setOauthLoading(true);
		try {
			const res = await sendJson<OAuthSimulateResult>('/api/soc/testbench', 'POST', {
				action: 'oauth_simulate',
				clientId: selectedClientId || 'client_testbench',
				scope: selectedScopes.join(' '),
			});
			if (!res.ok) {
				notify(res.error || t('tbNotifyOAuthSimFail'), 'error');
				return;
			}
			setOauthResult(res.data);
			notify(t('tbNotifyOAuthSimSuccess'), 'success');
		} catch (err) {
			notify(err instanceof Error ? err.message : t('tbNotifyOAuthSimFail'), 'error');
		} finally {
			setOauthLoading(false);
		}
	};

	// 6. Token Inspector State
	const [tokenInput, setTokenInput] = useState('');
	const [inspectResult, setInspectResult] = useState<{
		valid: boolean;
		payload: Record<string, unknown> | null;
		error: string | null;
	} | null>(null);
	const [isInspecting, setIsInspecting] = useState(false);

	const inspectToken = async (tokenToTest?: string) => {
		const target = (tokenToTest ?? tokenInput).trim();
		if (!target) {
			notify(t('tbNotifyEnterToken'), 'error');
			return;
		}
		setIsInspecting(true);
		try {
			const res = await sendJson<{
				valid: boolean;
				payload: Record<string, unknown> | null;
				error: string | null;
			}>('/api/soc/testbench', 'POST', {
				action: 'token_inspect',
				token: target,
			});
			if (!res.ok) {
				notify(res.error || t('tbNotifyTokenDecodeFail'), 'error');
				return;
			}
			setInspectResult(res.data);
		} catch (err) {
			notify(err instanceof Error ? err.message : t('tbNotifyGeneralError'), 'error');
		} finally {
			setIsInspecting(false);
		}
	};

	return {
		health,
		isHealthLoading,
		refetchHealth,
		sessionInfo,
		isSessionLoading,
		refetchSession,
		clients,
		refetchClients,
		apiItems,
		isRunningSuite,
		runApiSuite,
		selectedClientId,
		setSelectedClientId,
		selectedScopes,
		toggleScope,
		oauthLoading,
		oauthResult,
		runOAuthSimulation,
		tokenInput,
		setTokenInput,
		inspectResult,
		isInspecting,
		inspectToken,
	};
}
