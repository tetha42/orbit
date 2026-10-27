import { NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth/access';

/** Reports the caller's own two-factor state, used to drive the settings panel. */
export async function GET(request: Request) {
	const auth = await authenticate(request);
	if (!auth.authorized) return auth.response;

	const { user } = auth;
	const enabled = Number(user.totpEnabled) === 1;
	const required = user.permission.ikiAdimZorunlu;

	return NextResponse.json({
		success: true,
		enabled,
		required,
		// A secret exists but was never confirmed — the setup wizard should resume.
		pendingSetup: !enabled && Boolean(user.totpSecret),
		mustSetup: required && !enabled,
	});
}
