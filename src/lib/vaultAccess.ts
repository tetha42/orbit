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
import { canUserAccessChatRoom } from '@/server/db/domains/chat.repo';

/**
 * Who may see and edit a vault — the single place that decides it.
 *
 *  - Budget app, manage level: every vault, read and write, and transfers between them.
 *  - Budget app, use level: every vault, read only.
 *  - A project's captain (`takimlar.liderId`) keeps their own project's vault in
 *    the Teams app: read and write, whatever their Budget level.
 *  - Everyone else: no access.
 *
 * The role's two-factor rule applies through `can`.
 */
export type VaultAccess = 'none' | 'read' | 'write' | 'yok' | 'oku' | 'yaz';

export type VaultAccessResult =
	| { authorized: true; user: AuthorizedUser; isManagement: boolean; access: VaultAccess; erisim: VaultAccess; response?: never }
	| { authorized: false; user?: never; isManagement?: never; access?: never; erisim?: never; response: NextResponse };

const forbidden = (message = 'Bu kasaya erişim yetkiniz yok.') =>
	NextResponse.json({ error: message }, { status: 403 });

async function isTeamCaptain(user: AuthorizedUser, teamId: string | null): Promise<boolean> {
	if (teamId === null || !can(user, 'teams', 'kullan')) return false;
	const team = await getTeamById(teamId);
	return !!team && team.liderId === user.id;
}

/** What this member may do with one vault. */
export async function vaultAccessLevel(user: AuthorizedUser, teamId: string | null): Promise<VaultAccess> {
	if (can(user, 'budget', 'yonet')) return 'yaz';
	if (await isTeamCaptain(user, teamId)) return 'yaz';
	return can(user, 'budget', 'kullan') ? 'oku' : 'yok';
}

/** Non-request variant, for search, notifications and file access. */
export async function canAccessVault(user: AuthorizedUser, teamId: string | null): Promise<boolean> {
	const level = await vaultAccessLevel(user, teamId);
	return level !== 'yok' && level !== 'none';
}

/** Authenticates the caller and checks they may read (`oku`) or change (`yaz`) this vault. */
export async function verifyVaultAccess(
	request: Request,
	teamId: string | null,
	required: 'read' | 'write' | 'oku' | 'yaz'
): Promise<VaultAccessResult> {
	const auth = await authenticateEnrolled(request);
	if (!auth.authorized) return { authorized: false, response: auth.response };
	const user = auth.user;
	const access = await vaultAccessLevel(user, teamId);
	if (access === 'yok' || access === 'none') return { authorized: false, response: forbidden() };
	const isWrite = required === 'write' || required === 'yaz';
	if (isWrite && access !== 'write' && access !== 'yaz') {
		return { authorized: false, response: forbidden('Bu kasayı yalnızca görüntüleyebilirsiniz.') };
	}
	if (user.status === 'mezun' && isWrite) {
		return { authorized: false, response: forbidden('Mezunlar sadece okuma erişimine sahiptir.') };
	}
	return { authorized: true, user, isManagement: can(user, 'budget', 'yonet'), access, erisim: access };
}

/** The vaults this member may open, general first. Empty when none. */
export async function listAccessibleVaults(user: AuthorizedUser): Promise<Pick<VaultSummary, 'teamId' | 'ad' | 'kind'>[]> {
	if (can(user, 'budget', 'kullan')) {
		const teams = await getTeams();
		return [
			{ teamId: null, ad: 'Genel Kasa', kind: 'genel' },
			...teams.map((t) => ({ teamId: t.id, ad: t.ad, kind: 'proje' as const })),
		];
	}
	if (!can(user, 'teams', 'kullan')) return [];
	const led = await getLedTeams(user.id);
	return led.map((t) => ({ teamId: t.id, ad: t.ad, kind: 'proje' as const }));
}

export const listAccessibleKasas = listAccessibleVaults;

/** Receipt uploads are for people who can write to some vault. */
export async function verifyUploadAccess(request: Request): Promise<VaultAccessResult> {
	const auth = await authenticateEnrolled(request);
	if (!auth.authorized) return { authorized: false, response: auth.response };
	const user = auth.user;
	const isManagement = can(user, 'budget', 'yonet');
	const isCaptain = !isManagement && can(user, 'teams', 'kullan') && (await getLedTeams(user.id)).length > 0;
	if (!isManagement && !isCaptain) return { authorized: false, response: forbidden('Dosya yükleme yetkiniz yok.') };
	return { authorized: true, user, isManagement, access: 'yaz', erisim: 'yaz' };
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
	if (file && file.yukleyenId === user.id) return true;
	// Profile photos are part of the member directory every member can see.
	if (file && Number(file.herkeseAcik) === 1) return true;
	// Chat attachments are exactly as private as the room they were posted in.
	if (file?.sohbetOdaId) {
		if (!can(user, 'chat', 'kullan') && !user.permission?.admin) return false;
		return canUserAccessChatRoom(
			file.sohbetOdaId,
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
