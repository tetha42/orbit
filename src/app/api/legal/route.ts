import { NextResponse } from 'next/server';
import { getLegalDocuments } from '@/db';

export const dynamic = 'force-dynamic';

/**
 * Legal documents the public registration form must show. Only enabled
 * documents are returned, and only their display content — never audit fields.
 */
export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const registration = searchParams.get('scope') !== 'all';
	try {
		const documents = await getLegalDocuments({
			enabledOnly: true,
			forRegistration: registration,
		});
		return NextResponse.json(
			{ ok: true, documents },
			{ headers: { 'Cache-Control': 'no-store' } }
		);
	} catch (error) {
		console.error('API /api/legal GET error:', error);
		return NextResponse.json(
			{ ok: false, error: 'Legal documents could not be loaded.' },
			{ status: 500, headers: { 'Cache-Control': 'no-store' } }
		);
	}
}
