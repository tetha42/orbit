import type { User } from '@/db/schema';
import {
	getFormFields,
	getMemberFieldValues,
	getRegistrationCoreConfig,
	getUserById,
} from '@/db';
import { getRolePermission } from '@/db/roles';
import type { FormField, FormFieldValueMap } from '@/lib/formFields';

export interface MemberAdminMember {
	id: string;
	firstName: string;
	lastName: string;
	name: string;
	surname: string;
	email: string;
	handle: string;
	studentNo: string;
	department: string;
	grade: number;
	bio: string;
	avatarUrl: string | null;
	profilePhoto: string | null;
	status: User['status'];
	roleId: string | null;
	roleInfo: { id: string; name: string; color: string } | null;
}

export interface MemberAdminDetail {
	member: MemberAdminMember;
	fields: FormField[];
	allFields?: FormField[];
	customFields: FormFieldValueMap;
	core: Awaited<ReturnType<typeof getRegistrationCoreConfig>>;
}

export type MemberUpdateResult =
	| { ok: true; detail: MemberAdminDetail }
	| { ok: false; status: number; error: string; fieldErrors?: Record<string, string> };

export type SelfUpdateResult =
	| { ok: true }
	| { ok: false; status: number; error: string; fieldErrors?: Record<string, string> };

export function hasUnsafeTextChars(value: string): boolean {
	return /[<>]|\p{Cc}/u.test(value);
}

export function readString(raw: unknown, fallback = ''): string {
	return typeof raw === 'string' ? raw.trim() : fallback;
}

function safeMember(user: User, role: MemberAdminMember['roleInfo']): MemberAdminMember {
	const firstName = user.firstName ?? user.name;
	const lastName = user.lastName ?? user.surname;
	const handle = user.handle ?? user.studentNo ?? '';
	const department = user.department;
	const grade = Number(user.grade) || 1;
	const avatarUrl = user.avatarUrl ?? user.profilePhoto ?? null;
	return {
		id: user.id,
		firstName,
		lastName,
		name: firstName,
		surname: lastName,
		email: user.email,
		handle,
		studentNo: handle,
		department,
		grade,
		bio: user.bio ?? '',
		avatarUrl,
		profilePhoto: avatarUrl,
		status: user.status,
		roleId: user.roleId ?? null,
		roleInfo: role,
	};
}

export async function getMemberAdminDetail(id: string): Promise<MemberAdminDetail | null> {
	const user = await getUserById(id);
	if (!user) return null;
	const [role, allFields, values, core] = await Promise.all([
		user.roleId ? getRolePermission(user.roleId) : Promise.resolve(null),
		getFormFields({ includeArchived: false }),
		getMemberFieldValues(id),
		getRegistrationCoreConfig(),
	]);
	const fields = allFields.filter(
		(field) => field.enabled && field.adminEditable && field.type !== 'password'
	);
	const activeFields = allFields.filter((field) => field.enabled);
	const keys = new Set(activeFields.map((field) => field.fieldKey));
	const customFields: FormFieldValueMap = {};
	for (const [key, value] of Object.entries(values)) {
		if (keys.has(key)) customFields[key] = value;
	}
	return {
		member: safeMember(user, role?.role ?? null),
		fields,
		allFields: activeFields,
		customFields,
		core,
	};
}
