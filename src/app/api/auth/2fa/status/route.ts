import { NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth/access';
import { getUserByEmail } from '@/db';

/** Reports the caller's own two-factor state, used to drive the settings panel. */
export async function GET(request: Request) {
	const auth = await authenticate(request);
	if (!auth.authorized) return auth.response;

	const { user } = auth;
	const fresh = await getUserByEmail(user.email);
	const enabled = Number(fresh?.totpEnabled ?? user.totpEnabled) === 1;
	const required = user.permission.ikiAdimZorunlu;

	return NextResponse.json({
		success: true,
		enabled,
		required,
		// A secret exists but was never confirmed — the setup wizard should resume.
		pendingSetup: !enabled && Boolean(fresh?.totpSecret ?? user.totpSecret),
		mustSetup: required && !enabled,
	});
}
