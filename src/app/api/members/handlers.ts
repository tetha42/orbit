import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomBytes, randomInt } from 'crypto';
import {
	addUserXp,
	createUser,
	getUserByEmail,
	getUserById,
	updateUserPassword,
	getFormFields,
	getRegistrationCoreConfig,
	setMemberFieldValues,
	createMembershipApplication,
	recordApplicationDecision,
	getMembershipPolicy,
} from '@/db';
import { defaultLevelValue, defaultTrackValue } from '@/lib/i18n/data/registrationConfig';
import { validateFormValues } from '@/lib/formFields';
import { countActiveAdmins, getRolePermission, getDefaultRoleId, setUserRole, setMemberStatus } from '@/db/roles';
import type { AuthorizedUser } from '@/lib/auth/access';
import { roleLimitProblem } from '@/server/members/access';
import { ADMIN_ROLE_ID, isAlumniRole } from '@/core/permissions';
import { isValidEmail } from '@/lib/mail/address';
import { passwordProblem } from '@/lib/profile';
import {
	notifyMemberCreatedByAdmin,
	notifyMembershipApproved,
	notifyMembershipRejected,
} from '@/lib/mail/notifications/membershipStatusEmails';
import { notifyPasswordReset } from '@/lib/mail/notifications/securityAndPortalEmails';
import type { auditContext } from '@/db/audit';
import membersContract from '@/apps/members/members.contract.json';
import { contractErrorResponse } from '@/contracts/helpers';

export const badMember = (error: string, status = 400) => NextResponse.json({ error }, { status });
export const readOnlyAlumni = () => badMember('Alumni have read-only access.', 403);

type AuditCtx = ReturnType<typeof auditContext>;

export async function createMemberHandler(request: Request, actor: AuthorizedUser, ctx: AuditCtx) {
	const policy = await getMembershipPolicy();
	if (!policy.adminCreate) {
		return badMember('Admin member creation is disabled in membership policy.', 403);
	}

	const body = await request.json();
	const email = body.email;
	const name = body.firstName ?? body.name;
	const surname = body.lastName ?? body.surname;
	const department = body.department;
	const grade = body.grade;
	const studentNo = body.handle ?? body.memberId ?? body.studentNo;
	const bio = typeof body.bio === 'string' ? body.bio.trim() : '';
	const password = body.password;

	if (bio.length > membersContract.limits.maxBioLength) {
		return badMember(`Bio cannot exceed ${membersContract.limits.maxBioLength} characters.`);
	}

	const coreConfig = await getRegistrationCoreConfig();
	const allowedLevels = new Set(coreConfig.level.options.map((option) => Number(option.value)));
	const parsedGrade = Number(grade) || defaultLevelValue(coreConfig);
	if (!Number.isInteger(parsedGrade) || !allowedLevels.has(parsedGrade)) {
		return badMember('Experience level must be one of the configured options.');
	}
	const handleInput = String(studentNo ?? '').trim();
	const rawHandle = handleInput || `ORB-${randomBytes(3).toString('hex').toUpperCase()}`;
	if (!/^[a-zA-Z0-9_-]{3,32}$/.test(rawHandle)) {
		return badMember('Member ID / Handle must be 3-32 characters using letters, numbers, hyphens, or underscores.');
	}
	const cleanTrack = String(department || '').trim() || defaultTrackValue(coreConfig);
	if (!name || !surname || !email) return badMember('First name, last name and e-mail are required.');
	const normalizedEmail = String(email).trim().toLowerCase();
	if (!isValidEmail(normalizedEmail)) return badMember('Enter a valid e-mail address.');

	if (
		body.customFields &&
		typeof body.customFields === 'object' &&
		Object.keys(body.customFields as Record<string, unknown>).length > membersContract.limits.maxCustomFields
	) {
		return badMember(`At most ${membersContract.limits.maxCustomFields} custom fields are allowed.`);
	}

	const memberFields = (await getFormFields({ scope: 'member', enabledOnly: true })).slice(
		0,
		membersContract.limits.maxCustomFields
	);
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

	let memberPassword = typeof password === 'string' && password.length > 0 ? password : '';
	let generatedPassword = false;
	if (memberPassword) {
		const problem = passwordProblem(memberPassword, { email: normalizedEmail });
		if (problem) return badMember(problem);
	} else {
		memberPassword = randomBytes(9).toString('base64url');
		generatedPassword = true;
	}

	const rawRoleId = body.roleId;
	const roleId: string | null = typeof rawRoleId === 'string' && rawRoleId ? rawRoleId : await getDefaultRoleId();
	const limit = await roleLimitProblem(actor, roleId);
	if (limit) return badMember(limit, 403);
	const rolePermission = roleId ? await getRolePermission(roleId) : null;
	if (roleId && !rolePermission?.role) return badMember('Role not found.', 404);

	if (await getUserByEmail(normalizedEmail)) {
		return contractErrorResponse(membersContract, 'EMAIL_ALREADY_EXISTS');
	}

	const preferredLanguage = body.preferredLanguage === 'tr' ? 'tr' : 'en';
	const newUser = await createUser(
		{
			name: String(name).trim(),
			surname: String(surname).trim(),
			email: normalizedEmail,
			passwordHash: await bcrypt.hash(memberPassword, 12),
			studentNo: rawHandle || `24010${randomInt(1000, 10000)}`,
			department: cleanTrack,
			grade: parsedGrade,
			roleId,
			bio,
			preferredLanguage,
			status: isAlumniRole(rolePermission?.role) ? 'alumni' : 'active',
		},
		ctx
	);
	if (Object.keys(customValidation.clean).length > 0) {
		await setMemberFieldValues(newUser.id, customValidation.clean, memberFields);
	}
	await createMembershipApplication({
		userId: newUser.id,
		source: 'admin',
		status: 'approved',
		snapshot: {
			name: newUser.name,
			surname: newUser.surname,
			email: newUser.email,
			studentNo: newUser.studentNo,
			department: newUser.department,
			grade: newUser.grade,
			customFields: customValidation.clean,
			createdBy: actor.id,
		},
		reviewedBy: actor.id,
		reviewedAt: Date.now(),
	});
	if (generatedPassword) {
		void notifyMemberCreatedByAdmin(
			{ name: newUser.name, surname: newUser.surname, email: newUser.email },
			memberPassword
		);
	}
	const { passwordHash: _h, ...safe } = newUser;
	return NextResponse.json({
		success: true,
		member: { ...safe, email: safe.email, roleId: safe.roleId, status: safe.status },
		...(generatedPassword ? { temporaryPassword: memberPassword } : {}),
	});
}

