import { getMailMembers, type MailCandidate, type MailMember } from '@/db/posta';
import { getRolePermission } from '@/db/roles';
import { canUse } from '@/core/permissions';
import { notifyPortalMessage } from '@/lib/mail/notifications';
import type { MailRecipient, MailSkipped } from '@/lib/posta';

export interface RecipientDecision {
	/** Who the message goes to. */
	gidecek: MailMember[];
	/** Who it does not reach, and why — told to the sender. */
	atlananlar: MailSkipped[];
	/** Set when the message must not be sent at all (strict mode: an unknown or inactive recipient). */
	hata?: string;
}

const fullName = (u: { ad: string; soyad: string }) => `${u.ad} ${u.soyad}`.trim();

/**
 * Decides who a message reaches. Recipients must be active members whose role
 * opens Mail; the others are left out and reported, so the sender hears about it
 * instead of the message vanishing.
 *
 * `strict` (a new message): an unknown or inactive id is an error. A reply goes to
 * everyone in the conversation, and someone who has since left is just skipped.
 */
export async function recipientDecision(
	gonderenId: string,
	ids: string[],
	strict: boolean
): Promise<RecipientDecision> {
	const unique = [...new Set(ids)].filter((id) => id !== gonderenId);
	const members = await getMailMembers(unique);
	const byId = new Map(members.map((u) => [u.id, u]));
	const gidecek: MailMember[] = [];
	const atlananlar: MailSkipped[] = [];
	for (const id of unique) {
		const u = byId.get(id);
		if (!u || u.status !== 'aktif') {
			if (strict) return { gidecek: [], atlananlar: [], hata: 'Alıcılar yalnızca aktif üyeler olabilir.' };
			if (u) atlananlar.push({ id, ad: fullName(u), neden: 'pasif' });
			continue;
		}
		const permission = await getRolePermission(u.roleId);
		if (!canUse(permission.izinler, 'mail')) atlananlar.push({ id, ad: fullName(u), neden: 'role' });
		else gidecek.push(u);
	}
	return { gidecek, atlananlar };
}

/** Whether each role opens Mail, asked once per role however many members hold it. */
async function roleCanUseMail(rolIds: (string | null)[]): Promise<Map<string | null, boolean>> {
	const out = new Map<string | null, boolean>();
	for (const roleId of new Set(rolIds)) out.set(roleId, canUse((await getRolePermission(roleId)).izinler, 'mail'));
	return out;
}

/** The recipient picker's rows: a name, an id and whether a message would reach them. Nothing else about the member. */
export async function recipientList(adaylar: MailCandidate[]): Promise<MailRecipient[]> {
	const acik = await roleCanUseMail(adaylar.map((a) => a.roleId));
	return adaylar.map((a) => ({ id: a.id, ad: a.ad, soyad: a.soyad, ulasilabilir: acik.get(a.roleId) === true }));
}

/** Ids of the active members a message would reach, for screens that only need to know whether to offer "send a message". */
export async function ulasilabilirIdler(adaylar: { id: string; roleId: string | null }[]): Promise<string[]> {
	const acik = await roleCanUseMail(adaylar.map((a) => a.roleId));
	return adaylar.filter((a) => acik.get(a.roleId) === true).map((a) => a.id);
}

/** The e-mail heads-up for recipients who asked for it. Never awaited by the request: a mail failure must not fail the message. */
export function notifyByEmail(gidecek: MailMember[], gonderen: { ad: string; soyad: string }, konu: string): void {
	for (const u of gidecek) {
		if (Number(u.postaEposta) !== 1) continue;
		void notifyPortalMessage(u, fullName(gonderen), konu).catch(() => {});
	}
}
