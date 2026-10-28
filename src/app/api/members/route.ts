import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomBytes, randomInt } from 'crypto';
import {
	addUserXp,
	createUser,
	deleteUser,
	getUserByEmail,
	getUserById,
	getMemberRoster,
	updateUserPassword,
} from '@/db';
import { auditContext } from '@/db/audit';
import { countAktifAdmin, getRolePermission, getDefaultRoleId, setUserRole, setMemberStatus } from '@/db/roles';
import { can, requireApp, type YetkiliKullanici } from '@/lib/auth/access';
import { ADMIN_ROL_ID, YETKI_ACIKLAMALARI, fazlaYetkiler, isMezunRol } from '@/core/permissions';
import { isValidEmail } from '@/lib/mail/address';
import {
	notifyMemberCreatedByAdmin,
	notifyMembershipApproved,
	notifyMembershipRejected,
	notifyPasswordReset,
} from '@/lib/mail/notifications';

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const readOnly = () => bad('Mezunlar sadece okuma erişimine sahiptir.', 403);

/**
 * Whether `actor` may hand out or act on `roleId`: nobody may give a role, or
 * touch a member, stronger than themselves; the admin role is the admin's.
 */
async function rolSinirHatasi(actor: YetkiliKullanici, roleId: string | null | undefined): Promise<string | null> {
	if (!roleId) return null;
	if (roleId === ADMIN_ROL_ID && !actor.permission.admin) return 'Admin roleünü yalnızca bir admin verebilir.';
	const fazla = fazlaYetkiler((await getRolePermission(roleId)).izinler, actor.permission.izinler);
	return fazla.length ? `Kendinizden daha yetkili bir role veremezsiniz (${fazla.map((a) => YETKI_ACIKLAMALARI[a].ad).join(', ')}).` : null;
}

export async function GET(request: Request) {
	const auth = await requireApp(request, 'members', 'kullan');
	if (!auth.authorized) return auth.response;
	try {
		const rows = await getMemberRoster();
		// Applications and rejected accounts are for those who manage members.
		const members = can(auth.user, 'members', 'yonet')
			? rows
			: rows.filter((m) => m.status === 'aktif' || m.status === 'mezun');
		return NextResponse.json({
			success: true,
			members,
			count: members.length,
			...(members.length === 0 ? { message: 'Henüz kayıtlı üye bulunmuyor.' } : {}),
		});
	} catch (error) {
		console.error('API /api/uyeler GET error:', error);
		return NextResponse.json({
			success: true,
			members: [],
			count: 0,
			message: 'Henüz kayıtlı üye bulunmuyor.',
		});
	}
}

export async function POST(request: Request) {
	// Creating members issues credentials: managing members.
	const auth = await requireApp(request, 'members', 'yonet');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'mezun') return readOnly();

	try {
		const body = await request.json();
		const { ad, soyad, email, bolum, sinif, ogrenciNo, bio } = body;
		if (!ad || !soyad || !email || !bolum) return bad('Ad, soyad, e-posta ve bölüm alanları zorunludur');
		const normalizedEposta = String(email).trim().toLowerCase();
		if (!isValidEmail(normalizedEposta)) return bad('Geçerli bir e-posta adresi girin');

		// No role given: the club's default role for new members.
		const roleId: string | null = typeof body.roleId === 'string' && body.roleId ? body.roleId : await getDefaultRoleId();
		const sinir = await rolSinirHatasi(auth.user, roleId);
		if (sinir) return bad(sinir, 403);
		const rolYetki = roleId ? await getRolePermission(roleId) : null;
		if (roleId && !rolYetki?.role) return bad('Role bulunamadı.', 404);

		if (await getUserByEmail(normalizedEposta)) return bad('Bu e-posta adresiyle kayıtlı bir üye zaten mevcut', 409);

		// Random, not derived from the name: `<ad><3 digits>` had only 900 possibilities.
		const defaultPass = randomBytes(9).toString('base64url');
		const newUser = await createUser({
			ad: String(ad).trim(),
			soyad: String(soyad).trim(),
			email: normalizedEposta,
			passwordHash: await bcrypt.hash(defaultPass, 12),
			ogrenciNo: ogrenciNo?.trim() || `24010${randomInt(1000, 10000)}`,
			bolum: String(bolum).trim(),
			sinif: Number(sinif) || 1,
			roleId,
			bio: bio?.trim() || '',
			status: isMezunRol(rolYetki?.role) ? 'mezun' : 'aktif',
		}, auditContext(request, auth.user));
		void notifyMemberCreatedByAdmin(
			{ ad: newUser.ad, soyad: newUser.soyad, email: newUser.email },
			defaultPass
		);
		const { passwordHash: _h, ...safe } = newUser;
		return NextResponse.json({ success: true, member: safe, geciciSifre: defaultPass });
	} catch (error) {
		console.error('API /api/uyeler POST error:', error);
		return bad('İşlem tamamlanamadı.', 500);
	}
}

