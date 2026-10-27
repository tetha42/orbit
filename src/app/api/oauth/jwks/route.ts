import { NextResponse } from 'next/server';

/**
 * Standard JWKS (JSON Web Key Set) Endpoint
 */
export async function GET() {
	return NextResponse.json(
		{
			keys: [
				{
					kty: 'oct',
					use: 'sig',
					alg: 'HS256',
					kid: 'orbit-community-hmac-key-1',
				},
			],
		},
		{
			headers: {
				'Access-Control-Allow-Origin': '*',
				'Cache-Control': 'public, max-age=86400',
			},
		}
	);
}
