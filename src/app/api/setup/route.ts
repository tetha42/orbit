import { NextResponse } from 'next/server';
import {
	getLegalDocuments,
	getSetupStatus,
	setupFirstAdmin,
	reconfigurePgPool,
	getPgPool,
	getUserByEmail,
	seedSetupDefaults,
} from '@/db';
import { createSetupCache, setupResponse } from '@/lib/setup';
import { clientAddress } from '@/lib/http';
import { consumeRateLimit } from '@/lib/rateLimit';
import { inspectRequestPayload } from '@/lib/waf';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { isIpBanned, recordSecurityStrike } from '@/db/repositories/security.repo';
import { CONFIG } from '@/server/config';
import { updateConfigIniSync } from '@/server/iniWriter';
import { attachSessionCookie, establishSession, sessionUserOf } from '@/lib/auth/session';
import { setSystemSettings } from '@/db/repositories/settings.repo';
import { buildSmtpUpdates } from '@/lib/mail/smtpSettings';

export const dynamic = 'force-dynamic';

let cachedSetupStatus = createSetupCache(getSetupStatus, 5000);

export function resetSetupCache() {
	cachedSetupStatus = createSetupCache(getSetupStatus, 5000);
}

const BRAND_DEFAULTS = {
	studioName: 'tetha42',
	communityName: 'Orbit Community',
	domain: 'orbit.local',
};

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
				return NextResponse.json({ error: 'Access denied.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
			}
		} catch {
			// If database is offline, skip ban check so setup wizard remains accessible
		}

		const status = await cachedSetupStatus();
		const brand = {
			studioName: 'tetha42',
			communityName: CONFIG.clubPreset.name || BRAND_DEFAULTS.communityName,
			domain: CONFIG.clubPreset.domain || BRAND_DEFAULTS.domain,
		};

		return NextResponse.json(
			setupResponse({ ...status, brand }, process.env.NODE_ENV),
			{ headers: { 'Cache-Control': 'no-store' } }
		);
	} catch (error) {
		console.error('[Orbit Setup] Setup status check error:', error);
		const brand = {
			studioName: 'tetha42',
			communityName: CONFIG.clubPreset.name || BRAND_DEFAULTS.communityName,
			domain: CONFIG.clubPreset.domain || BRAND_DEFAULTS.domain,
		};
		return NextResponse.json(
			setupResponse(
				{
					hazir: false,
					firstRun: true,
					step: 'database',
					sebep: 'Could not read database status.',
					dbStatus: { connected: false, configured: false, error: 'Database connection offline' },
					brand,
				},
				process.env.NODE_ENV
			),
			{ headers: { 'Cache-Control': 'no-store' } }
		);
	}
}

/**
 * Shared setup processor for POST /api/setup and POST /api/setup/complete.
 */
