// Making roles and members through the admin API, for suites that build their own data.
import { client } from './api.mjs';

export const PASSWORD = 'Kulup-Test-2026!';

/** Creates a role and returns its id. `spec` is the body of POST /api/roles. */
export async function createRole(admin, spec) {
	const res = await admin.post('/api/roles', spec);
	if (!res.json?.id) throw new Error(`role "${spec.name}": ${res.status} ${JSON.stringify(res.json)}`);
	return res.json.id;
}

/**
 * Creates an active member with a known password (the generated one is replaced the way
 * a person would: first sign-in, then "change password"). Returns { id, eposta, sifre }.
 */
export async function createMember(admin, base, { name, surname, email, roleId, department = 'Bilgisayar Mühendisliği', grade = 2, studentNo }) {
	const created = await admin.post('/api/members', {
		firstName: name,
		lastName: surname,
		name,
		surname,
		email: email,
		department: department,
		grade: grade,
		roleId: roleId,
		...(studentNo ? { handle: studentNo, studentNo } : {}),
	});
	const tempPassword = created.json?.temporaryPassword;
	if (!tempPassword) throw new Error(`member ${email}: ${created.status} ${JSON.stringify(created.json)}`);
	const u = client(base);
	const login = await u.post('/api/auth/login', { email: email, password: tempPassword,});
	if (login.status !== 200) throw new Error(`first sign-in ${email}: ${login.status} ${JSON.stringify(login.json)}`);
	const changed = await u.post('/api/profile/password', { currentPassword: tempPassword, newPassword: PASSWORD, current: tempPassword, fresh: PASSWORD });
	if (changed.status !== 200) throw new Error(`password ${email}: ${changed.status} ${JSON.stringify(changed.json)}`);
	return { id: created.json.member?.id || created.json.id, email, password: PASSWORD };
}
