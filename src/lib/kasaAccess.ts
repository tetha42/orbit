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
 * Who may see and edit a kasa — the single place that decides it.
 *
 *  - Kasa app, manage level: every kasa, read and write, and transfers between them.
 *  - Kasa app, use level: every kasa, read only.
 *  - A project's captain (`takimlar.liderId`) keeps their own project's kasa in
 *    the Teams app: read and write, whatever their Kasa level.
 *  - Everyone else: no access.
 *
 * The role's two-factor rule applies through `can`.
 */
export type VaultAccess = 'yok' | 'oku' | 'yaz';

// `response?: never` / `user?: never`: without `strict` the compiler does not
// narrow a union on `authorized`, so both members declare every property.
export type VaultAccessResult =
	| { authorized: true; user: AuthorizedUser; isManagement: boolean; erisim: VaultAccess; response?: never }
	| { authorized: false; user?: never; isManagement?: never; erisim?: never; response: NextResponse };

const forbidden = (message = 'Bu kasaya erişim yetkiniz yok.') =>
	NextResponse.json({ error: message }, { status: 403 });

async function kaptaniMi(user: AuthorizedUser, teamId: string | null): Promise<boolean> {
	if (teamId === null || !can(user, 'teams', 'kullan')) return false;
	const team = await getTeamById(teamId);
	return !!team && team.liderId === user.id;
}

/** What this member may do with one kasa. */
export async function vaultAccessLevel(user: AuthorizedUser, teamId: string | null): Promise<VaultAccess> {
	if (can(user, 'budget', 'yonet')) return 'yaz';
	if (await kaptaniMi(user, teamId)) return 'yaz';
	return can(user, 'budget', 'kullan') ? 'oku' : 'yok';
}

/** Non-request variant, for search, notifications and file access. */
export async function canAccessVault(user: AuthorizedUser, teamId: string | null): Promise<boolean> {
	return (await vaultAccessLevel(user, teamId)) !== 'yok';
}

/** Authenticates the caller and checks they may read (`oku`) or change (`yaz`) this kasa. */
export async function verifyVaultAccess(request: Request, teamId: string | null, gereken: 'oku' | 'yaz'): Promise<VaultAccessResult> {
	const auth = await authenticateEnrolled(request);
	if (!auth.authorized) return { authorized: false, response: auth.response };
	const user = auth.user;
	const erisim = await vaultAccessLevel(user, teamId);
	if (erisim === 'yok') return { authorized: false, response: forbidden() };
	if (gereken === 'yaz' && erisim !== 'yaz') return { authorized: false, response: forbidden('Bu kasayı yalnızca görüntüleyebilirsiniz.') };
	if (user.status === 'mezun' && gereken === 'yaz') return { authorized: false, response: forbidden('Mezunlar sadece okuma erişimine sahiptir.') };
	return { authorized: true, user, isManagement: can(user, 'budget', 'yonet'), erisim };
}

/** The kasas this member may open, general first. Empty when none. */
export async function listAccessibleKasas(user: AuthorizedUser): Promise<Pick<VaultSummary, 'teamId' | 'ad' | 'kind'>[]> {
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

/** Receipt uploads are for people who can write to some kasa. */
export async function verifyUploadAccess(request: Request): Promise<VaultAccessResult> {
	const auth = await authenticateEnrolled(request);
	if (!auth.authorized) return { authorized: false, response: auth.response };
	const user = auth.user;
	const yonetim = can(user, 'budget', 'yonet');
	const kaptan = !yonetim && can(user, 'teams', 'kullan') && (await getLedTeams(user.id)).length > 0;
	if (!yonetim && !kaptan) return { authorized: false, response: forbidden('Dosya yükleme yetkiniz yok.') };
	return { authorized: true, user, isManagement: yonetim, erisim: 'yaz' };
}

/**
 * May this user read an uploaded receipt?
 *
 * The uploader can, until the file is attached. Once a ledger entry references
 * it, access follows that entry's kasa — the file is exactly as private as the
 * number it documents.
 */
export async function canReadUpload(user: AuthorizedUser, name: string): Promise<boolean> {
	const dosya = await getStoredFile(name);
	if (dosya && dosya.yukleyenId === user.id) return true;
	// Profile photos are part of the member directory every member can see.
	if (dosya && Number(dosya.herkeseAcik) === 1) return true;
	// Chat attachments are exactly as private as the room they were posted in.
	if (dosya?.sohbetOdaId) {
		if (!can(user, 'chat', 'kullan') && !user.permission?.admin) return false;
		return canUserAccessChatRoom(
			dosya.sohbetOdaId,
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