export async function handleSetupSubmission(request: Request) {
	const ip = clientAddress(request);
	try {
		const ban = await isIpBanned(ip);
		if (ban.banned) {
			return NextResponse.json(
				{ error: 'Your IP address has been temporarily quarantined by the cybersecurity policy.' },
				{ status: 403 }
			);
		}
	} catch {
		// Ignore if DB not yet reachable
	}

	const waf = inspectRequestPayload(request);
	if (waf.matched) {
		void logSystemEvent({
			servis: 'security',
			seviye: 'ERROR',
			mesaj: `[WAF] Attack signature blocked (${waf.signature}): POST /api/setup`,
			detay: { category: waf.category, signature: waf.signature },
			ip,
		});
		void recordSecurityStrike({
			ip,
			points: waf.points,
			reason: `WAF: ${waf.signature}`,
			path: '/api/setup',
		});
		return NextResponse.json(
			{ error: 'Suspicious request blocked by Web Application Firewall (WAF).' },
			{ status: 403 }
		);
	}

	const rl = consumeRateLimit(`setup:${ip}`, 10, 15 * 60_000);
	if (!rl.allowed) {
		void logSystemEvent({
			servis: 'security',
			seviye: 'WARN',
			mesaj: 'Setup wizard rate limit exceeded',
			ip,
		});
		return NextResponse.json(
			{ error: 'Too many attempts. Please try again later.' },
			{ status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
		);
	}

	try {
		const body = await request.json().catch(() => ({}));

		// Support nested or flat payload
		const firstName = (body.firstName || body.ad || body.admin?.firstName || body.admin?.ad || '').trim();
		const lastName = (body.lastName || body.soyad || body.admin?.lastName || body.admin?.soyad || '').trim();
		const email = (body.email || body.admin?.email || '').trim().toLowerCase();
		const password = body.password || body.admin?.password;

		const dbUrl = (body.dbUrl || body.databaseUrl || '').trim();
		const communityName = (body.communityName || body.identity?.communityName || 'Orbit Community').trim();
		// The studio is the product maker and is not white-label configurable,
		// not even during first-run setup.
		const studioName = 'tetha42';
		const domain = (body.domain || body.identity?.domain || 'orbit.local').trim();

		const smtp = body.smtp || {};
		const smtpHost = (smtp.host || body.smtpHost || '').trim();
		const smtpPort = Number(smtp.port || body.smtpPort || 465);
		const smtpUser = (smtp.user || body.smtpUser || '').trim();
		const smtpPassword = smtp.password || body.smtpPassword || '';
		const smtpFrom = (smtp.from || body.smtpFrom || '').trim();

		if (!firstName || !lastName || !email || !password) {
			return NextResponse.json({ error: 'Please complete the administrator first name, last name, email, and password.' }, { status: 400 });
		}
		if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
			return NextResponse.json({ error: 'Administrator password must be between 12 and 128 characters.' }, { status: 400 });
		}

		// 1. Reconfigure database if a custom dbUrl is provided
		if (dbUrl) {
			const dbResult = await reconfigurePgPool(dbUrl);
			if (!dbResult.ok) {
				return NextResponse.json({ error: `Database connection error: ${dbResult.error}` }, { status: 400 });
			}
		}

		// 2. Apply configurations to in-memory runtime
		try {
			updateConfigIniSync({
				...(dbUrl ? { database: { url: dbUrl } } : {}),
				club_preset: {
					name: communityName,
					university: studioName,
					domain: domain,
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

		// 3. Persist the community identity and the newly editable defaults before
		// creating the administrator. If this fails the setup marker is not written,
		// so the wizard can safely be run again instead of reporting a half-seeded
		// installation as complete.
		try {
			const dbSettings: Record<string, string> = {
				kulup_adi: communityName,
				kulup_domain: domain,
				universite: studioName,
			};
			if (smtpHost) {
				const smtpUpdates = await buildSmtpUpdates({
					host: smtpHost,
					port: smtpPort,
					user: smtpUser,
					pass: smtpPassword,
					from: smtpFrom || `${communityName} <noreply@${domain}>`,
				});
				Object.assign(dbSettings, smtpUpdates);
			}
			await setSystemSettings(dbSettings);
			// Materialise the factory defaults for the editable settings so the
			// database describes the same state the UI reads through its fallbacks.
			await seedSetupDefaults(communityName);
			// Seed the three bundled legal documents once; later calls are no-ops.
			await getLegalDocuments();
		} catch (dbSetErr) {
			console.error('[Orbit Setup] Branding/defaults could not be persisted:', dbSetErr);
			return NextResponse.json(
				{ error: 'Setup could not save the initial branding to the database. Please try again.' },
				{ status: 503 }
			);
		}

		// 4. Create the initial administrator
		const result = await setupFirstAdmin({ ad: firstName, soyad: lastName, email, password });
		if (!result.ok) {
			void logSystemEvent({
				servis: 'security',
				seviye: 'WARN',
				mesaj: `Setup wizard failed attempt: ${result.error}`,
				detay: { email: String(email).slice(0, 120) },
				ip,
			});
			return NextResponse.json({ error: result.error }, { status: 400 });
		}

		// 5. Seed default Orbit chat room
		try {
			await getPgPool().query(
				`INSERT INTO chat_rooms (id, tur, teamId, ad, olusturma)
				 VALUES ('oda_genel', 'genel', NULL, 'Orbit General Chat', $1)
				 ON CONFLICT (id) DO UPDATE SET ad = 'Orbit General Chat'`,
				[Date.now()]
			);
		} catch (chatErr) {
			console.warn('[Orbit Setup] Chat room seed warning:', chatErr);
		}

		// Reset setup cache
		resetSetupCache();

		void logSystemEvent({
			servis: 'auth',
			seviye: 'INFO',
			mesaj: `Orbit Community OS setup completed. Administrator: ${email} (${communityName} by ${studioName})`,
			ip,
		});

		// 6. Establish immediate authenticated session
		const adminUser = await getUserByEmail(email);
		let sessionToken: string | null = null;
		let sessionUser = null;
		if (adminUser) {
			sessionToken = await establishSession(adminUser, request, 'password');
			sessionUser = await sessionUserOf(adminUser);
		}

		const response = NextResponse.json({
			success: true,
			message: 'Orbit Community OS setup completed successfully.',
			user: sessionUser,
		});

		if (sessionToken) {
			attachSessionCookie(response, sessionToken);
			// Also set oturum_token for explicit compatibility
			response.cookies.set('oturum_token', sessionToken, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: process.env.NODE_ENV === 'production',
				maxAge: 7 * 24 * 60 * 60,
			});
		}

		return response;
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		console.error('[Orbit Setup] Setup completion error:', error);
		return NextResponse.json({ error: `Setup could not be completed: ${msg}` }, { status: 500 });
	}
}

/**
 * `POST /api/setup` — first-run admin setup wizard endpoint.
 */
export async function POST(request: Request) {
	return handleSetupSubmission(request);
}
