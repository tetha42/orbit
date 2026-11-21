import { signOAuthJwt, type JwtPayload } from '@/lib/auth/jwt';
import type { User } from '@/db/schema';
import type { Permission } from '@/db/roles';

export async function parseTokenRequestBody(request: Request): Promise<{
	rawBody: string;
	bodyParams: Record<string, string>;
}> {
	const contentType = request.headers.get('content-type') || '';
	const rawBody = await request.text();
	let bodyParams: Record<string, string> = {};

	if (contentType.includes('application/json')) {
		try {
			bodyParams = JSON.parse(rawBody);
		} catch {
			bodyParams = {};
		}
	} else {
		const search = new URLSearchParams(rawBody);
		search.forEach((val, key) => {
			bodyParams[key] = val;
		});
	}

	return { rawBody, bodyParams };
}

export function extractClientCredentials(
	request: Request,
	bodyParams: Record<string, string>
): { clientId?: string; clientSecret?: string } {
	let clientId = bodyParams.client_id;
	let clientSecret = bodyParams.client_secret;

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

	return { clientId, clientSecret };
}

export async function mintOAuthTokenResponse(params: {
	request: Request;
	user: User;
	permission: Permission;
	clientId: string;
	scope: string;
}) {
	const { request, user, permission, clientId, scope } = params;
	const host = request.headers.get('host') || 'localhost:3000';
	const proto = request.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
	const issuer = `${proto}://${host}`;
	const now = Math.floor(Date.now() / 1000);
	const expiresIn = 3600;
	const scopes = scope.split(/\s+/);

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

	const idTokenClaims: JwtPayload = {
		iss: issuer,
		sub: user.id,
		aud: clientId,
		exp: now + expiresIn,
		iat: now,
	};

	if (scopes.includes('profile')) {
		const first = user.firstName || user.name || '';
		const last = user.lastName || user.surname || '';
		idTokenClaims.name = `${first} ${last}`.trim();
		idTokenClaims.given_name = first;
		idTokenClaims.family_name = last;
		idTokenClaims.picture = user.avatarUrl || user.profilePhoto || null;
	}

	if (scopes.includes('email')) {
		idTokenClaims.email = user.email;
		idTokenClaims.email_verified = true;
	}

	if (scopes.includes('academic')) {
		idTokenClaims.student_no = user.studentNo || null;
		idTokenClaims.department = user.department || null;
		idTokenClaims.grade = user.grade ?? null;
	}

	if (scopes.includes('roles')) {
		idTokenClaims.role = permission.role?.name || null;
		idTokenClaims.is_admin = permission.admin;
	}

	const idToken = await signOAuthJwt(idTokenClaims);

	return {
		access_token: accessToken,
		token_type: 'Bearer',
		expires_in: expiresIn,
		id_token: idToken,
		scope,
	};
}
