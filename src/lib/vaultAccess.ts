import { NextResponse } from 'next/server';
import {
	getBudgetTeamIdsByReceipt,
	getStoredFile,
	getLedTeams,
	getTeamById,
	getTeams,
} from '@/db';
import { authenticateEnrolled, can, type AuthorizedUser } from '@/lib/auth/access';
import type { VaultSummary } from '@/types/budget';
import { canUserAccessChatRoom } from '@/db/repositories/chat.repo';

/**
 * Who may see and edit a vault — the single place that decides it.
 *
 *  - Budget app, manage level: every vault, read and write, and transfers between them.
 *  - Budget app, use level: every vault, read only.
 *  - A project's captain (`takimlar.leadId`) keeps their own project's vault in
 *    the Teams app: read and write, whatever their Budget level.
 *  - Everyone else: no access.
 *
 * The role's two-factor rule applies through `can`.
 */
export type VaultAccess = 'none' | 'read' | 'write';

export type VaultAccessResult =
	| { authorized: true; user: AuthorizedUser; isManagement: boolean; access: VaultAccess;response?: never }
	| { authorized: false; user?: never; isManagement?: never; access?: never;response: NextResponse };

const forbidden = (message = 'Bu kasaya erişim yetkiniz yok.') =>
	NextResponse.json({ error: message }, { status: 403 });

async function isTeamCaptain(user: AuthorizedUser, teamId: string | null): Promise<boolean> {
	if (teamId === null || !can(user, 'teams', 'use')) return false;
	const team = await getTeamById(teamId);
	return !!team && team.leadId === user.id;
}

/** What this member may do with one vault. */
export async function vaultAccessLevel(user: AuthorizedUser, teamId: string | null): Promise<VaultAccess> {
	if (can(user, 'budget', 'manage')) return 'write';
	if (await isTeamCaptain(user, teamId)) return 'write';
	return can(user, 'budget', 'use') ? 'read' : 'none';
}

/** Non-request variant, for search, notifications and file access. */
export async function canAccessVault(user: AuthorizedUser, teamId: string | null): Promise<boolean> {
	const level = await vaultAccessLevel(user, teamId);
	return level !== 'none';
}

/** Authenticates the caller and checks they may read (`oku`) or change (`yaz`) this vault. */
export async function verifyVaultAccess(
	request: Request,
	teamId: string | null,
	required: 'read' | 'write'
): Promise<VaultAccessResult> {
	const auth = await authenticateEnrolled(request);
	if (!auth.authorized) return { authorized: false, response: auth.response };
	const user = auth.user;
	const access = await vaultAccessLevel(user, teamId);
	if (access === 'none') return { authorized: false, response: forbidden() };
	const isWrite = required === 'write';
	if (isWrite && access !== 'write') {
		return { authorized: false, response: forbidden('Bu kasayı yalnızca görüntüleyebilirsiniz.') };
	}
	if (user.status === 'alumni' && isWrite) {
		return { authorized: false, response: forbidden('Mezunlar sadece okuma erişimine sahiptir.') };
	}
	return { authorized: true, user, isManagement: can(user, 'budget', 'manage'), access,};
}

/** The vaults this member may open, general first. Empty when none. */
export async function listAccessibleVaults(user: AuthorizedUser): Promise<Pick<VaultSummary, 'teamId' | 'name' | 'kind'>[]> {
	if (can(user, 'budget', 'use')) {
		const teams = await getTeams();
		return [
			{ teamId: null, name: 'Genel Kasa', kind: 'general' },
			...teams.map((t) => ({ teamId: t.id, name: t.name, kind: 'project' as const })),
		];
	}
	if (!can(user, 'teams', 'use')) return [];
	const led = await getLedTeams(user.id);
	return led.map((t) => ({ teamId: t.id, name: t.name, kind: 'project' as const }));
}

/** Receipt uploads are for people who can write to some vault. */
export async function verifyUploadAccess(request: Request): Promise<VaultAccessResult> {
	const auth = await authenticateEnrolled(request);
	if (!auth.authorized) return { authorized: false, response: auth.response };
	const user = auth.user;
	const isManagement = can(user, 'budget', 'manage');
	const isCaptain = !isManagement && can(user, 'teams', 'use') && (await getLedTeams(user.id)).length > 0;
	if (!isManagement && !isCaptain) return { authorized: false, response: forbidden('Dosya yükleme yetkiniz yok.') };
	return { authorized: true, user, isManagement, access: 'write',};
}

/**
 * May this user read an uploaded receipt?
 *
 * The uploader can, until the file is attached. Once a ledger entry references
 * it, access follows that entry's vault — the file is exactly as private as the
 * number it documents.
 */
export async function canReadUpload(user: AuthorizedUser, name: string): Promise<boolean> {
	const file = await getStoredFile(name);
	if (file && file.uploaderId === user.id) return true;
	// Profile photos are part of the member directory every member can see.
	if (file && Number(file.everyoneOpen) === 1) return true;
	// Chat attachments are exactly as private as the room they were posted in.
	if (file?.chatRoomId) {
		if (!can(user, 'chat', 'use') && !user.permission?.admin) return false;
		return canUserAccessChatRoom(
			file.chatRoomId,
			user.id,
			Boolean(user.permission?.admin)
		);
	}

	const vaultIds = await getBudgetTeamIdsByReceipt(`/api/uploads/${name}`);
	for (const teamId of vaultIds) {
		if (await canAccessVault(user, teamId)) return true;
	}
	return false;
}
