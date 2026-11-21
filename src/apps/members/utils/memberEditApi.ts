import type { FormField } from '@/lib/formFields';
import type { RegistrationCoreConfig } from '@/lib/i18n/data/registrationConfig';
import { mapMemberContractError } from './memberContracts';

export interface MemberAdminDetail {
	member: {
		id: string;
		firstName?: string;
		lastName?: string;
		handle?: string;
		department?: string;
		grade?: number;
		name: string;
		surname: string;
		email: string;
		studentNo: string;
		bio: string;
		status: string;
		roleId: string | null;
		roleInfo: { id: string; name: string; color: string } | null;
	};
	fields: FormField[];
	customFields: Record<string, string>;
	core: RegistrationCoreConfig;
}

export interface MemberEditValues {
	name: string;
	surname: string;
	email: string;
	studentNo: string;
	department: string;
	grade: number;
	bio: string;
}

export async function fetchMemberEditDetail(
	memberId: string,
	t: (k: string, fallback?: string) => string,
	fallback: string
): Promise<MemberAdminDetail> {
	const res = await fetch(`/api/members/${encodeURIComponent(memberId)}`, { cache: 'no-store' });
	const data = await res.json().catch(() => null);
	if (!res.ok) throw new Error(mapMemberContractError(data?.code, data?.error || fallback, t));
	return data as MemberAdminDetail;
}

export async function patchMemberEditDetail(
	memberId: string,
	values: MemberEditValues,
	customFields: Record<string, string>,
	t: (k: string, fallback?: string) => string,
	fallback: string
): Promise<{ fieldErrors?: Record<string, string>; error?: string }> {
	const res = await fetch(`/api/members/${encodeURIComponent(memberId)}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			...values,
			firstName: values.name,
			lastName: values.surname,
			handle: values.studentNo,
			department: values.department,
			grade: values.grade,
			customFields,
		}),
	});
	const data = await res.json().catch(() => null);
	if (!res.ok) {
		return {
			fieldErrors: data?.fieldErrors,
			error: mapMemberContractError(data?.code, data?.error || fallback, t),
		};
	}
	return {};
}