export async function updateMemberHandler(request: Request, actor: AuthorizedUser, ctx: AuditCtx) {
	const body = await request.json();
	const rawRoleId = body.roleId;
	const status = body.status;
	const { id, addXp } = body;
	const rejectionReason =
		typeof body.rejectionReason === 'string' ? body.rejectionReason.trim().slice(0, 500) : null;
	if (!id) return badMember('User ID is required.');
	const target = await getUserById(id);
	if (!target) return contractErrorResponse(membersContract, 'MEMBER_NOT_FOUND');

	if (target.id !== actor.id) {
		const limit = await roleLimitProblem(actor, target.roleId);
		if (limit) return badMember('You cannot modify a member with higher authority than yourself.', 403);
	}

	if (body.passwordReset) {
		const defaultPass = randomBytes(9).toString('base64url');
		const passwordHash = await bcrypt.hash(defaultPass, 12);
		await updateUserPassword(id, passwordHash, true);
		void notifyPasswordReset({ name: target.name, surname: target.surname, email: target.email }, defaultPass);
		return NextResponse.json({
			success: true,
			message: 'Member password has been reset.',
			temporaryPassword: defaultPass,
		});
	}

	if (rawRoleId !== undefined) {
		const roleId: string | null = typeof rawRoleId === 'string' && rawRoleId ? rawRoleId : null;
		const limit = await roleLimitProblem(actor, roleId);
		if (limit) return badMember(limit, 403);
		const r = await setUserRole(id, roleId, ctx);
		if (r === 'no_role') return badMember('Role not found.', 404);
		if (r === 'last_admin') return badMember('The last club admin cannot step down; promote another member to admin first.', 409);
		if (r === 'none') return contractErrorResponse(membersContract, 'MEMBER_NOT_FOUND');
	}

	if (status) {
		if (!['active', 'pending', 'rejected', 'alumni'].includes(status)) return badMember('Invalid status.');
		if (target.roleId === ADMIN_ROLE_ID && status !== 'active' && (await countActiveAdmins()) <= 1) {
			return badMember('The last active admin account cannot be deactivated.', 409);
		}
		if ((await setMemberStatus(id, status, ctx)) === 'none') {
			return contractErrorResponse(membersContract, 'MEMBER_NOT_FOUND');
		}
		if (status === 'active' || status === 'rejected') {
			await recordApplicationDecision(id, status === 'active' ? 'approved' : 'rejected', actor.id, rejectionReason);
		}

		const recipient = {
			name: target.name,
			surname: target.surname,
			email: target.email,
			preferredLanguage: target.preferredLanguage,
		};
		if ((target.status === 'pending' || target.status === 'rejected') && status === 'active') {
			void notifyMembershipApproved(recipient);
		} else if (target.status === 'pending' && status === 'rejected') {
			void notifyMembershipRejected(recipient);
		}
	}

	if (typeof addXp === 'number' && addXp !== 0) await addUserXp(id, addXp);

	return NextResponse.json({ success: true, message: 'Member details updated.' });
}
