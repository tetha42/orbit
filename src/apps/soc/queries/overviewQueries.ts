import type {
	SocOverviewData,
	SecurityBlock,
	ActiveSessionInfo,
	SocIncident,
	SystemLog,
	HistogramBucket,
	IngressDiagnostics,
} from '../types';

export interface SecurityGuardHealth {
	available: boolean;
	uptime?: number;
}

export interface SocOverviewQueryResult {
	overview: SocOverviewData | null;
	securityGuard: SecurityGuardHealth | null;
	bans: SecurityBlock[];
	sessions: ActiveSessionInfo[];
	incidents: SocIncident[];
	siemLogs: SystemLog[];
	siemMeta: {
		totalCount: number;
		page: number;
		limit: number;
		totalPages: number;
		histogram: HistogramBucket[];
	} | null;
	currentUserId: string;
	callerIp: string;
	ingressDiagnostics: IngressDiagnostics | null;
}

export async function fetchSocOverviewData(
	params?: URLSearchParams,
	signal?: AbortSignal
): Promise<SocOverviewQueryResult> {
	const sp = new URLSearchParams(params ? params.toString() : '');
	sp.set('action', 'all');

	const res = await fetch(`/api/soc?${sp.toString()}`, { cache: 'no-store', signal });
	if (!res.ok) {
		const errData = await res.json().catch(() => ({}));
		throw new Error(typeof errData.error === 'string' ? errData.error : `Failed to load SOC overview: ${res.status}`);
	}
	const data = await res.json();
	const rawGuard = data.securityGuard;
	const securityGuard: SecurityGuardHealth | null =
		rawGuard && typeof rawGuard.available === 'boolean'
			? {
					available: rawGuard.available,
					...(typeof rawGuard.uptime === 'number' ? { uptime: rawGuard.uptime } : {}),
				}
			: null;

	return {
		overview: data.overview || null,
		securityGuard,
		bans: Array.isArray(data.bans) ? data.bans : [],
		sessions: Array.isArray(data.sessions) ? data.sessions : [],
		incidents: Array.isArray(data.incidents) ? data.incidents : [],
		siemLogs: Array.isArray(data.siem) ? data.siem : [],
		siemMeta: data.siemMeta || null,
		currentUserId: data.currentUserId || '',
		callerIp: data.callerIp || '',
		ingressDiagnostics: data.ingressDiagnostics || null,
	};
}
