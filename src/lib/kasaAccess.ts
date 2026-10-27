import { NextResponse } from 'next/server';
import {
	getBudgetTeamIdsByReceipt,
	getDosya,
	getLedTeams,
	getTeamById,
	getTeams,
} from '@/db';
import { authenticateEnrolled, can, type YetkiliKullanici } from '@/lib/auth/access';
import type { KasaSummary } from '@/types/budget';

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
export type KasaErisim = 'yok' | 'oku' | 'yaz';

// `response?: never` / `user?: never`: without `strict` the compiler does not
// narrow a union on `authorized`, so both members declare every property.
export type KasaAccessResult =
	| { authorized: true; user: YetkiliKullanici; isManagement: boolean; erisim: KasaErisim; response?: never }
	| { authorized: false; user?: never; isManagement?: never; erisim?: never; response: NextResponse };

const forbidden = (message = 'Bu kasaya erişim yetkiniz yok.') =>
	NextResponse.json({ error: message }, { status: 403 });

async function kaptaniMi(user: YetkiliKullanici, teamId: string | null): Promise<boolean> {
	if (teamId === null || !can(user, 'teams', 'kullan')) return false;
	const team = await getTeamById(teamId);
	return !!team && team.liderId === user.id;
}

/** What this member may do with one kasa. */
export async function kasaErisimi(user: YetkiliKullanici, teamId: string | null): Promise<KasaErisim> {
	if (can(user, 'budget', 'yonet')) return 'yaz';
	if (await kaptaniMi(user, teamId)) return 'yaz';
	return can(user, 'budget', 'kullan') ? 'oku' : 'yok';
}

/** Non-request variant, for search, notifications and file access. */
export async function canAccessKasa(user: YetkiliKullanici, teamId: string | null): Promise<boolean> {
	return (await kasaErisimi(user, teamId)) !== 'yok';
}

/** Authenticates the caller and checks they may read (`oku`) or change (`yaz`) this kasa. */
export async function verifyKasaAccess(request: Request, teamId: string | null, gereken: 'oku' | 'yaz'): Promise<KasaAccessResult> {
	const auth = await authenticateEnrolled(request);
	if (!auth.authorized) return { authorized: false, response: auth.response };
	const user = auth.user;
	const erisim = await kasaErisimi(user, teamId);
	if (erisim === 'yok') return { authorized: false, response: forbidden() };
	if (gereken === 'yaz' && erisim !== 'yaz') return { authorized: false, response: forbidden('Bu kasayı yalnızca görüntüleyebilirsiniz.') };
	if (user.status === 'mezun' && gereken === 'yaz') return { authorized: false, response: forbidden('Mezunlar sadece okuma erişimine sahiptir.') };
	return { authorized: true, user, isManagement: can(user, 'budget', 'yonet'), erisim };
}

/** The kasas this member may open, general first. Empty when none. */
export async function listAccessibleKasas(user: YetkiliKullanici): Promise<Pick<KasaSummary, 'teamId' | 'ad' | 'kind'>[]> {
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
export async function verifyUploadAccess(request: Request): Promise<KasaAccessResult> {
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
export async function canReadUpload(user: YetkiliKullanici, name: string): Promise<boolean> {
	const dosya = await getDosya(name);
	if (dosya && dosya.yukleyenId === user.id) return true;
	// Profile photos are part of the member directory every member can see.
	if (dosya && Number(dosya.herkeseAcik) === 1) return true;

	const kasaIds = await getBudgetTeamIdsByReceipt(`/api/uploads/${name}`);
	for (const teamId of kasaIds) {
		if (await canAccessKasa(user, teamId)) return true;
	}
	return false;
}
