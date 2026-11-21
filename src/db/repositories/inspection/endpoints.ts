export interface AuditEndpointDef {
	endpoint: string;
	category: 'auth' | 'public' | 'data' | 'terminal' | 'soc' | 'core';
	isPublic: boolean;
	method?: 'GET' | 'POST';
	expectHoneypot?: boolean;
	expectedUnauthStatus?: number | number[];
}

export const AUDIT_ENDPOINTS: AuditEndpointDef[] = [
	{ endpoint: '/api/auth/me', category: 'auth', isPublic: false, method: 'GET' },
	{ endpoint: '/api/auth/login', category: 'auth', isPublic: true, method: 'POST' },
	{ endpoint: '/api/auth/register', category: 'auth', isPublic: true, method: 'POST' },
	{ endpoint: '/api/auth/logout', category: 'auth', isPublic: false, method: 'POST', expectedUnauthStatus: [200, 400, 401] },
	{ endpoint: '/api/auth/verify-password', category: 'auth', isPublic: false, method: 'POST' },
	{ endpoint: '/api/auth/reset-password', category: 'auth', isPublic: true, method: 'POST' },
	{ endpoint: '/api/auth/2fa/challenge', category: 'auth', isPublic: true, method: 'POST' },
	{ endpoint: '/api/auth/2fa/status', category: 'auth', isPublic: false, method: 'GET' },
	{ endpoint: '/api/auth/2fa/setup', category: 'auth', isPublic: false, method: 'POST' },
	{ endpoint: '/api/auth/2fa/enable', category: 'auth', isPublic: false, method: 'POST' },
	{ endpoint: '/api/auth/2fa/disable', category: 'auth', isPublic: false, method: 'POST' },
	{ endpoint: '/api/auth/passkey', category: 'auth', isPublic: false, method: 'GET' },
	{ endpoint: '/api/auth/passkey/login/options', category: 'auth', isPublic: true, method: 'POST' },
	{ endpoint: '/api/auth/passkey/login/verify', category: 'auth', isPublic: true, method: 'POST' },
	{ endpoint: '/api/auth/passkey/register/options', category: 'auth', isPublic: false, method: 'POST' },
	{ endpoint: '/api/auth/passkey/register/verify', category: 'auth', isPublic: false, method: 'POST' },
	{ endpoint: '/api/profile', category: 'auth', isPublic: false, method: 'GET' },
	{ endpoint: '/api/public/v1/news', category: 'public', isPublic: true, method: 'GET' },
	{ endpoint: '/api/public/v1/events', category: 'public', isPublic: true, method: 'GET' },
	{ endpoint: '/api/news', category: 'public', isPublic: true, method: 'GET' },
	{ endpoint: '/api/certificates', category: 'public', isPublic: true, method: 'GET' },
	{ endpoint: '/api/oauth/jwks', category: 'public', isPublic: true, method: 'GET' },
	{ endpoint: '/.well-known/openid-configuration', category: 'public', isPublic: true, method: 'GET' },
	{ endpoint: '/api/setup', category: 'core', isPublic: true, method: 'GET' },
	{ endpoint: '/api/admin/config', category: 'core', isPublic: false, expectHoneypot: true, method: 'GET' },
	{ endpoint: '/api/notifications', category: 'core', isPublic: false, method: 'GET' },
	{ endpoint: '/api/search', category: 'core', isPublic: false, method: 'GET' },
	{ endpoint: '/api/community', category: 'core', isPublic: false, method: 'GET' },
	{ endpoint: '/api/database/tables', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/database/query', category: 'data', isPublic: false, method: 'POST' },
	{ endpoint: '/api/database/mutate', category: 'data', isPublic: false, method: 'POST' },
	{ endpoint: '/api/members', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/roles', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/budget', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/inventory', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/events', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/projects', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/decisions', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/notes', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/chat/rooms', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/chat/messages', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/mail', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/messages', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/teams', category: 'data', isPublic: false, method: 'GET' },
	{ endpoint: '/api/terminal/session', category: 'terminal', isPublic: false, method: 'POST' },
	{ endpoint: '/api/soc', category: 'soc', isPublic: false, method: 'GET' },
	{ endpoint: '/api/soc/inspection', category: 'soc', isPublic: false, method: 'GET' },
	{ endpoint: '/api/audit', category: 'soc', isPublic: false, method: 'GET' },
];
