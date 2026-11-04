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

function parseWorkspaceState(raw: unknown): UserWorkspaceState {
	if (!raw) return {};
	if (typeof raw === 'string') {
		try {
			const parsed = JSON.parse(raw);
			return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
				? (parsed as UserWorkspaceState)
				: {};
		} catch {
			return {};
		}
	}
	if (typeof raw === 'object' && !Array.isArray(raw)) {
		return raw as UserWorkspaceState;
	}
	return {};
}

export async function getUserWorkspacePreferences(
	userId: string
): Promise<WorkspacePreferencesRecord | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query<{
		id: string;
		workspaceState?: unknown;
		workspace_state?: unknown;
	}>(
		`SELECT id, workspace_state AS "workspaceState"
		 FROM users
		 WHERE id = $1`,
		[userId]
	);
	if (res.rows.length === 0) return null;
	const row = res.rows[0];
	const state = parseWorkspaceState(row.workspaceState ?? row.workspace_state);
	return {
		userId: String(row.id),
		state,
		updatedAt: Number(state.updatedAt) || 0,
	};
}

export async function setUserWorkspacePreferences(
	userId: string,
	state: UserWorkspaceState
): Promise<WorkspacePreferencesRecord> {
	await ensurePostgresInit();
	const now = Date.now();
	const nextState: UserWorkspaceState = { ...state, updatedAt: now };
	const stateJson = JSON.stringify(nextState);
	await getPgPool().query(
		`UPDATE users SET workspace_state = $2::jsonb WHERE id = $1`,
		[userId, stateJson]
	);
	return {
		userId,
		state: nextState,
		updatedAt: now,
	};
}
