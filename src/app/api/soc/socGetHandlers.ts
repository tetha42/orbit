import { NextResponse } from 'next/server';
import { clientAddress } from '@/lib/http';
import {
	getSecurityBlocks,
	getSocOverview,
	getSocDefconSummary,
	getActiveSessions,
	getSocIncidents,
} from '@/db/repositories/security.repo';
import { getSystemLogsPaginated } from '@/db/repositories/logs.repo';
import { getActiveRateLimits } from '@/lib/rateLimit';
import { getProxyAndIngressDiagnostics } from '@/server/security/proxyDiagnostics';
import { checkSecurityGuardHealth } from '@/server/security/securityGuardClient';
import { parseSiemFilter } from './socParsers';

export async function handleSocGetAction(
	request: Request,
	action: string,
	currentUserId: string
): Promise<NextResponse> {
	const { searchParams } = new URL(request.url);

	if (action === 'defcon') {
		const summary = await getSocDefconSummary();
		return NextResponse.json(summary);
	}

	if (action === 'overview') {
		const [overview, securityGuard] = await Promise.all([
			getSocOverview(),
			checkSecurityGuardHealth(),
		]);
		return NextResponse.json({
			overview,
			securityGuard,
			ingressDiagnostics: getProxyAndIngressDiagnostics(request),
		});
	}

	if (action === 'bans') {
		const bans = await getSecurityBlocks();
		return NextResponse.json({ bans });
	}

	if (action === 'sessions') {
		const sessions = await getActiveSessions();
		return NextResponse.json({ sessions, currentUserId });
	}

	if (action === 'rate_limits') {
		const rateLimits = getActiveRateLimits();
		return NextResponse.json({ rateLimits });
	}

	if (action === 'incidents') {
		const incidents = await getSocIncidents();
		return NextResponse.json({ incidents });
	}

	if (action === 'siem') {
		const result = await getSystemLogsPaginated(parseSiemFilter(searchParams));
		return NextResponse.json({
			siem: result.logs,
			totalCount: result.totalCount,
			page: result.page,
			limit: result.limit,
			totalPages: result.totalPages,
			histogram: result.histogram,
		});
	}

	// Default: fetch overview, bans, sessions, incidents, and latest security logs in parallel
	const [overview, bans, sessions, incidents, siemResult, securityGuard] = await Promise.all([
		getSocOverview(),
		getSecurityBlocks(),
		getActiveSessions(),
		getSocIncidents(),
		getSystemLogsPaginated(parseSiemFilter(searchParams)),
		checkSecurityGuardHealth(),
	]);

	return NextResponse.json({
		overview,
		securityGuard,
		bans,
		sessions,
		incidents,
		siem: siemResult.logs,
		siemMeta: {
			totalCount: siemResult.totalCount,
			page: siemResult.page,
			limit: siemResult.limit,
			totalPages: siemResult.totalPages,
			histogram: siemResult.histogram,
		},
		ingressDiagnostics: getProxyAndIngressDiagnostics(request),
		currentUserId,
		callerIp: clientAddress(request),
	});
}
