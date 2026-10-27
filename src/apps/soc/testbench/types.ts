/** Test-lab tabs hosted inside the SoC Studio (logs live in its SIEM tab). */
export type TestbenchTab = 'oauth' | 'api' | 'fuzzer' | 'health' | 'session';

export interface OAuthSimulateResult {
	success: boolean;
	authUrl?: string;
	codeVerifier?: string;
	codeChallenge?: string;
	code?: string;
	tokenResponse?: {
		access_token: string;
		id_token: string;
		token_type: string;
		expires_in: number;
		scope: string;
		refresh_token?: string;
	};
	decodedIdToken?: Record<string, unknown>;
	userInfoResponse?: Record<string, unknown>;
	error?: string;
	latencyMs?: number;
	timestamp: number;
}

export interface ApiTestItem {
	id: string;
	name: string;
	nameEn?: string;
	endpoint: string;
	appId: string;
	requiredLevel: 'kullan' | 'yonet' | 'admin' | 'public';
	status?: number;
	statusText?: string;
	latencyMs?: number;
	expectedStatus: number;
	pass?: boolean;
	responseSnippet?: string;
}

export interface SystemDiagnostics {
	database: {
		connected: boolean;
		latencyMs: number;
		poolTotal: number;
		poolIdle: number;
		poolWaiting: number;
		counts: {
			users: number;
			roles: number;
			oauthClients: number;
		};
	};
	oauth: {
		active: boolean;
		clientsCount: number;
		consentsCount: number;
		jwksUrl: string;
	};
	events: {
		active: boolean;
		type: string;
	};
	smtp: {
		configured: boolean;
		host?: string;
		port?: string;
		hasPassword: boolean;
	};
	runtime: {
		nodeVersion: string;
		platform: string;
		uptimeSec: number;
		serverTime: number;
		memoryMb: number;
	};
}

export interface UserSessionInfo {
	user: {
		id: string;
		ad: string;
		soyad: string;
		email: string;
		ogrenciNo: string;
		rolAd: string;
		admin: boolean;
		totpEnabled: boolean;
		status: string;
	};
	permissions: Record<string, 'yok' | 'kullan' | 'yonet'>;
}

export interface OAuthClientOption {
	id: string;
	ad: string;
	redirectUris: string[];
	allowedScopes: string[];
	guvenilir: boolean;
}
