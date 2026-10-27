import { NextResponse } from 'next/server';

/**
 * Standard OpenID Connect Discovery 1.0 Endpoint
 *
 * External applications and auth libraries (NextAuth.js, Passport.js, Auth0 SDK,
 * Lucia, etc.) discover endpoints and supported scopes/claims here automatically.
 */
export async function GET(request: Request) {
	const host = request.headers.get('host') || 'localhost:3000';
	const proto = request.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
	const origin = `${proto}://${host}`;

	const config = {
		issuer: origin,
		authorization_endpoint: `${origin}/oauth/authorize`,
		token_endpoint: `${origin}/api/oauth/token`,
		userinfo_endpoint: `${origin}/api/oauth/userinfo`,
		jwks_uri: `${origin}/api/oauth/jwks`,
		response_types_supported: ['code'],
		subject_types_supported: ['public'],
		id_token_signing_alg_values_supported: ['HS256'],
		scopes_supported: ['openid', 'profile', 'email', 'roles'],
		token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
		claims_supported: [
			'sub',
			'name',
			'given_name',
			'family_name',
			'email',
			'picture',
			'student_no',
			'department',
			'grade',
			'role',
			'permissions',
			'xp',
		],
		code_challenge_methods_supported: ['S256', 'plain'],
	};

	return NextResponse.json(config, {
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Cache-Control': 'public, max-age=3600',
		},
	});
}
