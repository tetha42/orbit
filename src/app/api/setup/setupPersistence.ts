import { NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
import { ADMIN_ROLE_ID } from '@/core/permissions';
import { getPgPool } from '@/db';
import { setSystemSetting } from '@/db/repositories/settings.repo';
import { markSetupLocked } from '@/lib/setup';
import { updateConfigIniSync } from '@/server/iniWriter';
import type { ParsedSetupPayload } from './setupGuards';

export {
	createAdminSessionResponse,
	persistInitialBrandingAndDefaults,
	seedDefaultChatRoom,
} from './setupBootstrapAdmin';

export interface SetupLockResult {
	lockClient: PoolClient | null;
	inTransaction: boolean;
	alreadyConfiguredResponse: NextResponse | null;
}

export async function acquireSetupAdvisoryLock(): Promise<SetupLockResult> {
	let lockClient: PoolClient | null = null;
	let inTransaction = false;

	try {
		const checkPool = getPgPool();
		lockClient = await checkPool.connect();
		await lockClient.query('BEGIN');
		inTransaction = true;
		await lockClient.query("SELECT pg_advisory_xact_lock(hashtext('orbit.setup.lock'))");
		const settingsTableRes = await lockClient.query("SELECT to_regclass('public.system_settings') AS tbl");
		if (settingsTableRes.rows[0]?.tbl) {
			const lockedSettingRes = await lockClient.query(
				"SELECT value FROM system_settings WHERE key = 'setup_locked' LIMIT 1"
			);
			if (lockedSettingRes.rows[0]?.value === 'true') {
				await lockClient.query('ROLLBACK').catch(() => {});
				inTransaction = false;
				markSetupLocked();
				return {
					lockClient,
					inTransaction,
					alreadyConfiguredResponse: NextResponse.json(
						{ error: 'Setup is locked and permanently disabled.' },
						{ status: 403 }
					),
				};
			}
		}
		const usersTableRes = await lockClient.query("SELECT to_regclass('public.users') AS tbl");
		if (usersTableRes.rows[0]?.tbl) {
			const adminCountRes = await lockClient.query(
				"SELECT COUNT(*)::int AS n FROM users WHERE role_id IN ($1, 'admin')",
				[ADMIN_ROLE_ID]
			);
			if (Number(adminCountRes.rows[0]?.n || 0) > 0) {
				await lockClient.query('ROLLBACK').catch(() => {});
				inTransaction = false;
				markSetupLocked();
				return {
					lockClient,
					inTransaction,
					alreadyConfiguredResponse: NextResponse.json(
						{ error: 'Setup is already complete. An administrator account already exists.' },
						{ status: 403 }
					),
				};
			}
		}
	} catch (lockErr) {
		if (lockClient && inTransaction) {
			await lockClient.query('ROLLBACK').catch(() => {});
			inTransaction = false;
		}
		console.warn('[Orbit Setup] Advisory lock check failed:', lockErr);
		return {
			lockClient,
			inTransaction,
			alreadyConfiguredResponse: NextResponse.json(
				{ error: 'Could not acquire setup database lock. Please verify PostgreSQL connectivity.' },
				{ status: 503 }
			),
		};
	}

	return { lockClient, inTransaction, alreadyConfiguredResponse: null };
}

export function applyRuntimeConfigIni(payload: ParsedSetupPayload): void {
	const { dbUrl, communityName, studioName, domain, smtpHost, smtpPort, smtpUser, smtpPassword, smtpFrom } = payload;
	try {
		updateConfigIniSync({
			...(dbUrl ? { database: { url: dbUrl } } : {}),
			club_preset: {
				name: communityName,
				university: studioName,
				domain,
			},
			...(smtpHost
				? {
						smtp: {
							host: smtpHost,
							port: smtpPort,
							user: smtpUser,
							password: smtpPassword,
							from: smtpFrom || `${communityName} <noreply@${domain}>`,
						},
					}
				: {}),
		});
	} catch (iniErr) {
		console.warn('[Orbit Setup] Runtime configuration update warning:', iniErr);
	}
}

export async function persistSetupLockedSetting(): Promise<void> {
	try {
		await setSystemSetting('setup_locked', 'true');
	} catch (err) {
		console.warn('[Orbit Setup] setup_locked setting persistence warning:', err);
	}
}
