import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { getCommunityProfile, setSystemSettings } from '@/db';
import { verifyAuth } from '@/lib/auth/authGuard';
import { authenticateEnrolled, can } from '@/lib/auth/access';
import { getCached, setCached, invalidateCache } from '@/server/cache';
import settingsContract from '@/apps/settings/settings.contract.json';
import { contractErrorResponse } from '@/contracts/helpers';

export const dynamic = 'force-dynamic';

const MAX = settingsContract.limits.maxCommunityNameLength;
const ALLOWED_PATCH_KEYS = new Set([
	'university',
	'parentEntity',
	'clubName',
	'organizationName',
	'signatures',
]);

/** The names certificates print. Every member sees them on their own certificate. */
export async function GET(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;

	const cached = getCached<unknown>('club_info');
	if (cached) {
		return NextResponse.json(cached);
	}

	const data = await getCommunityProfile();
	setCached('club_info', data, 60_000);
	return NextResponse.json(data);
}

/** The board sets the parent entity line, the community name and the two signatories. */
async function handlePATCH(request: Request) {
	const auth = await authenticateEnrolled(request);
	if (!auth.authorized) return auth.response;
	if (!can(auth.user, 'settings', 'manage') && !can(auth.user, 'certificates', 'manage')) {
		return NextResponse.json({ error: 'You do not have permission for this action.' }, { status: 403 });
	}
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const unknownKey = Object.keys(body).find((k) => !ALLOWED_PATCH_KEYS.has(k));
		if (unknownKey) {
			return contractErrorResponse(
				settingsContract,
				'INVALID_CONFIG_KEY',
				`Unrecognized configuration key: ${unknownKey}.`
			);
		}
		const next: Record<string, string> = {};
		const text = (v: unknown, field: string, required: boolean) => {
			const s = typeof v === 'string' ? v.trim() : '';
			if (required && !s) throw new Error(`${field} cannot be empty.`);
			if (s.length > MAX) throw new Error(`${field} may be at most ${MAX} characters.`);
			return s;
		};
		if (body.university !== undefined || body.parentEntity !== undefined) {
			const val = text(body.parentEntity ?? body.university, 'Studio', true);
			next.parent_entity = val;
			next.university = val;
		}
		if (body.clubName !== undefined || body.organizationName !== undefined) {
			const val = text(body.organizationName ?? body.clubName, 'Community name', true);
			next.organization_name = val;
			next.club_name = val;
		}
		if (body.signatures !== undefined) {
			if (!Array.isArray(body.signatures) || body.signatures.length !== 2) throw new Error('Provide two signature lines.');
			body.signatures.forEach((signature: unknown, i: number) => {
				const row = (signature ?? {}) as Record<string, unknown>;
				const nameVal = text(row.name, 'Signatory name', false);
				const titleVal = text(row.rank || row.title, 'Title', true);
				next[`signatory_${i + 1}_name`] = nameVal;
				next[`signatory_${i + 1}_title`] = titleVal;
				next[`signature${i + 1}_name`] = nameVal;
				next[`signature${i + 1}_rank`] = titleVal;
			});
		}
		if (Object.keys(next).length === 0) {
			return contractErrorResponse(settingsContract, 'INVALID_CONFIG_KEY', 'No valid configuration keys provided.');
		}
		await setSystemSettings(next);
		invalidateCache('club_info');
		const fresh = await getCommunityProfile();
		setCached('club_info', fresh, 60_000);
		return NextResponse.json({ success: true, ...fresh });
	} catch (error) {
		const message = error instanceof Error ? error.message : '';
		if (message && !message.includes('\n')) return NextResponse.json({ error: message }, { status: 400 });
		console.error('API /api/community PATCH error:', error);
		return NextResponse.json({ error: 'Could not be saved.' }, { status: 500 });
	}
}

export const PATCH = withAudit(handlePATCH, { action: 'community.update', target: 'community' });
