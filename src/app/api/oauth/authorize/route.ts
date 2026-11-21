import { NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth/access';
import { getOAuthClientById, recordUserConsent } from '@/db/oauth';
import { clientAddress } from '@/lib/http';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import {
	buildAuthorizeUserPayload,
	guardAuthorizeRequest,
	intersectScopes,
	isRedirectUriRegistered,
	mintAuthorizeRedirectUrl,
	resolveAllowedScopes,
} from './authorizeHelpers';

export async function GET(request: Request) {
	const ip = clientAddress(request);
	const blocked = await guardAuthorizeRequest(request, ip, undefined, 'GET');
	if (blocked) return blocked;

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
			{ error: 'invalid_request', error_description: 'client_id and redirect_uri parameters are required.' },
			{ status: 400 }
		);
	}

	const client = await getOAuthClientById(clientId);
	if (!client || !client.active) {
		return NextResponse.json(
			{ error: 'unauthorized_client', error_description: 'Invalid or disabled client.' },
			{ status: 400 }
		);
	}

	if (!isRedirectUriRegistered(client.redirectUris, redirectUri)) {
		return NextResponse.json(
			{ error: 'invalid_request', error_description: 'The redirect_uri is not registered for this client.' },
			{ status: 400 }
		);
	}

	if (responseType !== 'code') {
		return NextResponse.json(
			{ error: 'unsupported_response_type', error_description: 'Only response_type=code is supported.' },
			{ status: 400 }
		);
	}

	const auth = await authenticate(request);
	if (!auth.authorized) {
		return NextResponse.json({
			authorized: false,
			requiresLogin: true,
			client: {
				id: client.id,
				name: client.name,
				description: client.description,
				logoUrl: client.logoUrl,
			},
		});
	}

	const user = auth.user;
	const clientAllowedScopes = resolveAllowedScopes(client.allowedScopes);
	const rawRequested = scope.split(/\s+/).filter(Boolean);
	const requestedScopes = rawRequested.length > 0 ? rawRequested : resolveAllowedScopes(null);
	const effectiveScopes = intersectScopes(clientAllowedScopes, requestedScopes);
	const effectiveScopeString = effectiveScopes.join(' ');

	// Untrusted external apps always require explicit user consent; trusted internal apps may skip unless prompt=consent.
	const prompt = url.searchParams.get('prompt') || '';
	if (client.trusted && prompt !== 'consent') {
		const redirectUrl = await mintAuthorizeRedirectUrl({
			clientId: client.id,
			userId: user.id,
			redirectUri,
			scope: effectiveScopeString,
			state,
			codeChallenge,
			codeChallengeMethod,
		});
		return NextResponse.json({ authorized: true, autoApproved: true, redirectUrl });
	}

	return NextResponse.json({
		authorized: true,
		requiresConsent: true,
		user: buildAuthorizeUserPayload(user),
		client: {
			id: client.id,
			name: client.name,
			description: client.description,
			logoUrl: client.logoUrl,
			trusted: client.trusted,
		},
		allowedScopes: clientAllowedScopes,
		requestedScopes,
		effectiveScopes,
		scope: effectiveScopeString,
	});
}

export async function POST(request: Request) {
	const ip = clientAddress(request);
	const rawBody = await request.text().catch(() => '');
	const blocked = await guardAuthorizeRequest(request, ip, rawBody, 'POST');
	if (blocked) return blocked;

	const auth = await authenticate(request);
	if (!auth.authorized) return auth.response;

	try {
		let body: Record<string, unknown> = {};
		try {
			body = JSON.parse(rawBody || '{}');
		} catch {
			return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
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
			return NextResponse.json({ error: 'Missing required parameters.' }, { status: 400 });
		}

		const client = await getOAuthClientById(clientId);
		if (!client || !client.active) {
			return NextResponse.json({ error: 'Invalid client.' }, { status: 400 });
		}

		if (!isRedirectUriRegistered(client.redirectUris, redirectUri)) {
			await logSystemEvent({
				service: 'oauth',
				level: 'ERROR',
				message: `OAuth authorization attempt blocked with unregistered redirect_uri (${client.name})`,
				detail: { clientId, redirectUri },
				userId: auth.user.id,
				ip,
			});
			return NextResponse.json({ error: 'The redirect_uri is not registered for this client.' }, { status: 400 });
		}

		if (!approved) {
			const redirectUrl = new URL(redirectUri);
			redirectUrl.searchParams.set('error', 'access_denied');
			redirectUrl.searchParams.set('error_description', 'User denied the access request.');
			if (state) redirectUrl.searchParams.set('state', state);
			return NextResponse.json({ redirectUrl: redirectUrl.toString() });
		}

		const clientAllowed = resolveAllowedScopes(client.allowedScopes);
		const requested = Array.isArray(grantedScopes)
			? grantedScopes.map(String)
			: typeof body.scope === 'string'
			? body.scope.split(/\s+/)
			: clientAllowed;
		const approvedScope = intersectScopes(clientAllowed, requested).join(' ');

		await recordUserConsent(auth.user.id, clientId, approvedScope);
		const redirectUrl = await mintAuthorizeRedirectUrl({
			clientId,
			userId: auth.user.id,
			redirectUri,
			scope: approvedScope,
			state,
			codeChallenge,
			codeChallengeMethod,
		});

		await logSystemEvent({
			service: 'oauth',
			level: 'INFO',
			message: `OAuth access consent granted: ${client.name}`,
			detail: { clientId: client.id, scope: approvedScope },
			userId: auth.user.id,
			ip,
		});

		return NextResponse.json({ redirectUrl });
	} catch (error) {
		console.error('API /api/oauth/authorize POST error:', error);
		return NextResponse.json({ error: 'Authorization request could not be completed.' }, { status: 500 });
	}
}
