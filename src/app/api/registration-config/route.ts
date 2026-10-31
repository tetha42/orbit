import { NextResponse } from 'next/server';
import { getRegistrationCoreConfig } from '@/db';

export const dynamic = 'force-dynamic';

/** Public presentation config for the two core registration fields. */
export async function GET() {
	try {
		const config = await getRegistrationCoreConfig();
		return NextResponse.json(
			{ ok: true, config },
			{ headers: { 'Cache-Control': 'no-store' } }
		);
	} catch (error) {
		console.error('API /api/registration-config GET error:', error);
		return NextResponse.json(
			{ ok: false, error: 'Registration configuration could not be loaded.' },
			{ status: 500, headers: { 'Cache-Control': 'no-store' } }
		);
	}
}
