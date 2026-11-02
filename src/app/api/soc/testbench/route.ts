import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { can, requireApp } from '@/lib/auth/access';
import { getPgPool } from '@/db';
import { getRolePermission } from '@/db/roles';
import { getOAuthClientById, getOAuthClients } from '@/db/oauth';
import { readSmtpConfig } from '@/lib/mail/smtpSettings';
import { signOAuthJwt, verifyOAuthJwt, type JwtPayload } from '@/lib/auth/jwt';
import { PERMISSION_APPS, seviyeOf } from '@/core/permissions';

export const dynamic = 'force-dynamic';

const NO_CACHE = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
	const auth = await requireApp(request, 'soc', 'kullan');
	if (!auth.authorized) return auth.response;

	const { searchParams } = new URL(request.url);
	const action = searchParams.get('action') || 'health';

	// Health exposes SMTP host and database internals, and the client list exposes
	// redirect URIs of integrated apps: both are for SoC managers only.
	if ((action === 'health' || action === 'clients') && !can(auth.user, 'soc', 'yonet')) {
		return NextResponse.json(
			{ error: 'Bu veriyi görüntülemek için SoC yönetim yetkisi gereklidir.' },
			{ status: 403, headers: NO_CACHE }
		);
	}

	// 1. Health Diagnostics
	if (action === 'health') {
		const pool = getPgPool();
		let dbLatency = 0;
		let dbConnected = false;
		let counts = { users: 0, roles: 0, oauthClients: 0 };

		try {
			const start = performance.now();
			const res = await pool.query(`
				SELECT 
					(SELECT count(*) FROM users) as users,
					(SELECT count(*) FROM roles) as roles,
					(SELECT count(*) FROM oauth_clients) as clients
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

		// SMTP Config
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

		const origin = new URL(request.url).origin;

		return NextResponse.json(
			{
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
			},
			{ headers: NO_CACHE }
		);
	}

	// 2. Active Session Inspector
	if (action === 'session') {
		const user = auth.user;
		const perms: Record<string, string> = {};
		for (const app of PERMISSION_APPS) {
			perms[app] = seviyeOf(user.permission.izinler, app);
		}

		return NextResponse.json(
			{
				user: {
					id: user.id,
					ad: user.ad,
					soyad: user.soyad,
					email: user.email,
					ogrenciNo: user.ogrenciNo,
					rolAd: user.permission.role?.ad ?? 'Role Yok',
					admin: user.permission.admin,
					totpEnabled: Number(user.totpEnabled) === 1,
					status: user.status,
				},
				permissions: perms,
			},
			{ headers: NO_CACHE }
		);
	}

	// 3. Registered OAuth Clients for Simulator dropdown
	if (action === 'clients') {
		try {
			const clients = await getOAuthClients();
			return NextResponse.json(
				clients.map((c) => ({
					id: c.id,
					ad: c.ad,
					redirectUris: c.redirectUris,
					allowedScopes: c.allowedScopes,
					guvenilir: c.guvenilir,
				})),
				{ headers: NO_CACHE }
			);
		} catch {
			return NextResponse.json([], { headers: NO_CACHE });
		}
	}

	return NextResponse.json({ error: 'Bilinmeyen işlem.' }, { status: 400 });
}

async function handlePOST(request: Request) {
	const auth = await requireApp(request, 'soc', 'yonet');
	if (!auth.authorized) return auth.response;

	const body = await request.json().catch(() => ({}));
	const action = body.action;

	// 1. Interactive OAuth Simulator
	if (action === 'oauth_simulate') {
		// Signs real access and ID tokens, so it is limited to system administrators.
		if (!auth.user.permission.admin) {
			return NextResponse.json(
				{ error: 'OAuth simülasyonu yalnızca sistem yöneticileri tarafından çalıştırılabilir.' },
				{ status: 403, headers: NO_CACHE }
			);
		}

		const start = performance.now();
		const clientId = String(body.clientId || '').trim();
		const client = clientId ? await getOAuthClientById(clientId) : null;
		if (!client) {
			return NextResponse.json({ error: 'Kayıtlı bir OAuth istemcisi seçin.' }, { status: 400, headers: NO_CACHE });
		}
		const requestedScopes = String(body.scope || '')
			.split(/\s+/)
			.filter((scope) => scope && client.allowedScopes.includes(scope))
			.join(' ');
		if (!requestedScopes) {
			return NextResponse.json(
				{ error: 'Seçilen kapsamlar bu istemci için izinli değil.' },
				{ status: 400, headers: NO_CACHE }
			);
		}
		const origin = new URL(request.url).origin;

		// 1. Generate PKCE parameters
		const codeVerifier = crypto.randomBytes(32).toString('base64url');
		const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

		// 2. Authorize URL
		const authUrl = `${origin}/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent('http://localhost:4000/callback')}&scope=${encodeURIComponent(requestedScopes)}&state=${crypto.randomBytes(12).toString('hex')}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

		// 3. Issue Token for Current User
		const user = auth.user;
		const now = Math.floor(Date.now() / 1000);
		const scopesList = requestedScopes.split(/\s+/);
		const permission = await getRolePermission(user.roleId);

		const accessTokenPayload = {
			iss: origin,
			sub: user.id,
			aud: clientId,
			exp: now + 3600,
			iat: now,
			scope: requestedScopes,
			roles: permission.role ? [permission.role.ad] : [],
			admin: Boolean(permission.admin),
		};
		const accessToken = await signOAuthJwt(accessTokenPayload);

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
			idTokenPayload.name = `${user.ad} ${user.soyad}`.trim();
			idTokenPayload.given_name = user.ad;
			idTokenPayload.family_name = user.soyad;
		}
		if (scopesList.includes('email')) {
			idTokenPayload.email = user.email;
			idTokenPayload.email_verified = true;
		}
		if (scopesList.includes('roles')) {
			idTokenPayload.roles = permission.role ? [permission.role.ad] : [];
			idTokenPayload.admin = Boolean(permission.admin);
		}
		if (scopesList.includes('academic')) {
			idTokenPayload.student_no = user.ogrenciNo;
			idTokenPayload.department = user.bolum;
			idTokenPayload.class_year = user.sinif;
		}

		const idToken = await signOAuthJwt(idTokenPayload as unknown as JwtPayload);

		// 4. Fetch UserInfo internally with this access token
		const userInfoPayload: Record<string, unknown> = {
			sub: user.id,
		};
		if (scopesList.includes('profile')) {
			userInfoPayload.name = `${user.ad} ${user.soyad}`.trim();
			userInfoPayload.given_name = user.ad;
			userInfoPayload.family_name = user.soyad;
			userInfoPayload.picture = user.profilFoto || null;
			userInfoPayload.bio = user.bio || '';
		}
		if (scopesList.includes('email')) {
			userInfoPayload.email = user.email;
			userInfoPayload.email_verified = true;
		}
		if (scopesList.includes('roles')) {
			userInfoPayload.roles = permission.role ? [permission.role.ad] : [];
			userInfoPayload.admin = Boolean(permission.admin);
		}
		if (scopesList.includes('academic')) {
			userInfoPayload.student_no = user.ogrenciNo;
			userInfoPayload.department = user.bolum;
			userInfoPayload.class_year = user.sinif;
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

	// 2. Token Inspector / Decoder
	if (action === 'token_inspect') {
		const rawToken = String(body.token || '').trim();
		if (!rawToken) {
			return NextResponse.json({ error: 'Token metni boş olamaz.' }, { status: 400 });
		}

		const result = await verifyOAuthJwt(rawToken);
		if ('error' in result) {
			return NextResponse.json(
				{
					valid: false,
					payload: null,
					error: result.error,
				},
				{ headers: NO_CACHE }
			);
		}
		return NextResponse.json(
			{
				valid: true,
				payload: result.payload,
				error: null,
			},
			{ headers: NO_CACHE }
		);
	}

	return NextResponse.json({ error: 'Geçersiz aksiyon.' }, { status: 400 });
}

export const POST = withAudit(handlePOST, { action: 'soc.testbench.create', target: 'soc.testbench' });
