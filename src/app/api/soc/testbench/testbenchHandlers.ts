import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getPgPool } from '@/db';
import { getRolePermission } from '@/db/roles';
import { getOAuthClientById } from '@/db/oauth';
import { readSmtpConfig } from '@/lib/mail/smtpSettings';
import { signOAuthJwt, type JwtPayload } from '@/lib/auth/jwt';
import { PERMISSION_APPS, levelOf } from '@/core/permissions';
import type { AuthorizedUser } from '@/lib/auth/access';

export const NO_CACHE = { 'Cache-Control': 'no-store' };

export async function runHealthDiagnostics(origin: string) {
	const pool = getPgPool();
	let dbLatency = 0;
	let dbConnected = false;
	let counts = { users: 0, roles: 0, oauthClients: 0 };

	try {
		const start = performance.now();
		const res = await pool.query(`
			SELECT
				(SELECT count(*) FROM users) AS users,
				(SELECT count(*) FROM roles) AS roles,
				(SELECT count(*) FROM oauth_clients) AS clients
		`);
		dbLatency = Math.round((performance.now() - start) * 10) / 10;
		dbConnected = true;
		counts = {
			users: Number(res.rows[0]?.users ?? 0),
			roles: Number(res.rows[0]?.roles ?? 0),
			oauthClients: Number(res.rows[0]?.clients ?? 0),
		};
	} catch (err) {
		console.error('Testbench DB check error:', err);
	}

	let smtpConfigured = false;
	let smtpHost = '';
	let smtpPort = '';
	let smtpHasPass = false;
	try {
		const smtp = await readSmtpConfig();
		smtpConfigured = Boolean(smtp.host);
		smtpHost = smtp.host || '';
		smtpPort = String(smtp.port || '');
		smtpHasPass = Boolean(smtp.pass);
	} catch {
		// ignore
	}

	return {
		database: {
			connected: dbConnected,
			latencyMs: dbLatency,
			poolTotal: pool.totalCount,
			poolIdle: pool.idleCount,
			poolWaiting: pool.waitingCount,
			counts,
		},
		oauth: {
			active: true,
			clientsCount: counts.oauthClients,
			consentsCount: 0,
			jwksUrl: `${origin}/api/oauth/jwks`,
		},
		events: {
			active: true,
			type: 'PostgreSQL LISTEN/NOTIFY + SSE',
		},
		smtp: {
			configured: smtpConfigured,
			host: smtpHost,
			port: smtpPort,
			hasPassword: smtpHasPass,
		},
		runtime: {
			nodeVersion: process.version,
			platform: process.platform,
			uptimeSec: Math.floor(process.uptime()),
			serverTime: Date.now(),
			memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
		},
	};
}

export function buildSessionPayload(user: AuthorizedUser) {
	const perms: Record<string, string> = {};
	for (const app of PERMISSION_APPS) {
		perms[app] = levelOf(user.permission.permissions, app);
	}
	return {
		user: {
			id: user.id,
			firstName: user.firstName || user.name,
			lastName: user.lastName || user.surname,
			name: user.firstName || user.name,
			surname: user.lastName || user.surname,
			email: user.email,
			handle: user.handle || user.studentNo,
			studentNo: user.handle || user.studentNo,
			roleName: user.permission.role?.name ?? 'No Role',
			admin: user.permission.admin,
			totpEnabled: Number(user.totpEnabled) === 1,
			status: user.status,
		},
		permissions: perms,
	};
}

