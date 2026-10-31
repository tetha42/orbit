import { NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth/access';
import { createAuthCode, getOAuthClientById, recordUserConsent } from '@/db/oauth';
import { clientAddress } from '@/lib/http';
import { logSystemEvent } from '@/server/db/domains/logs.repo';
import { isIpBanned, recordSecurityStrike } from '@/server/db/domains/security.repo';
import { inspectRequestPayload } from '@/lib/waf';

function isRedirectUriRegistered(registeredUris: string[], targetUri: string): boolean {
	return registeredUris.some((registered) => {
		try {
			const u1 = new URL(registered);
			const u2 = new URL(targetUri);
			return u1.origin === u2.origin && u1.pathname === u2.pathname;
		} catch {
			return registered === targetUri;
		}
	});
}

export async function GET(request: Request) {
	const ip = clientAddress(request);
	const ban = await isIpBanned(ip);
	if (ban.banned) {
		void recordSecurityStrike({
			ip,
			points: 10,
			reason: 'Karantinadaki IP OAuth authorize denemesi',
			path: '/api/oauth/authorize',
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
			mesaj: `[WAF] OAuth authorize saldırı imzası engellendi (${waf.signature})`,
			detay: { category: waf.category, signature: waf.signature },
			ip,
		});
		void recordSecurityStrike({
			ip,
			points: waf.points,
			reason: `WAF: ${waf.signature}`,
			path: '/api/oauth/authorize',
		});
		return NextResponse.json(
			{ error: 'access_denied', error_description: 'Güvenlik duvarı (WAF) tarafından şüpheli istek engellendi.' },
			{ status: 403 }
		);
	}

	const url = new URL(request.url);
	const clientId = url.searchParams.get('client_id');
	const redirectUri = url.searchParams.get('redirect_uri');
	const responseType = url.searchParams.get('response_type') || 'code';
	const scope = url.searchParams.get('scope') || 'openid profile email roles';
	const state = url.searchParams.get('state') || '';
	const codeChallenge = url.searchParams.get('code_challenge') || undefined;
	const codeChallengeMethod = url.searchParams.get('code_challenge_method') || undefined;

	if (!clientId || !redirectUri) {
		return NextResponse.json(
			{ error: 'invalid_request', error_description: 'client_id ve redirect_uri parametreleri zorunludur.' },
			{ status: 400 }
		);
	}

	const client = await getOAuthClientById(clientId);
	if (!client || !client.aktif) {
		return NextResponse.json(
			{ error: 'unauthorized_client', error_description: 'Geçersiz veya devre dışı bırakılmış istemci.' },
			{ status: 400 }
		);
	}

	// Validate redirect_uri matches registered URIs
	if (!isRedirectUriRegistered(client.redirectUris, redirectUri)) {
		return NextResponse.json(
			{ error: 'invalid_request', error_description: 'Yönlendirme URL (redirect_uri) bu istemci için kayıtlı değil.' },
			{ status: 400 }
		);
	}

	if (responseType !== 'code') {
		return NextResponse.json(
			{ error: 'unsupported_response_type', error_description: 'Yalnızca response_type=code desteklenmektedir.' },
			{ status: 400 }
		);
	}

	// Check user session
	const auth = await authenticate(request);
	if (!auth.authorized) {
		return NextResponse.json({
			authorized: false,
			requiresLogin: true,
			client: {
				id: client.id,
				ad: client.ad,
				aciklama: client.aciklama,
				logoUrl: client.logoUrl,
			},
		});
	}

	const user = auth.user;

	// Tier 1 & Tier 2: Intersect client allowed scopes with requested scopes
	const clientAllowedScopes = client.allowedScopes && client.allowedScopes.length > 0
		? client.allowedScopes
		: ['openid', 'profile', 'email', 'academic', 'roles'];

	const rawRequested = scope.split(/\s+/).filter(Boolean);
	const requestedScopes = rawRequested.length > 0 ? rawRequested : ['openid', 'profile', 'email', 'academic', 'roles'];
	const effectiveScopes = requestedScopes.filter((s) => clientAllowedScopes.includes(s));
	if (!effectiveScopes.includes('openid')) {
		effectiveScopes.unshift('openid');
	}
	const effectiveScopeString = effectiveScopes.join(' ');

	// Güvenilmeyen (untrusted) harici uygulamalar her yetkilendirmede kullanıcının açık onayını (consent) almak zorundadır.
	// Yalnızca yönetici tarafından 'Güvenilir' olarak onaylanan dahili uygulamalar onay ekranını atlayabilir.
	// prompt=consent parametresi verilmişse güvenilir uygulamalarda dahi onay ekranı zorunlu tutulur.
	const prompt = url.searchParams.get('prompt') || '';
	const autoApprove = client.guvenilir && prompt !== 'consent';

	if (autoApprove) {
		const code = await createAuthCode({
			clientId: client.id,
			userId: user.id,
			redirectUri,
			scope: effectiveScopeString,
			codeChallenge,
			codeChallengeMethod,
		});

		const redirectUrl = new URL(redirectUri);
		redirectUrl.searchParams.set('code', code);
		if (state) redirectUrl.searchParams.set('state', state);

		return NextResponse.json({
			authorized: true,
			autoApproved: true,
			redirectUrl: redirectUrl.toString(),
		});
	}

	return NextResponse.json({
		authorized: true,
		requiresConsent: true,
		user: {
			id: user.id,
			ad: user.ad,
			soyad: user.soyad,
			adSoyad: `${user.ad} ${user.soyad}`.trim(),
			email: user.email,
			ogrenciNo: user.ogrenciNo,
			bolum: user.bolum,
			sinif: user.sinif,
			profilFoto: user.profilFoto || null,
			bio: user.bio || null,
			rolAd: user.permission?.role?.ad || 'Member',
			xp: user.xp,
		},
		client: {
			id: client.id,
			ad: client.ad,
			aciklama: client.aciklama,
			logoUrl: client.logoUrl,
			guvenilir: client.guvenilir,
		},
		allowedScopes: clientAllowedScopes,
		requestedScopes,
		effectiveScopes,
		scope: effectiveScopeString,
	});
}

export async function POST(request: Request) {
	const ip = clientAddress(request);
	const ban = await isIpBanned(ip);
	if (ban.banned) {
		void recordSecurityStrike({
			ip,
			points: 10,
			reason: 'Karantinadaki IP OAuth authorize POST denemesi',
			path: '/api/oauth/authorize',
		});
		return NextResponse.json(
			{ error: 'access_denied', error_description: 'IP adresiniz siber güvenlik politikası nedeniyle karantinaya alınmıştır.' },
			{ status: 403 }
		);
	}

	const rawBody = await request.text().catch(() => '');
	const waf = inspectRequestPayload(request, rawBody);
	if (waf.matched) {
		void logSystemEvent({
			servis: 'security',
			seviye: 'ERROR',
			mesaj: `[WAF] OAuth authorize POST saldırı imzası engellendi (${waf.signature})`,
			detay: { category: waf.category, signature: waf.signature },
			ip,
		});
		void recordSecurityStrike({
			ip,
			points: waf.points,
			reason: `WAF: ${waf.signature}`,
			path: '/api/oauth/authorize',
		});
		return NextResponse.json(
			{ error: 'access_denied', error_description: 'Güvenlik duvarı (WAF) tarafından şüpheli istek engellendi.' },
			{ status: 403 }
		);
	}

	const auth = await authenticate(request);
	if (!auth.authorized) return auth.response;

	try {
		let body: Record<string, unknown> = {};
		try {
			body = JSON.parse(rawBody || '{}');
		} catch {
			return NextResponse.json({ error: 'Geçersiz JSON verisi.' }, { status: 400 });
		}
		interface AuthorizeBody {
			clientId?: string;
			redirectUri?: string;
			state?: string;
			codeChallenge?: string;
			codeChallengeMethod?: string;
			approved?: boolean;
			grantedScopes?: string[];
		}
		const { clientId, redirectUri, state, codeChallenge, codeChallengeMethod, approved, grantedScopes } = body as AuthorizeBody;

		if (!clientId || !redirectUri || typeof redirectUri !== 'string') {
			return NextResponse.json({ error: 'Eksik parametreler.' }, { status: 400 });
		}

		const client = await getOAuthClientById(clientId);
		if (!client || !client.aktif) {
			return NextResponse.json({ error: 'Geçersiz istemci.' }, { status: 400 });
		}

		// Critical security check: prevent Open Redirect / authorization code theft by verifying redirectUri on POST
		if (!isRedirectUriRegistered(client.redirectUris, redirectUri)) {
			await logSystemEvent({
				servis: 'oauth',
				seviye: 'ERROR',
				mesaj: `Kayıtsız redirect_uri ile OAuth onay denemesi engellendi (${client.ad})`,
				detay: { clientId, redirectUri },
				userId: auth.user.id,
				ip,
			});
			return NextResponse.json(
				{ error: 'Yönlendirme URL (redirect_uri) bu istemci için kayıtlı değil.' },
				{ status: 400 }
			);
		}

		if (!approved) {
			const redirectUrl = new URL(redirectUri);
			redirectUrl.searchParams.set('error', 'access_denied');
			redirectUrl.searchParams.set('error_description', 'Kullanıcı erişim isteğini reddetti.');
			if (state) redirectUrl.searchParams.set('state', state);

			return NextResponse.json({ redirectUrl: redirectUrl.toString() });
		}

		// User approved -> filter granted scopes by client.allowedScopes
		const clientAllowed = client.allowedScopes && client.allowedScopes.length > 0
			? client.allowedScopes
			: ['openid', 'profile', 'email', 'academic', 'roles'];

		let approvedList: string[] = [];
		if (Array.isArray(grantedScopes)) {
			approvedList = grantedScopes.map(String).filter((s) => clientAllowed.includes(s));
		} else if (typeof body.scope === 'string') {
			approvedList = body.scope.split(/\s+/).filter((s: string) => clientAllowed.includes(s));
		} else {
			approvedList = clientAllowed;
		}

		if (!approvedList.includes('openid')) {
			approvedList.unshift('openid');
		}

		const approvedScope = approvedList.join(' ');
		await recordUserConsent(auth.user.id, clientId, approvedScope);

		// Mint code
		const code = await createAuthCode({
			clientId,
			userId: auth.user.id,
			redirectUri,
			scope: approvedScope,
			codeChallenge,
			codeChallengeMethod,
		});

		await logSystemEvent({
			servis: 'oauth',
			seviye: 'INFO',
			mesaj: `OAuth erişim onayı verildi: ${client.ad}`,
			detay: { clientId: client.id, scope: approvedScope },
			userId: auth.user.id,
			ip,
		});

		const redirectUrl = new URL(redirectUri);
		redirectUrl.searchParams.set('code', code);
		if (state) redirectUrl.searchParams.set('state', state);

		return NextResponse.json({ redirectUrl: redirectUrl.toString() });
	} catch (error) {
		console.error('API /api/oauth/authorize POST error:', error);
		return NextResponse.json({ error: 'Yetkilendirme işlemi tamamlanamadı.' }, { status: 500 });
	}
}
