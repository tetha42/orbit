import { NextResponse } from 'next/server';
import { getUserById } from '@/db';
import { getRolePermission } from '@/db/roles';
import { consumeAuthCode, verifyClientCredentials } from '@/db/oauth';
import { clearRateLimit, isRateLimited, recordFailure } from '@/lib/rateLimit';
import { clientAddress } from '@/lib/http';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { isIpBanned, recordSecurityStrike } from '@/db/repositories/security.repo';
import { inspectRequestPayload } from '@/lib/waf';
import { extractClientCredentials, mintOAuthTokenResponse, parseTokenRequestBody } from './tokenHelpers';

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
			reason: 'Quarantined IP attempted OAuth token exchange',
			path: '/api/oauth/token',
		});
		return NextResponse.json(
			{ error: 'access_denied', error_description: 'Your IP address is quarantined due to security policy.' },
			{ status: 403 }
		);
	}

	const waf = inspectRequestPayload(request);
	if (waf.matched) {
		void logSystemEvent({
			service: 'security',
			level: 'ERROR',
			message: `[WAF] OAuth token attack signature blocked (${waf.signature}): POST /api/oauth/token`,
			detail: { category: waf.category, signature: waf.signature },
			ip,
		});
		void recordSecurityStrike({
			ip,
			points: waf.points,
			reason: `WAF: ${waf.signature}`,
			path: '/api/oauth/token',
		});
		return NextResponse.json(
			{ error: 'access_denied', error_description: 'Suspicious request blocked by the Web Application Firewall (WAF).' },
			{ status: 403 }
		);
	}

	const ipKey = `oauth:token:ip:${ip}`;
	const ipGate = isRateLimited(ipKey, MAX_IP_FAILURES);
	if (!ipGate.allowed) {
		return NextResponse.json(
			{ error: 'temporarily_unavailable', error_description: 'Too many invalid requests. Please try again later.' },
			{ status: 429, headers: { 'Retry-After': String(ipGate.retryAfter) } }
		);
	}

	try {
		const { rawBody, bodyParams } = await parseTokenRequestBody(request);
		if (rawBody) {
			const bodyWaf = inspectRequestPayload(request, rawBody);
			if (bodyWaf.matched) {
				void logSystemEvent({
					service: 'security',
					level: 'ERROR',
					message: `[WAF] OAuth token payload attack signature blocked (${bodyWaf.signature}): POST /api/oauth/token`,
					detail: { category: bodyWaf.category, signature: bodyWaf.signature },
					ip,
				});
				void recordSecurityStrike({
					ip,
					points: bodyWaf.points,
					reason: `WAF: ${bodyWaf.signature}`,
					path: '/api/oauth/token',
				});
				return NextResponse.json(
					{ error: 'access_denied', error_description: 'Suspicious request blocked by the Web Application Firewall (WAF).' },
					{ status: 403 }
				);
			}
		}

		const { clientId, clientSecret } = extractClientCredentials(request, bodyParams);
		if (!clientId || !clientSecret) {
			return NextResponse.json(
				{ error: 'invalid_client', error_description: 'client_id and client_secret parameters are required.' },
				{ status: 401 }
			);
		}

		const clientKey = `oauth:token:client:${clientId}`;
		const clientGate = isRateLimited(clientKey, MAX_CLIENT_FAILURES);
		if (!clientGate.allowed) {
			return NextResponse.json(
				{ error: 'temporarily_unavailable', error_description: 'Too many failed authentication attempts.' },
				{ status: 429, headers: { 'Retry-After': String(clientGate.retryAfter) } }
			);
		}

		const client = await verifyClientCredentials(clientId, clientSecret);
		if (!client) {
			recordFailure(clientKey, WINDOW_MS);
			recordFailure(ipKey, WINDOW_MS);
			await logSystemEvent({
				service: 'oauth',
				level: 'WARN',
				message: `Invalid OAuth client credentials attempt (${clientId})`,
				detail: { clientId },
				ip,
			});
			return NextResponse.json(
				{ error: 'invalid_client', error_description: 'Invalid client credentials.' },
				{ status: 401 }
			);
		}

		clearRateLimit(clientKey);

		if (bodyParams.grant_type !== 'authorization_code') {
			return NextResponse.json(
				{ error: 'unsupported_grant_type', error_description: 'Only grant_type=authorization_code is supported.' },
				{ status: 400 }
			);
		}

		const code = bodyParams.code;
		const redirectUri = bodyParams.redirect_uri;
		const codeVerifier = bodyParams.code_verifier;
		if (!code || !redirectUri) {
			return NextResponse.json(
				{ error: 'invalid_request', error_description: 'code and redirect_uri parameters are required.' },
				{ status: 400 }
			);
		}

		const codeResult = await consumeAuthCode(code, clientId, redirectUri, codeVerifier);
		if (!codeResult.ok || !codeResult.userId) {
			recordFailure(ipKey, WINDOW_MS);
			await logSystemEvent({
				service: 'oauth',
				level: 'WARN',
				message: `Invalid OAuth authorization code exchange attempt (${client.name})`,
				detail: { clientId, redirectUri, error: codeResult.error },
				ip,
			});
			return NextResponse.json(
				{ error: 'invalid_grant', error_description: codeResult.error || 'Invalid authorization code.' },
				{ status: 400 }
			);
		}

		const user = await getUserById(codeResult.userId);
		if (!user || user.status !== 'active') {
			return NextResponse.json(
				{ error: 'invalid_grant', error_description: 'User account is not active.' },
				{ status: 400 }
			);
		}

		const permission = await getRolePermission(user.roleId);
		const scope = codeResult.scope || 'openid profile email academic roles';
		const tokenPayload = await mintOAuthTokenResponse({ request, user, permission, clientId, scope });

		await logSystemEvent({
			service: 'oauth',
			level: 'INFO',
			message: `OAuth token issued: ${client.name} -> ${user.email}`,
			detail: { clientId: client.id, scope },
			userId: user.id,
			ip,
		});

		return NextResponse.json(tokenPayload, {
			headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
		});
	} catch (error) {
		console.error('API /api/oauth/token error:', error);
		return NextResponse.json(
			{ error: 'server_error', error_description: 'Token issuance could not be completed.' },
			{ status: 500 }
		);
	}
}
