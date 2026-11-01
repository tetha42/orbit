// Making roles and members through the admin API, for suites that build their own data.
import { client } from './api.mjs';

export const PASSWORD = 'Kulup-Test-2026!';

/** Creates a role and returns its id. `spec` is the body of POST /api/roles. */
export async function createRole(admin, spec) {
	const res = await admin.post('/api/roles', spec);
	if (!res.json?.id) throw new Error(`role "${spec.ad || spec.name}": ${res.status} ${JSON.stringify(res.json)}`);
	return res.json.id;
}

/**
 * Creates an active member with a known password (the generated one is replaced the way
 * a person would: first sign-in, then "change password"). Returns { id, eposta, sifre }.
 */
export async function createMember(admin, base, { ad, soyad, eposta, rolId, bolum = 'Bilgisayar Mühendisliği', sinif = 2, ogrenciNo }) {
	const created = await admin.post('/api/members', {
		firstName: ad,
		lastName: soyad,
		ad,
		soyad,
		email: eposta,
		department: bolum,
		bolum,
		grade: sinif,
		sinif,
		roleId: rolId,
		...(ogrenciNo ? { handle: ogrenciNo, ogrenciNo } : {}),
	});
	const tempPassword = created.json?.temporaryPassword || created.json?.geciciSifre;
	if (!tempPassword) throw new Error(`member ${eposta}: ${created.status} ${JSON.stringify(created.json)}`);
	const u = client(base);
	const login = await u.post('/api/auth/login', { email: eposta, eposta, password: tempPassword, sifre: tempPassword });
	if (login.status !== 200) throw new Error(`first sign-in ${eposta}: ${login.status} ${JSON.stringify(login.json)}`);
	const changed = await u.post('/api/profile/password', { currentPassword: tempPassword, newPassword: PASSWORD, mevcut: tempPassword, yeni: PASSWORD });
	if (changed.status !== 200) throw new Error(`password ${eposta}: ${changed.status} ${JSON.stringify(changed.json)}`);
	return { id: created.json.member?.id || created.json.id, eposta, sifre: PASSWORD };
}
