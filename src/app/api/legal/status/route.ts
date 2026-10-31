import { NextResponse } from 'next/server';
import { getMissingLegalAcceptances } from '@/db';
import { verifyAuth } from '@/lib/auth/authGuard';

export const dynamic = 'force-dynamic';

/** Required documents the signed-in member still has to accept. */
export async function GET(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;
	const documents = await getMissingLegalAcceptances(auth.user.id);
	return NextResponse.json(
		{ ok: true, documents },
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}
