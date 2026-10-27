import { NextResponse } from 'next/server';
import { getUserById } from '@/db';
import { getRolePermission } from '@/db/roles';
import { consumeAuthCode, verifyClientCredentials } from '@/db/oauth';
import { signOAuthJwt, type JwtPayload } from '@/lib/auth/jwt';
import { clearRateLimit, isRateLimited, recordFailure } from '@/lib/rateLimit';
import { clientAddress } from '@/lib/http';
import { logSystemEvent } from '@/server/db/domains/logs.repo';
import { isIpBanned, recordSecurityStrike } from '@/server/db/domains/security.repo';
import { inspectRequestPayload } from '@/lib/waf';

const MAX_CLIENT_FAILURES = 10;
const MAX_IP_FAILURES = 30;
const WINDOW_MS = 15 * 60_000;

export async function POST(request: Request) {
	const ip = clientAddress(request);

	const ban = await isIpBanned(ip);
	if (ban.banned) {
		void recordSecurityStrike({
			ip,
			points: 10,
			reason: 'Karantinadaki IP OAuth token denemesi',
			path: '/api/oauth/token',
		});
		return NextResponse.json(
			{ error: 'access_denied', error_description: 'IP adresiniz siber güvenlik politikası nedeniyle karantinaya alınmıştır.' },
			{ status: 403 }
		);
	}

	const waf = inspectRequestPayload(request);
	if (waf.matched) {
		void logSystemEvent({
			servis: 'security',
			seviye: 'ERROR',
			mesaj: `[WAF] OAuth token saldırı imzası engellendi (${waf.signature}): POST /api/oauth/token`,
			detay: { category: waf.category, signature: waf.signature },
			ip,
		});
		void recordSecurityStrike({
			ip,
			points: waf.points,
			reason: `WAF: ${waf.signature}`,
			path: '/api/oauth/token',
		});
		return NextResponse.json(
			{ error: 'access_denied', error_description: 'Güvenlik duvarı (WAF) tarafından şüpheli istek engellendi.' },
			{ status: 403 }
		);
	}

	const ipKey = `oauth:token:ip:${ip}`;
	const ipGate = isRateLimited(ipKey, MAX_IP_FAILURES);
	if (!ipGate.allowed) {
		return NextResponse.json(
			{ error: 'temporarily_unavailable', error_description: 'Çok fazla hatalı istek. Lütfen daha sonra tekrar deneyin.' },
			{ status: 429, headers: { 'Retry-After': String(ipGate.retryAfter) } }
		);
	}

	try {
		const contentType = request.headers.get('content-type') || '';
		let bodyParams: Record<string, string> = {};

		let rawBody = '';
		if (contentType.includes('application/x-www-form-urlencoded')) {
			rawBody = await request.text();
			const search = new URLSearchParams(rawBody);
			search.forEach((val, key) => {
				bodyParams[key] = val;
			});
		} else if (contentType.includes('application/json')) {
			rawBody = await request.text();
			try {
				bodyParams = JSON.parse(rawBody);
			} catch {
				bodyParams = {};
			}
		} else {
			// Fallback: try parsing as search params
			rawBody = await request.text();
			const search = new URLSearchParams(rawBody);
			search.forEach((val, key) => {
				bodyParams[key] = val;
			});
		}

		if (rawBody) {
			const bodyWaf = inspectRequestPayload(request, rawBody);
			if (bodyWaf.matched) {
				void logSystemEvent({
					servis: 'security',
					seviye: 'ERROR',
					mesaj: `[WAF] OAuth token gövde saldırı imzası engellendi (${bodyWaf.signature}): POST /api/oauth/token`,
					detay: { category: bodyWaf.category, signature: bodyWaf.signature },
					ip,
				});
				void recordSecurityStrike({
					ip,
					points: bodyWaf.points,
					reason: `WAF: ${bodyWaf.signature}`,
					path: '/api/oauth/token',
				});
				return NextResponse.json(
					{ error: 'access_denied', error_description: 'Güvenlik duvarı (WAF) tarafından şüpheli istek engellendi.' },
					{ status: 403 }
				);
			}
		}

		let clientId = bodyParams.client_id;
		let clientSecret = bodyParams.client_secret;

		// Check Authorization: Basic <base64>
		const authHeader = request.headers.get('authorization');
		if (authHeader && authHeader.startsWith('Basic ')) {
			try {
				const creds = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
				const colonIdx = creds.indexOf(':');
				if (colonIdx !== -1) {
					clientId = creds.slice(0, colonIdx);
					clientSecret = creds.slice(colonIdx + 1);
				}
			} catch {
				// Ignore parse error, rely on body
			}
		}

		if (!clientId || !clientSecret) {
			return NextResponse.json(
				{ error: 'invalid_client', error_description: 'client_id ve client_secret parametreleri zorunludur.' },
				{ status: 401 }
			);
		}

		const clientKey = `oauth:token:client:${clientId}`;
		const clientGate = isRateLimited(clientKey, MAX_CLIENT_FAILURES);
		if (!clientGate.allowed) {
			return NextResponse.json(
				{ error: 'temporarily_unavailable', error_description: 'Çok fazla hatalı kimlik doğrulama denemesi.' },
				{ status: 429, headers: { 'Retry-After': String(clientGate.retryAfter) } }
			);
		}

		const client = await verifyClientCredentials(clientId, clientSecret);
		if (!client) {
			recordFailure(clientKey, WINDOW_MS);
			recordFailure(ipKey, WINDOW_MS);
			await logSystemEvent({
				servis: 'oauth',
				seviye: 'WARN',
				mesaj: `OAuth geçersiz istemci kimlik bilgisi denemesi (${clientId})`,
				detay: { clientId },
				ip,
			});
			return NextResponse.json(
				{ error: 'invalid_client', error_description: 'Geçersiz istemci kimlik bilgileri.' },
				{ status: 401 }
			);
		}

		clearRateLimit(clientKey);

		const grantType = bodyParams.grant_type;
		if (grantType !== 'authorization_code') {
			return NextResponse.json(
				{ error: 'unsupported_grant_type', error_description: 'Sadece authorization_code grant_type desteklenmektedir.' },
				{ status: 400 }
			);
		}

		const code = bodyParams.code;
		const redirectUri = bodyParams.redirect_uri;
		const codeVerifier = bodyParams.code_verifier;

		if (!code || !redirectUri) {
			return NextResponse.json(
				{ error: 'invalid_request', error_description: 'code ve redirect_uri parametreleri zorunludur.' },
				{ status: 400 }
			);
		}

		const codeResult = await consumeAuthCode(code, clientId, redirectUri, codeVerifier);
		if (!codeResult.ok || !codeResult.userId) {
			recordFailure(ipKey, WINDOW_MS);
			await logSystemEvent({
				servis: 'oauth',
				seviye: 'WARN',
				mesaj: `OAuth geçersiz yetkilendirme kodu takas denemesi (${client.ad})`,
				detay: { clientId, redirectUri, hata: codeResult.error },
				ip,
			});
			return NextResponse.json(
				{ error: 'invalid_grant', error_description: codeResult.error || 'Geçersiz yetkilendirme kodu.' },
				{ status: 400 }
			);
		}

		const user = await getUserById(codeResult.userId);
		if (!user || user.status !== 'aktif') {
			return NextResponse.json(
				{ error: 'invalid_grant', error_description: 'Kullanıcı hesabı aktif durumda değil.' },
				{ status: 400 }
			);
		}

		const permission = await getRolePermission(user.roleId);
		const host = request.headers.get('host') || 'localhost:3000';
		const proto = request.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
		const issuer = `${proto}://${host}`;

		const now = Math.floor(Date.now() / 1000);
		const expiresIn = 3600; // 1 hour

		const scope = codeResult.scope || 'openid profile email academic roles';
		const scopes = scope.split(/\s+/);

		// Sign Access Token
		const accessToken = await signOAuthJwt({
			iss: issuer,
			sub: user.id,
			aud: clientId,
			exp: now + expiresIn,
			iat: now,
			scope,
			email: user.email,
			user_id: user.id,
		});

		// Sign OIDC ID Token with filtered claims
		const idTokenClaims: JwtPayload = {
			iss: issuer,
			sub: user.id,
			aud: clientId,
			exp: now + expiresIn,
			iat: now,
		};

		if (scopes.includes('profile')) {
			idTokenClaims.name = `${user.ad} ${user.soyad}`.trim();
			idTokenClaims.given_name = user.ad;
			idTokenClaims.family_name = user.soyad;
			idTokenClaims.picture = user.profilFoto || null;
		}

		if (scopes.includes('email')) {
			idTokenClaims.email = user.email;
			idTokenClaims.email_verified = true;
		}

		if (scopes.includes('academic')) {
			idTokenClaims.student_no = user.ogrenciNo || null;
			idTokenClaims.department = user.bolum || null;
			idTokenClaims.grade = user.sinif ?? null;
		}

		if (scopes.includes('roles')) {
			idTokenClaims.role = permission.role?.ad || null;
			idTokenClaims.is_admin = permission.admin;
		}

		const idToken = await signOAuthJwt(idTokenClaims);

		await logSystemEvent({
			servis: 'oauth',
			seviye: 'INFO',
			mesaj: `OAuth jetonu (token) üretildi: ${client.ad} -> ${user.email}`,
			detay: { clientId: client.id, scope },
			userId: user.id,
			ip,
		});

		return NextResponse.json(
			{
				access_token: accessToken,
				token_type: 'Bearer',
				expires_in: expiresIn,
				id_token: idToken,
				scope,
			},
			{
				headers: {
					'Cache-Control': 'no-store',
					Pragma: 'no-cache',
				},
			}
		);
	} catch (error) {
		console.error('API /api/oauth/token error:', error);
		return NextResponse.json(
			{ error: 'server_error', error_description: 'Jeton oluşturma işlemi tamamlanamadı.' },
			{ status: 500 }
		);
	}
}
