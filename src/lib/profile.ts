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
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_PX = 320;
export const PROFILE_PHOTO_MAX_BYTES = AVATAR_MAX_BYTES;
export const PROFILE_PHOTO_PX = AVATAR_PX;

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
	'orbitcommunity1',
	'orbit12345678',
	'asdfghjk1',
	'zxcvbnm1',
	'11111111a',
	'00000000a',
]);

/**
 * Why a new password is not acceptable, or null when it is. English, because the
 * API returns it to the member as is.
 */
export function passwordProblem(fresh: unknown, opts: { current?: string; email?: string } = {}): string | null {
	if (typeof fresh !== 'string') return 'A new password is required.';
	if (fresh.length < PASSWORD_MIN) return `The new password must be at least ${PASSWORD_MIN} characters long.`;
	if (fresh.length > PASSWORD_MAX) return `The new password can be at most ${PASSWORD_MAX} characters long.`;
	if (!/\p{L}/u.test(fresh) || !/\d/.test(fresh)) return 'The new password must contain at least one letter and one digit.';
	if (opts.current !== undefined && fresh === opts.current) return 'The new password cannot be the same as the current password.';
	const local = opts.email?.split('@')[0]?.toLocaleLowerCase('tr-TR');
	if (local && local.length >= 3 && fresh.toLocaleLowerCase('tr-TR').includes(local)) {
		return 'The password cannot contain your e-mail address.';
	}
	const normalized = fresh.toLowerCase().trim();
	if (COMMONLY_BREACHED_PASSWORDS.has(normalized)) {
		return 'This password appears on the list of the most commonly leaked weak passwords. Please choose a safer, less predictable password.';
	}
	return null;
}

/** A level from XP: 0–99 → 1, 100–299 → 2, … each level costs 100 more than the last. */
export function calculateLevel(xp: number): {
	level: number;
	progress: number;
	next: number;
} {
	let level = 1;
	let floor = 0;
	let step = 100;
	const total = Math.max(0, Math.floor(xp));
	while (total >= floor + step) {
		floor += step;
		step += 100;
		level += 1;
	}
	return { level, progress: (total - floor) / step, next: floor + step };
}

export function level(xp: number): { level: number; progress: number; next: number } {
	const res = calculateLevel(xp);
	return { level: res.level, progress: res.progress, next: res.next };
}
