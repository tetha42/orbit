import { NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
import { getSetupStatus, setupFirstAdmin, reconfigurePgPool } from '@/db';
import { createSetupCache, setupResponse, markSetupLocked } from '@/lib/setup';
import { clientAddress } from '@/lib/http';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { CONFIG } from '@/server/config';
import { resolveDatabaseUrlWithSource } from '@/server/config/provenance';
import {
	BRAND_DEFAULTS,
	enforceSetupAccessGuards,
	parseAndValidateSetupPayload,
	verifySetupTokenGate,
} from './setupGuards';
import {
	acquireSetupAdvisoryLock,
	applyRuntimeConfigIni,
	createAdminSessionResponse,
	persistInitialBrandingAndDefaults,
	persistSetupLockedSetting,
	seedDefaultChatRoom,
} from './setupPersistence';

let cachedSetupStatus = createSetupCache(getSetupStatus, 5000);

export function resetSetupCache(): void {
	cachedSetupStatus = createSetupCache(getSetupStatus, 5000);
}

export async function getCachedSetupStatus() {
	return cachedSetupStatus();
}

export function buildSetupBrandDefaults() {
	return {
		studioName: 'tetha42',
		communityName: CONFIG.clubPreset.name || BRAND_DEFAULTS.communityName,
		domain: CONFIG.clubPreset.domain || BRAND_DEFAULTS.domain,
		archetype: BRAND_DEFAULTS.archetype,
	};
}

export function buildOfflineSetupPayload() {
	return setupResponse(
		{
			ready: false,
			firstRun: true,
			step: 'database',
			reason: 'Could not read database status.',
			dbStatus: { connected: false, configured: false, error: 'Database connection offline' },
			brand: buildSetupBrandDefaults(),
		},
		process.env.NODE_ENV
	);
}

/**
 * Shared setup processor for POST /api/setup and POST /api/setup/complete.
 */
export async function handleSetupSubmission(request: Request) {
	const ip = clientAddress(request);
	const guardError = await enforceSetupAccessGuards(request, ip);
	if (guardError) return guardError;

	let lockClient: PoolClient | null = null;
	let inTransaction = false;

	try {
		const rawBody = await request.json().catch(() => ({}));
		const body = rawBody && typeof rawBody === 'object' ? (rawBody as Record<string, unknown>) : {};

		const tokenError = await verifySetupTokenGate(request, body, ip);
		if (tokenError) return tokenError;

		const parsed = parseAndValidateSetupPayload(body);
		if (!parsed.ok) return parsed.response;
		const payload = parsed.data;

		const currentStatus = await getSetupStatus().catch(() => ({ ready: false }));
		if (currentStatus.ready) {
			markSetupLocked();
			return NextResponse.json(
				{ error: 'Setup is already complete. An administrator account already exists.' },
				{ status: 403 }
			);
		}

		if (payload.dbUrl) {
			const dbSource = resolveDatabaseUrlWithSource();
			if (
				(dbSource.source === 'secret' || dbSource.source === 'env') &&
				dbSource.url &&
				payload.dbUrl !== dbSource.url
			) {
				return NextResponse.json(
					{
						error:
							'DATABASE_URL is pinned via environment or container secret and cannot be overridden via the setup wizard.',
					},
					{ status: 403 }
				);
			}
			const dbResult = await reconfigurePgPool(payload.dbUrl);
			if (!dbResult.ok) {
				return NextResponse.json(
					{ error: `Database connection error: ${dbResult.error}` },
					{ status: 400 }
				);
			}
		}

		const lockState = await acquireSetupAdvisoryLock();
		lockClient = lockState.lockClient;
		inTransaction = lockState.inTransaction;
		if (lockState.alreadyConfiguredResponse) {
			return lockState.alreadyConfiguredResponse;
		}

		applyRuntimeConfigIni(payload);
		const persistError = await persistInitialBrandingAndDefaults(payload);
		if (persistError) return persistError;

		const result = await setupFirstAdmin({
			firstName: payload.firstName,
			lastName: payload.lastName,
			email: payload.email,
			password: payload.password,
		});
		if (!result.ok) {
			void logSystemEvent({
				service: 'security',
				level: 'WARN',
				message: `Setup wizard failed attempt: ${result.error}`,
				detail: { email: String(payload.email).slice(0, 120) },
				ip,
			});
			return NextResponse.json({ error: result.error }, { status: 400 });
		}

		if (lockClient && inTransaction) {
			await lockClient.query('COMMIT').catch(() => {});
			inTransaction = false;
		}

		await persistSetupLockedSetting();
		markSetupLocked();
		await seedDefaultChatRoom();
		resetSetupCache();

		void logSystemEvent({
			service: 'auth',
			level: 'INFO',
			message: `Orbit Community OS setup completed. Administrator: ${payload.email} (${payload.communityName} by ${payload.studioName})`,
			ip,
		});

		return await createAdminSessionResponse(request, payload.email);
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		console.error('[Orbit Setup] Setup completion error:', error);
		return NextResponse.json({ error: `Setup could not be completed: ${msg}` }, { status: 500 });
	} finally {
		if (lockClient) {
			if (inTransaction) {
				await lockClient.query('ROLLBACK').catch(() => {});
			}
			lockClient.release();
		}
	}
}
