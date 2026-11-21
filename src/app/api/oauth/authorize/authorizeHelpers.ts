import { NextResponse } from 'next/server';
import { createAuthCode } from '@/db/oauth';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { isIpBanned, recordSecurityStrike } from '@/db/repositories/security.repo';
import { inspectRequestPayload } from '@/lib/waf';
import type { AuthorizedUser } from '@/lib/auth/access';

const DEFAULT_OAUTH_SCOPES = ['openid', 'profile', 'email', 'academic', 'roles'];

export function isRedirectUriRegistered(registeredUris: string[], targetUri: string): boolean {
	return registeredUris.some((registered) => {
		try {
			const u1 = new URL(registered);
			const u2 = new URL(targetUri);
			return (
				u1.origin === u2.origin &&
				u1.pathname === u2.pathname &&
				u1.search === u2.search &&
				!u2.hash
			);
		} catch {
			return registered === targetUri;
		}
	});
}

export async function guardAuthorizeRequest(
	request: Request,
	ip: string,
	rawBody: string | undefined,
	methodLabel: 'GET' | 'POST'
): Promise<NextResponse | null> {
	const ban = await isIpBanned(ip);
	if (ban.banned) {
		void recordSecurityStrike({
			ip,
			points: 10,
			reason: `Quarantined IP attempted OAuth authorize ${methodLabel}`,
			path: '/api/oauth/authorize',
		});
		return NextResponse.json(
			{ error: 'access_denied', error_description: 'Your IP address is quarantined due to security policy.' },
			{ status: 403 }
		);
	}

	const waf = inspectRequestPayload(request, rawBody);
	if (waf.matched) {
		void logSystemEvent({
			service: 'security',
			level: 'ERROR',
			message: `[WAF] OAuth authorize ${methodLabel} attack signature blocked (${waf.signature})`,
			detail: { category: waf.category, signature: waf.signature },
			ip,
		});
		void recordSecurityStrike({
			ip,
			points: waf.points,
			reason: `WAF: ${waf.signature}`,
			path: '/api/oauth/authorize',
		});
		return NextResponse.json(
			{ error: 'access_denied', error_description: 'Suspicious request blocked by the Web Application Firewall (WAF).' },
			{ status: 403 }
		);
	}
	return null;
}

export function resolveAllowedScopes(clientAllowedScopes?: string[] | null): string[] {
	return clientAllowedScopes && clientAllowedScopes.length > 0 ? clientAllowedScopes : DEFAULT_OAUTH_SCOPES;
}

export function intersectScopes(allowed: string[], requested: string[]): string[] {
	const effective = requested.filter((s) => allowed.includes(s));
	if (!effective.includes('openid')) {
		effective.unshift('openid');
	}
	return effective;
}

export function buildAuthorizeUserPayload(user: AuthorizedUser) {
	const first = user.firstName || user.name || '';
	const last = user.lastName || user.surname || '';
	const fullName = `${first} ${last}`.trim();
	return {
		id: user.id,
		firstName: user.firstName || user.name,
		lastName: user.lastName || user.surname,
		name: fullName,
		surname: user.lastName || user.surname,
		nameSurname: fullName,
		email: user.email,
		handle: user.handle || user.studentNo,
		studentNo: user.handle || user.studentNo,
		department: user.department,
		grade: user.grade,
		avatarUrl: user.avatarUrl || user.profilePhoto || null,
		profilePhoto: user.avatarUrl || user.profilePhoto || null,
		bio: user.bio || null,
		roleName: user.permission?.role?.name || 'Member',
		xp: user.xp,
	};
}

export async function mintAuthorizeRedirectUrl(params: {
	clientId: string;
	userId: string;
	redirectUri: string;
	scope: string;
	state?: string;
	codeChallenge?: string;
	codeChallengeMethod?: string;
}): Promise<string> {
	const code = await createAuthCode({
		clientId: params.clientId,
		userId: params.userId,
		redirectUri: params.redirectUri,
		scope: params.scope,
		codeChallenge: params.codeChallenge,
		codeChallengeMethod: params.codeChallengeMethod,
	});
	const redirectUrl = new URL(params.redirectUri);
	redirectUrl.searchParams.set('code', code);
	if (params.state) redirectUrl.searchParams.set('state', params.state);
	return redirectUrl.toString();
}
