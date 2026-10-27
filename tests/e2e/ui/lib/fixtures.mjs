// The fixture file written by `node scripts/dev-fixtures.mjs --out <file>`:
// the admin and the TOTP secrets, the role ids, the member accounts and a little content.
import fs from 'node:fs';

/** Reads and sanity-checks a fixture file; the error says how to make one. */
export function readFixtures(file) {
	if (!file) throw new Error('No fixture file. Run `node scripts/dev-fixtures.mjs --base <url> --out <file>` and pass it with --fixtures <file> (or E2E_FIXTURES).');
	if (!fs.existsSync(file)) throw new Error(`Fixture file ${file} does not exist. Create it with scripts/dev-fixtures.mjs --out.`);
	const fx = JSON.parse(fs.readFileSync(file, 'utf8'));
	for (const key of ['admin', 'adminTotp', 'roles', 'users', 'content']) {
		if (!fx[key]) throw new Error(`Fixture file ${file} is incomplete (missing "${key}"); run scripts/dev-fixtures.mjs again.`);
	}
	return fx;
}

/** The sign-in details for a fixture account: `admin`, `zeynep`, `ege`, `can` or `okur`. */
export function account(fx, key) {
	if (key === 'admin') return { key, eposta: fx.admin.eposta, sifre: fx.admin.sifre, totp: fx.adminTotp };
	const u = fx.users[key];
	if (!u) throw new Error(`No fixture account "${key}" (have: admin, ${Object.keys(fx.users).join(', ')}).`);
	return { key, id: u.id, eposta: u.eposta, sifre: u.sifre, totp: u.totp, rol: u.rol };
}
