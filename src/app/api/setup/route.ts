import { NextResponse } from 'next/server';
import { setupResponse } from '@/lib/setup';
import { clientAddress } from '@/lib/http';
import { isIpBanned } from '@/db/repositories/security.repo';
import {
	buildOfflineSetupPayload,
	buildSetupBrandDefaults,
	getCachedSetupStatus,
	handleSetupSubmission,
} from './setupService';

export const dynamic = 'force-dynamic';

/**
 * `GET /api/setup` — returns setup status, database connectivity, and branding.
 * Non-crashing even if database is offline or unconfigured.
 */
export async function GET(request: Request) {
	try {
		const ip = clientAddress(request);
		try {
			const ban = await isIpBanned(ip);
			if (ban.banned) {
				return NextResponse.json(
					{ error: 'Access denied.' },
					{ status: 403, headers: { 'Cache-Control': 'no-store' } }
				);
			}
		} catch {
			// If database is offline, skip ban check so setup wizard remains accessible
		}

		const status = await getCachedSetupStatus();
		const brand = buildSetupBrandDefaults();

		return NextResponse.json(
			setupResponse({ ...status, brand }, process.env.NODE_ENV),
			{ headers: { 'Cache-Control': 'no-store' } }
		);
	} catch (error) {
		console.error('[Orbit Setup] Setup status check error:', error);
		return NextResponse.json(buildOfflineSetupPayload(), {
			headers: { 'Cache-Control': 'no-store' },
		});
	}
}

/**
 * `POST /api/setup` — first-run admin setup wizard endpoint.
 * Note: first-run setup writes security/auth system events inside `handleSetupSubmission`
 * rather than wrapping via `withAudit`, because database connectivity and admin actors
 * may not yet exist prior to completion.
 */
export async function POST(request: Request) {
	return handleSetupSubmission(request);
}
