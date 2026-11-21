import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Lightweight, zero-database liveness probe for Docker container health checks.
 * Returns HTTP 200 in <2ms without touching PostgreSQL or storage.
 */
export async function GET() {
	return NextResponse.json(
		{
			status: 'ok',
			uptime: process.uptime(),
			timestamp: Date.now(),
		},
		{ status: 200 }
	);
}
