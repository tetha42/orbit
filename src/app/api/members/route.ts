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
	getFormFields,
	getRegistrationCoreConfig,
	setMemberFieldValues,
	createMembershipApplication,
	recordApplicationDecision,
	getMembershipPolicy,
} from '@/db';
import { defaultLevelValue, defaultTrackValue } from '@/lib/registrationConfig';
import { validateFormValues } from '@/lib/formFields';
import { auditContext } from '@/db/audit';
import { countActiveAdmins, getRolePermission, getDefaultRoleId, setUserRole, setMemberStatus } from '@/db/roles';
import { can, requireApp } from '@/lib/auth/access';
import { roleLimitProblem } from '@/server/members/access';
import { ADMIN_ROLE_ID, isAlumniRole } from '@/core/permissions';
import { isValidEmail } from '@/lib/mail/address';
import { passwordProblem } from '@/lib/profile';
import {
	notifyMemberCreatedByAdmin,
	notifyMembershipApproved,
	notifyMembershipRejected,
	notifyPasswordReset,
} from '@/lib/mail/notifications';

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const readOnly = () => bad('Mezunlar sadece okuma erişimine sahiptir.', 403);

export async function GET(request: Request) {
	const auth = await requireApp(request, 'members', 'kullan');
	if (!auth.authorized) return auth.response;
	try {
		const isManager = can(auth.user, 'members', 'yonet');
		const url = new URL(request.url);
		const pageParam = url.searchParams.get('page');
		const limitParam = url.searchParams.get('limit');
		const qParam = url.searchParams.get('q') || url.searchParams.get('search') || undefined;

		const isPaginated = pageParam !== null || limitParam !== null;

		if (isPaginated) {
			const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
			const limit = Math.max(1, Math.min(200, parseInt(limitParam || '20', 10) || 20));
			const result = await getMemberRoster({
				isManager,
				page,
				limit,
				search: qParam,
			});
			const members = isManager
				? result.members
				: result.members.filter((m) => m.status === 'aktif' || m.status === 'mezun');
			return NextResponse.json({
				success: true,
				members,
				count: members.length,
				totalCount: result.totalCount,
				page: result.page,
				limit: result.limit,
				totalPages: Math.ceil(result.totalCount / result.limit),
				...(members.length === 0 ? { message: 'Henüz kayıtlı üye bulunmuyor.' } : {}),
			});
		}

		const rows = await getMemberRoster({ isManager, search: qParam });
		// Applications and rejected accounts are for those who manage members.
		const members = isManager
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
	const policy = await getMembershipPolicy();
	if (!policy.adminCreate) {
		return bad('Yönetici üye oluşturma üyelik politikasında kapatılmış.', 403);
	}

	try {
		const body = await request.json();
		const email = body.email ?? body.eposta;
		const { ad, soyad, bolum, sinif, ogrenciNo, bio, password } = body;
		const coreConfig = await getRegistrationCoreConfig();
		const allowedLevels = new Set(coreConfig.level.options.map((option) => Number(option.value)));
		const parsedGrade = Number(sinif) || defaultLevelValue(coreConfig);
		if (!Number.isInteger(parsedGrade) || !allowedLevels.has(parsedGrade)) {
			return bad('Experience level must be one of the configured options.');
		}
		const rawHandle = String(ogrenciNo ?? '').trim();
		if (coreConfig.memberId.required && !rawHandle) return bad('Please enter a member ID / handle.');
		if (rawHandle && !/^[a-zA-Z0-9_-]{3,32}$/.test(rawHandle)) {
			return bad('Member ID / Handle must be 3-32 characters using letters, numbers, hyphens, or underscores.');
		}
		const cleanTrack = String(bolum || '').trim() || defaultTrackValue(coreConfig);
		if (!ad || !soyad || !email) return bad('First name, last name and e-mail are required.');
		const normalizedEmail = String(email).trim().toLowerCase();
		if (!isValidEmail(normalizedEmail)) return bad('Enter a valid e-mail address.');

		const memberFields = await getFormFields({ scope: 'member', enabledOnly: true });
		const customValidation = validateFormValues(memberFields, body.customFields, 'member');
		if (!customValidation.ok) {
			return NextResponse.json(
				{
					error: 'Please correct the highlighted fields.',
					code: 'INVALID_FORM_FIELDS',
					fieldErrors: customValidation.errors,
				},
				{ status: 400 }
			);
		}

		let memberPassword =
			typeof password === 'string' && password.length > 0 ? password : '';
		let generatedPassword = false;
		if (memberPassword) {
			const problem = passwordProblem(memberPassword, { email: normalizedEmail });
			if (problem) return bad(problem);
		} else {
			// Random, not derived from the name: `<ad><3 digits>` had only 900 possibilities.
			memberPassword = randomBytes(9).toString('base64url');
			generatedPassword = true;
		}

		// No role given: the club's default role for new members.
		const rawRoleId = body.roleId ?? body.rolId;
		const roleId: string | null = typeof rawRoleId === 'string' && rawRoleId ? rawRoleId : await getDefaultRoleId();
		const sinir = await roleLimitProblem(auth.user, roleId);
		if (sinir) return bad(sinir, 403);
		const rolePermission = roleId ? await getRolePermission(roleId) : null;
		if (roleId && !rolePermission?.role) return bad('Role bulunamadı.', 404);

		if (await getUserByEmail(normalizedEmail)) return bad('Bu e-posta adresiyle kayıtlı bir üye zaten mevcut', 409);

		const newUser = await createUser({
			ad: String(ad).trim(),
			soyad: String(soyad).trim(),
			email: normalizedEmail,
			passwordHash: await bcrypt.hash(memberPassword, 12),
			ogrenciNo: rawHandle || `24010${randomInt(1000, 10000)}`,
			bolum: cleanTrack,
			sinif: parsedGrade,
			roleId,
			bio: bio?.trim() || '',
			status: isAlumniRole(rolePermission?.role) ? 'mezun' : 'aktif',
		}, auditContext(request, auth.user));
		if (Object.keys(customValidation.clean).length > 0) {
			await setMemberFieldValues(newUser.id, customValidation.clean, memberFields);
		}
		await createMembershipApplication({
			userId: newUser.id,
			source: 'admin',
			status: 'approved',
			snapshot: {
				ad: newUser.ad,
				soyad: newUser.soyad,
				email: newUser.email,
				ogrenciNo: newUser.ogrenciNo,
				bolum: newUser.bolum,
				sinif: newUser.sinif,
				customFields: customValidation.clean,
				createdBy: auth.user.id,
			},
			reviewedBy: auth.user.id,
			reviewedAt: Date.now(),
		});
		if (generatedPassword) {
			void notifyMemberCreatedByAdmin(
				{ ad: newUser.ad, soyad: newUser.soyad, email: newUser.email },
				memberPassword
			);
		}
		const { passwordHash: _h, ...safe } = newUser;
		return NextResponse.json({
			success: true,
			member: { ...safe, eposta: safe.email, rolId: safe.roleId, durum: safe.status },
			...(generatedPassword ? { geciciSifre: memberPassword, temporaryPassword: memberPassword } : {}),
		});
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
		const rawRoleId = body.roleId !== undefined ? body.roleId : body.rolId;
		const status = body.status ?? body.durum;
		const { id, addXp } = body;
		const rejectionReason =
			typeof body.rejectionReason === 'string' ? body.rejectionReason.trim().slice(0, 500) : null;
		if (!id) return bad('Kullanıcı ID zorunludur.');
		const target = await getUserById(id);
		if (!target) return bad('Üye bulunamadı.', 404);

		// A member stronger than you is out of reach (an admin cannot be demoted by a manager).
		if (target.id !== auth.user.id) {
			const sinir = await roleLimitProblem(auth.user, target.roleId);
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

		if (rawRoleId !== undefined) {
			const roleId: string | null = typeof rawRoleId === 'string' && rawRoleId ? rawRoleId : null;
			const sinir = await roleLimitProblem(auth.user, roleId);
			if (sinir) return bad(sinir, 403);
			const r = await setUserRole(id, roleId, auditContext(request, auth.user));
			if (r === 'role-yok') return bad('Role bulunamadı.', 404);
			if (r === 'son-admin') return bad('Kulübün son admini roleünü bırakamaz; önce başka birini admin yapın.', 409);
			if (r === 'yok') return bad('Üye bulunamadı.', 404);
		}

		if (status) {
			if (!['aktif', 'beklemede', 'reddedildi', 'mezun'].includes(status)) return bad('Geçersiz status.');
			if (target.roleId === ADMIN_ROLE_ID && status !== 'aktif' && (await countActiveAdmins()) <= 1) {
				return bad('Kulübün son admininin hesabı pasifleştirilemez.', 409);
			}
			// Approving someone without a role gives them the club's default role;
			// setMemberStatus does both (and the welcome XP) in one transaction.
			if ((await setMemberStatus(id, status, auditContext(request, auth.user))) === 'yok') return bad('Üye bulunamadı.', 404);
			if (status === 'aktif' || status === 'reddedildi') {
				await recordApplicationDecision(
					id,
					status === 'aktif' ? 'approved' : 'rejected',
					auth.user.id,
					rejectionReason
				);
			}

			const recipient = {
				ad: target.ad,
				soyad: target.soyad,
				email: target.email,
				preferredLanguage: target.preferredLanguage,
			};
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
		if (await roleLimitProblem(auth.user, target.roleId)) return bad('Sizden daha yetkili bir üyeyi silemezsiniz.', 403);
		if (target.roleId === ADMIN_ROLE_ID && (await countActiveAdmins()) <= 1) return bad('Kulübün son admini silinemez.', 409);

		if (!(await deleteUser(id, auditContext(request, auth.user)))) return bad('Kullanıcı bulunamadı veya silinemedi.', 400);
		return NextResponse.json({ success: true, message: 'Üye kaydı silindi.' });
	} catch (error) {
		console.error('API /api/uyeler DELETE error:', error);
		return bad('İşlem tamamlanamadı.', 500);
	}
}
