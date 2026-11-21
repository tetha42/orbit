import type { FimScanResult, AppSecSummary } from '../types';
import type { SecurityGuardHealth } from './overviewQueries';

export interface InspectionQueryResult {
	fimResult: FimScanResult | null;
	appSecResult: AppSecSummary | null;
	securityGuard: SecurityGuardHealth | null;
}

export async function fetchInspectionQuery(
	target = 'repo',
	force = false,
	signal?: AbortSignal
): Promise<InspectionQueryResult> {
	const sp = new URLSearchParams();
	sp.set('target', target);
	if (force) sp.set('refresh', 'true');

	const res = await fetch(`/api/soc/inspection?${sp.toString()}`, {
		signal,
		cache: 'no-store',
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(typeof err.error === 'string' ? err.error : `Failed to load inspection data: ${res.status}`);
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
		fimResult: data.fim || null,
		appSecResult: data.appSec || null,
		securityGuard,
	};
}