export async function PATCH(request: Request) {
	const auth = await requireApp(request, 'members', 'yonet');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'mezun') return readOnly();

	try {
		const body = await request.json();
		const { id, status, addXp } = body;
		if (!id) return bad('Kullanıcı ID zorunludur.');
		const target = await getUserById(id);
		if (!target) return bad('Üye bulunamadı.', 404);

		// A member stronger than you is out of reach (an admin cannot be demoted by a manager).
		if (target.id !== auth.user.id) {
			const sinir = await rolSinirHatasi(auth.user, target.roleId);
			if (sinir) return bad('Sizden daha yetkili bir üyeyi değiştiremezsiniz.', 403);
		}

		if (body.sifreSifirla) {
			const defaultPass = randomBytes(9).toString('base64url');
			const passwordHash = await bcrypt.hash(defaultPass, 12);
			await updateUserPassword(id, passwordHash, true);
			void notifyPasswordReset({ ad: target.ad, soyad: target.soyad, email: target.email }, defaultPass);
			return NextResponse.json({
				success: true,
				message: 'Üyenin şifresi sıfırlandı.',
				geciciSifre: defaultPass,
			});
		}

		if (body.roleId !== undefined) {
			const roleId: string | null = typeof body.roleId === 'string' && body.roleId ? body.roleId : null;
			const sinir = await rolSinirHatasi(auth.user, roleId);
			if (sinir) return bad(sinir, 403);
			const r = await setUserRole(id, roleId, auditContext(request, auth.user));
			if (r === 'role-yok') return bad('Role bulunamadı.', 404);
			if (r === 'son-admin') return bad('Kulübün son admini roleünü bırakamaz; önce başka birini admin yapın.', 409);
			if (r === 'yok') return bad('Üye bulunamadı.', 404);
		}

		if (status) {
			if (!['aktif', 'beklemede', 'reddedildi', 'mezun'].includes(status)) return bad('Geçersiz status.');
			if (target.roleId === ADMIN_ROL_ID && status !== 'aktif' && (await countAktifAdmin()) <= 1) {
				return bad('Kulübün son admininin hesabı pasifleştirilemez.', 409);
			}
			// Approving someone without a role gives them the club's default role;
			// setMemberStatus does both (and the welcome XP) in one transaction.
			if ((await setMemberStatus(id, status, auditContext(request, auth.user))) === 'yok') return bad('Üye bulunamadı.', 404);

			const recipient = { ad: target.ad, soyad: target.soyad, email: target.email };
			if ((target.status === 'beklemede' || target.status === 'reddedildi') && status === 'aktif') {
				void notifyMembershipApproved(recipient);
			} else if (target.status === 'beklemede' && status === 'reddedildi') {
				void notifyMembershipRejected(recipient);
			}
		}

		if (typeof addXp === 'number' && addXp !== 0) await addUserXp(id, addXp);

		return NextResponse.json({ success: true, message: 'Üye bilgileri güncellendi.' });
	} catch (error) {
		console.error('API /api/uyeler PATCH error:', error);
		return bad('İşlem tamamlanamadı.', 500);
	}
}

export async function DELETE(request: Request) {
	const auth = await requireApp(request, 'members', 'yonet');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'mezun') return readOnly();

	try {
		const id = new URL(request.url).searchParams.get('id');
		if (!id) return bad('Kullanıcı ID zorunludur.');
		if (id === auth.user.id) return bad('Kendinizi silemezsiniz.');
		const target = await getUserById(id);
		if (!target) return bad('Kullanıcı bulunamadı.', 404);
		if (await rolSinirHatasi(auth.user, target.roleId)) return bad('Sizden daha yetkili bir üyeyi silemezsiniz.', 403);
		if (target.roleId === ADMIN_ROL_ID && (await countAktifAdmin()) <= 1) return bad('Kulübün son admini silinemez.', 409);

		if (!(await deleteUser(id, auditContext(request, auth.user)))) return bad('Kullanıcı bulunamadı veya silinemedi.', 400);
		return NextResponse.json({ success: true, message: 'Üye kaydı silindi.' });
	} catch (error) {
		console.error('API /api/uyeler DELETE error:', error);
		return bad('İşlem tamamlanamadı.', 500);
	}
}
