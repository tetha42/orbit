import { NextResponse } from 'next/server';
import { requireApp } from '@/lib/auth/access';
import { clientAddress } from '@/lib/http';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { resetRateLimit } from '@/lib/rateLimit';
import socContract from '@/apps/soc/soc.contract.json';
import { contractErrorResponse } from '@/contracts/helpers';
import { handleSocGetAction } from './socGetHandlers';
import { handleSocFirewallAction } from './socFirewallActions';
import { handleSocSecurityAction } from './socSecurityActions';

export async function GET(request: Request) {
	const auth = await requireApp(request, 'soc', 'use');
	if (!auth.authorized) return auth.response;

	const { searchParams } = new URL(request.url);
	const action = (searchParams.get('action') || 'all').trim();

	try {
		return await handleSocGetAction(request, action, auth.user.id);
	} catch (error) {
		console.error('API GET /api/soc error:', error);
		return NextResponse.json({ error: 'Failed to retrieve SoC security telemetry.' }, { status: 500 });
	}
}

export async function POST(request: Request) {
	const auth = await requireApp(request, 'soc', 'manage');
	if (!auth.authorized) return auth.response;

	const callerIp = clientAddress(request);

	try {
		const rawBody = await request.json().catch(() => ({}));
		const body = rawBody && typeof rawBody === 'object' ? (rawBody as Record<string, unknown>) : {};
		const action = String(body.action || '').trim();

		if (action === 'kill_user_terminals') {
			const userId = String(body.userId || '').trim();
			if (!userId) {
				return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
			}
			const { closeUserTerminalSessions } = await import('@/server/terminalManager');
			const closedCount = closeUserTerminalSessions(userId);
			await logSystemEvent({
				service: 'terminal',
				level: 'WARN',
				message: `[SoC Shell Guard] User #${userId} active PTY terminal shells terminated (${closedCount} shells closed).`,
				detail: { userId, closedCount, actorId: auth.user.id },
				userId: auth.user.id,
				ip: callerIp,
			});
			return NextResponse.json({ ok: true, closedCount });
		}

		if (action === 'clear_rate_limit') {
			const key = String(body.key || '').trim();
			if (!key) {
				return NextResponse.json({ error: 'Rate limit key is required.' }, { status: 400 });
			}

			const cleared = resetRateLimit(key);
			await logSystemEvent({
				service: 'security',
				level: 'INFO',
				message: `[RATE LIMIT RESET] Rate limit key '${key}' reset via SoC.`,
				detail: { key, cleared },
				userId: auth.user.id,
				ip: callerIp,
			});

			return NextResponse.json({ ok: true, cleared });
		}

		const firewallResponse = await handleSocFirewallAction(action, body, auth.user.id, callerIp);
		if (firewallResponse) return firewallResponse;

		const securityResponse = await handleSocSecurityAction(action, body, auth.user, callerIp);
		if (securityResponse) return securityResponse;

		return contractErrorResponse(socContract, 'INVALID_ACTION', 'Unrecognized SoC action.');
	} catch (error) {
		console.error('API POST /api/soc error:', error);
		return NextResponse.json({ error: 'SoC action could not be completed.' }, { status: 500 });
	}
}
