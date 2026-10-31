import { NextResponse } from 'next/server';
import { getTeamCategories } from '@/db';

export const dynamic = 'force-dynamic';

/** Public vocabulary used by the Teams app and its create/edit menus. */
export async function GET() {
	try {
		const categories = await getTeamCategories();
		return NextResponse.json(
			{ ok: true, categories },
			{ headers: { 'Cache-Control': 'no-store' } }
		);
	} catch (error) {
		console.error('API /api/team-categories GET error:', error);
		return NextResponse.json(
			{ ok: false, error: 'Team categories could not be loaded.' },
			{ status: 500, headers: { 'Cache-Control': 'no-store' } }
		);
	}
}
