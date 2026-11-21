import { NextResponse } from 'next/server';
import { requireApp, type AccessResult } from '@/lib/auth/access';

/**
 * The terminal is a real shell on the server, running as the same OS user as
 * the portal. Anyone who can open it can read the server's environment and
 * files, so outside development it is opt-in: set TERMINAL_ENABLED=1 to turn it
 * on, or TERMINAL_ENABLED=0 to switch it off in development too.
 */
export function isTerminalEnabled(): boolean {
	const flag = (process.env.TERMINAL_ENABLED || '').trim().toLowerCase();
	if (flag === '0' || flag === 'false') return false;
	if (flag === '1' || flag === 'true') return true;
	return process.env.NODE_ENV === 'development';
}

/**
 * The single gate every terminal route goes through.
 *
 * The role must grant the Terminal app; `requireApp` also applies the
 * active-account check and the role's two-factor rule.
 */
export async function authorizeTerminal(request: Request): Promise<AccessResult> {
	if (!isTerminalEnabled()) {
		return {
			authorized: false,
			response: NextResponse.json(
				{
					error: 'Terminal access is disabled in this environment.',
					code: 'TERMINAL_DISABLED',
				},
				{ status: 403 }
			),
		};
	}
	return requireApp(request, 'terminal', 'use');
}