export async function runOAuthSimulation(user: AuthorizedUser, body: Record<string, unknown>, origin: string) {
	const start = performance.now();
	const clientId = String(body.clientId || '').trim();
	const client = clientId ? await getOAuthClientById(clientId) : null;
	if (!client) {
		return NextResponse.json({ error: 'Please select a registered OAuth client.' }, { status: 400, headers: NO_CACHE });
	}
	const requestedScopes = String(body.scope || '')
		.split(/\s+/)
		.filter((scope) => scope && client.allowedScopes.includes(scope))
		.join(' ');
	if (!requestedScopes) {
		return NextResponse.json(
			{ error: 'The selected scopes are not allowed for this client.' },
			{ status: 400, headers: NO_CACHE }
		);
	}

	const codeVerifier = crypto.randomBytes(32).toString('base64url');
	const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
	const authParams = new URLSearchParams({
		response_type: 'code',
		client_id: clientId,
		redirect_uri: 'http://localhost:4000/callback',
		scope: requestedScopes,
		state: crypto.randomBytes(12).toString('hex'),
		code_challenge: codeChallenge,
		code_challenge_method: 'S256',
	});
	const authUrl = `${origin}/oauth/authorize?${authParams.toString()}`;

	const now = Math.floor(Date.now() / 1000);
	const scopesList = requestedScopes.split(/\s+/);
	const permission = await getRolePermission(user.roleId);

	const accessToken = await signOAuthJwt({
		iss: origin,
		sub: user.id,
		aud: clientId,
		exp: now + 3600,
		iat: now,
		scope: requestedScopes,
		roles: permission.role ? [permission.role.name] : [],
		admin: Boolean(permission.admin),
	});

	const first = user.firstName || user.name || '';
	const last = user.lastName || user.surname || '';
	const idTokenPayload: Record<string, unknown> = {
		iss: origin,
		sub: user.id,
		aud: clientId,
		exp: now + 3600,
		iat: now,
		auth_time: now,
		nonce: crypto.randomBytes(8).toString('hex'),
	};
	if (scopesList.includes('profile')) {
		idTokenPayload.name = `${first} ${last}`.trim();
		idTokenPayload.given_name = first;
		idTokenPayload.family_name = last;
	}
	if (scopesList.includes('email')) {
		idTokenPayload.email = user.email;
		idTokenPayload.email_verified = true;
	}
	if (scopesList.includes('roles')) {
		idTokenPayload.roles = permission.role ? [permission.role.name] : [];
		idTokenPayload.admin = Boolean(permission.admin);
	}
	if (scopesList.includes('academic')) {
		idTokenPayload.student_no = user.handle || user.studentNo;
		idTokenPayload.department = user.department;
		idTokenPayload.class_year = user.grade;
	}
	const idToken = await signOAuthJwt(idTokenPayload as unknown as JwtPayload);

	const userInfoPayload: Record<string, unknown> = { sub: user.id };
	if (scopesList.includes('profile')) {
		userInfoPayload.name = `${first} ${last}`.trim();
		userInfoPayload.given_name = first;
		userInfoPayload.family_name = last;
		userInfoPayload.picture = user.avatarUrl || user.profilePhoto || null;
		userInfoPayload.bio = user.bio || '';
	}
	if (scopesList.includes('email')) {
		userInfoPayload.email = user.email;
		userInfoPayload.email_verified = true;
	}
	if (scopesList.includes('roles')) {
		userInfoPayload.roles = permission.role ? [permission.role.name] : [];
		userInfoPayload.admin = Boolean(permission.admin);
	}
	if (scopesList.includes('academic')) {
		userInfoPayload.student_no = user.studentNo;
		userInfoPayload.department = user.department;
		userInfoPayload.class_year = user.grade;
	}

	const latencyMs = Math.round((performance.now() - start) * 10) / 10;
	return NextResponse.json(
		{
			success: true,
			authUrl,
			codeVerifier,
			codeChallenge,
			code: `code_${crypto.randomBytes(16).toString('hex')}`,
			tokenResponse: {
				access_token: accessToken,
				id_token: idToken,
				token_type: 'Bearer',
				expires_in: 3600,
				scope: requestedScopes,
				refresh_token: `ref_${crypto.randomBytes(24).toString('hex')}`,
			},
			decodedIdToken: idTokenPayload,
			userInfoResponse: userInfoPayload,
			latencyMs,
			timestamp: Date.now(),
		},
		{ headers: NO_CACHE }
	);
}
