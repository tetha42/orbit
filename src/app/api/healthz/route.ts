// src/app/api/healthz/route.ts
import { NextResponse } from 'next/server';
import { checkDatabaseStatus } from '@/db';

export async function GET() {
	const status = await checkDatabaseStatus();
	const ok = status.connected && status.configured;
	return NextResponse.json(
		{
			ok,
			status: ok ? 'healthy' : 'unhealthy',
			health: ok ? 'ok' : 'unavailable',
			database: status.connected ? 'connected' : (status.configured ? 'disconnected' : 'not_configured'),
			databaseName: status.databaseName ?? null,
			error: ok ? null : status.error,
		},
		{ status: ok ? 200 : 503 }
	);
}

