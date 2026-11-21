import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { can, requireApp } from '@/lib/auth/access';
import { getOAuthClients } from '@/db/oauth';
import { verifyOAuthJwt } from '@/lib/auth/jwt';
import { buildSessionPayload, NO_CACHE, runHealthDiagnostics, runOAuthSimulation } from './testbenchHandlers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
	const auth = await requireApp(request, 'soc', 'use');
	if (!auth.authorized) return auth.response;

	const { searchParams } = new URL(request.url);
	const action = searchParams.get('action') || 'health';

	if ((action === 'health' || action === 'clients') && !can(auth.user, 'soc', 'manage')) {
		return NextResponse.json(
			{ error: 'SoC management permission is required to view this data.' },
			{ status: 403, headers: NO_CACHE }
		);
	}

	if (action === 'health') {
		const payload = await runHealthDiagnostics(new URL(request.url).origin);
		return NextResponse.json(payload, { headers: NO_CACHE });
	}

	if (action === 'session') {
		return NextResponse.json(buildSessionPayload(auth.user), { headers: NO_CACHE });
	}

	if (action === 'clients') {
		try {
			const clients = await getOAuthClients();
			return NextResponse.json(
				clients.map((c) => ({
					id: c.id,
					name: c.name,
					redirectUris: c.redirectUris,
					allowedScopes: c.allowedScopes,
					trusted: c.trusted,
				})),
				{ headers: NO_CACHE }
			);
		} catch {
			return NextResponse.json([], { headers: NO_CACHE });
		}
	}

	return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}

async function handlePOST(request: Request) {
	const auth = await requireApp(request, 'soc', 'manage');
	if (!auth.authorized) return auth.response;

	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	const action = body.action;

	if (action === 'oauth_simulate') {
		if (!auth.user.permission.admin) {
			return NextResponse.json(
				{ error: 'OAuth simulation can only be executed by system administrators.' },
				{ status: 403, headers: NO_CACHE }
			);
		}
		return runOAuthSimulation(auth.user, body, new URL(request.url).origin);
	}

	if (action === 'token_inspect') {
		const rawToken = String(body.token || '').trim();
		if (!rawToken) {
			return NextResponse.json({ error: 'Token text cannot be empty.' }, { status: 400 });
		}

		const result = await verifyOAuthJwt(rawToken);
		if ('error' in result) {
			return NextResponse.json({ valid: false, payload: null, error: result.error }, { headers: NO_CACHE });
		}
		return NextResponse.json({ valid: true, payload: result.payload, error: null }, { headers: NO_CACHE });
	}

	return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
}

export const POST = withAudit(handlePOST, { action: 'soc.testbench.create', target: 'soc.testbench' });
