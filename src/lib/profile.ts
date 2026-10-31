/**
 * Profile and password rules, shared by the API and the account page.
 *
 * Kept free of imports so `scripts/check-pure.mjs` can load it directly.
 */

export const BIO_MAX = 280;
export const GRADE_MIN = 1;
// Experience levels are configured per community; `users.grade` is a plain
// Postgres INTEGER, so the storage ceiling is the column's own maximum rather
// than an arbitrary six-level UI list.
export const GRADE_MAX = 2_147_483_647;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
/** Profile photos are downscaled in the browser; the server still checks the bytes and the size. */
export const PROFIL_FOTO_MAX_BYTES = 2 * 1024 * 1024;
export const PROFIL_FOTO_PX = 320;

const COMMONLY_BREACHED_PASSWORDS = new Set([
	'password',
	'password123',
	'password1',
	'12345678a',
	'123456789a',
	'12345678b',
	'qwerty123',
	'qwertyuiop1',
	'admin123',
	'admin1234',
	'administrator1',
	'welcome123',
	'welcome1',
	'iloveyou1',
	'letmein123',
	'sunshine1',
	'master123',
	'changeme1',
	'pass1234',
	'beuteknoloji1',
	'beukutup1',
	'orbitcommunity1',
	'orbit12345678',
	'asdfghjk1',
	'zxcvbnm1',
	'11111111a',
	'00000000a',
]);

/**
 * Why a new password is not acceptable, or null when it is. Turkish, because the
 * API returns it to the member as is.
 */
export function passwordProblem(yeni: unknown, opts: { mevcut?: string; email?: string } = {}): string | null {
	if (typeof yeni !== 'string') return 'Yeni şifre gerekli.';
	if (yeni.length < PASSWORD_MIN) return `Yeni şifre en az ${PASSWORD_MIN} karakter olmalıdır.`;
	if (yeni.length > PASSWORD_MAX) return `Yeni şifre en fazla ${PASSWORD_MAX} karakter olabilir.`;
	if (!/\p{L}/u.test(yeni) || !/\d/.test(yeni)) return 'Yeni şifre en az bir harf ve bir rakam içermelidir.';
	if (opts.mevcut !== undefined && yeni === opts.mevcut) return 'Yeni şifre mevcut şifreyle aynı olamaz.';
	const local = opts.email?.split('@')[0]?.toLocaleLowerCase('tr-TR');
	if (local && local.length >= 3 && yeni.toLocaleLowerCase('tr-TR').includes(local)) {
		return 'Şifre e-posta adresinizi içeremez.';
	}
	const normalized = yeni.toLowerCase().trim();
	if (COMMONLY_BREACHED_PASSWORDS.has(normalized)) {
		return 'Bu şifre dünyada en çok sızdırılan zayıf şifreler listesinde yer alıyor. Lütfen daha güvenli ve tahmin edilemez bir şifre seçiniz.';
	}
	return null;
}

/** A level from XP: 0–99 → 1, 100–299 → 2, … each level costs 100 more than the last. */
export function seviye(xp: number): { seviye: number; ilerleme: number; sonraki: number } {
	let level = 1;
	let floor = 0;
	let step = 100;
	const total = Math.max(0, Math.floor(xp));
	while (total >= floor + step) {
		floor += step;
		step += 100;
		level += 1;
	}
	return { seviye: level, ilerleme: (total - floor) / step, sonraki: floor + step };
}
