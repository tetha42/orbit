// Making roles and members through the admin API, for suites that build their own data.
import { client } from './api.mjs';

export const PASSWORD = 'Kulup-Test-2026!';

/** Creates a role and returns its id. `spec` is the body of POST /api/roller. */
export async function createRole(admin, spec) {
	const res = await admin.post('/api/roller', spec);
	if (!res.json?.id) throw new Error(`role "${spec.ad}": ${res.status} ${JSON.stringify(res.json)}`);
	return res.json.id;
}

/**
 * Creates an active member with a known password (the generated one is replaced the way
 * a person would: first sign-in, then "change password"). Returns { id, eposta, sifre }.
 */
export async function createMember(admin, base, { ad, soyad, eposta, rolId, bolum = 'Bilgisayar Mühendisliği', sinif = 2, ogrenciNo }) {
	const created = await admin.post('/api/uyeler', { ad, soyad, eposta, bolum, sinif, rolId, ...(ogrenciNo ? { ogrenciNo } : {}) });
	if (!created.json?.geciciSifre) throw new Error(`member ${eposta}: ${created.status} ${JSON.stringify(created.json)}`);
	const u = client(base);
	const login = await u.post('/api/auth/login', { eposta, sifre: created.json.geciciSifre });
	if (login.status !== 200) throw new Error(`first sign-in ${eposta}: ${login.status} ${JSON.stringify(login.json)}`);
	const changed = await u.post('/api/profil/sifre', { mevcut: created.json.geciciSifre, yeni: PASSWORD });
	if (changed.status !== 200) throw new Error(`password ${eposta}: ${changed.status} ${JSON.stringify(changed.json)}`);
	return { id: created.json.member.id, eposta, sifre: PASSWORD };
}
