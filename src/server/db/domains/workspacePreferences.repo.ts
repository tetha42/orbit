import { ensurePostgresInit, getPgPool } from '@/db/index';

export interface UserWorkspaceState {
	activeWallpaper?: string;
	brightness?: number;
	volume?: number;
	isMuted?: boolean;
	isDockAutoHide?: boolean;
	dockApps?: string[];
	windows?: Record<string, unknown>;
	activeApp?: string;
	updatedAt?: number;
}

export interface WorkspacePreferencesRecord {
	userId: string;
	state: UserWorkspaceState;
	updatedAt: number;
}

export async function getUserWorkspacePreferences(userId: string): Promise<WorkspacePreferencesRecord | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query<{ user_id: string; state: unknown; updated_at: string | number }>(
		`SELECT user_id, state, updated_at
		 FROM user_workspace_preferences
		 WHERE user_id = $1`,
		[userId]
	);
	if (res.rows.length === 0) return null;
	const row = res.rows[0];
	return {
		userId: row.user_id,
		state: (typeof row.state === 'object' && row.state !== null ? row.state : {}) as UserWorkspaceState,
		updatedAt: Number(row.updated_at) || 0,
	};
}

export async function setUserWorkspacePreferences(
	userId: string,
	state: UserWorkspaceState
): Promise<WorkspacePreferencesRecord> {
	await ensurePostgresInit();
	const now = Date.now();
	const stateJson = JSON.stringify(state);
	await getPgPool().query(
		`INSERT INTO user_workspace_preferences (user_id, state, updated_at)
		 VALUES ($1, $2::jsonb, $3)
		 ON CONFLICT (user_id) DO UPDATE SET
		   state = EXCLUDED.state,
		   updated_at = EXCLUDED.updated_at`,
		[userId, stateJson, now]
	);
	return {
		userId,
		state,
		updatedAt: now,
	};
}
