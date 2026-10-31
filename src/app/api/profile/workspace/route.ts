import { verifyAuth } from '@/lib/auth/authGuard';
import { withAudit } from '@/lib/audit/withAudit';
import { jsonSuccess, jsonError } from '@/lib/server/apiResponse';
import {
	getUserWorkspacePreferences,
	setUserWorkspacePreferences,
	type UserWorkspaceState,
} from '@/server/db/domains/workspacePreferences.repo';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;

	try {
		const record = await getUserWorkspacePreferences(auth.user.id);
		return jsonSuccess({
			workspace: record?.state ?? null,
			updatedAt: record?.updatedAt ?? 0,
		});
	} catch (error) {
		console.error('GET /api/profile/workspace error:', error);
		return jsonError('Failed to fetch workspace preferences.', 500);
	}
}

async function handlePUT(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;

	try {
		const body = (await request.json().catch(() => null)) as UserWorkspaceState | null;
		if (!body || typeof body !== 'object' || Array.isArray(body)) {
			return jsonError('Invalid request body. Expected object.', 400);
		}

		// Basic sanitization
		const sanitized: UserWorkspaceState = {};
		if (typeof body.activeWallpaper === 'string') sanitized.activeWallpaper = body.activeWallpaper.slice(0, 500);
		if (typeof body.brightness === 'number') sanitized.brightness = Math.min(100, Math.max(20, body.brightness));
		if (typeof body.volume === 'number') sanitized.volume = Math.min(100, Math.max(0, body.volume));
		if (typeof body.isMuted === 'boolean') sanitized.isMuted = body.isMuted;
		if (typeof body.isDockAutoHide === 'boolean') sanitized.isDockAutoHide = body.isDockAutoHide;
		if (Array.isArray(body.dockApps)) sanitized.dockApps = body.dockApps.filter((x): x is string => typeof x === 'string');
		if (typeof body.windows === 'object' && body.windows !== null) sanitized.windows = body.windows;
		if (typeof body.activeApp === 'string') sanitized.activeApp = body.activeApp;

		const updated = await setUserWorkspacePreferences(auth.user.id, sanitized);
		return jsonSuccess({
			workspace: updated.state,
			updatedAt: updated.updatedAt,
		});
	} catch (error) {
		console.error('PUT /api/profile/workspace error:', error);
		return jsonError('Failed to update workspace preferences.', 500);
	}
}

export const PUT = withAudit(handlePUT, { action: 'profile.workspace.update', target: 'profile.workspace' });
