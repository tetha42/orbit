import { NextResponse } from 'next/server';
import { getFormFields } from '@/db';
import { authenticate, can } from '@/lib/auth/access';

export const dynamic = 'force-dynamic';

/**
 * Fields the public registration form should render. Core identity fields are
 * fixed in code; these are the community-defined extras.
 */
export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const requested = searchParams.get('scope');
	const scope: 'registration' | 'member' | 'directory' | 'profile' =
		requested === 'directory'
			? 'directory'
			: requested === 'profile'
				? 'profile'
				: requested === 'member'
					? 'member'
					: 'registration';
	try {
		const auth = await authenticate(request).catch(() => ({ authorized: false as const }));
		const isManager = auth.authorized ? can(auth.user, 'members', 'yonet') : false;
		const fields = await getFormFields({ scope, enabledOnly: true, isManager });
		return NextResponse.json(
			{ ok: true, fields },
			{ headers: { 'Cache-Control': 'no-store' } }
		);
	} catch (error) {
		console.error('API /api/form-fields GET error:', error);
		return NextResponse.json(
			{ ok: false, error: 'Form fields could not be loaded.' },
			{ status: 500, headers: { 'Cache-Control': 'no-store' } }
		);
	}
}
