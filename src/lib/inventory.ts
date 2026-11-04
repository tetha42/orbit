/**
 * Inventory rules shared by the API, the screen and its checks. Pure: no imports.
 */

const DAY = 86_400_000;

/** Default and longest loan a member may take at once. */
export const DEFAULT_LOAN_DAYS = 14;
export const MAX_LOAN_DAYS = 30;
/** Management may lend for longer (e.g. a whole term to a project team). */
export const MANAGEMENT_MAX_LOAN_DAYS = 180;

/** "lab-rpi-001 " → "LAB-RPI-001" */
export function normalizeCode(value: unknown): string {
	return typeof value === 'string' ? value.trim().toUpperCase().replace(/\s+/g, '-') : '';
}

/** Why an inventory code is not acceptable, or null. Codes go on printed labels, so: short, upper case, no spaces. */
export function codeProblem(code: string): string | null {
	if (!/^[A-Z0-9]+(-[A-Z0-9]+)*$/.test(code))
		return 'Kod yalnızca büyük harf, rakam ve tire içerebilir (örn. LAB-RPI-006).';
	if (code.length < 3 || code.length > 24) return 'Kod 3-24 karakter olmalıdır.';
	return null;
}

/**
 * Where a loan stands: days left (≥ 0) or days overdue. Counted in whole
 * calendar days, so "due today" is 0 days left until the moment passes.
 */
export function returnStatus(
	returnDate: number | null | undefined,
	now: number,
): { gecikti: boolean; day: number } | null {
	if (!returnDate) return null;
	const diff = returnDate - now;
	if (diff >= 0) return { gecikti: false, day: Math.floor(diff / DAY) };
	// Whole days late, but never "0 days late": a minute past due is already late.
	return { gecikti: true, day: Math.max(1, Math.floor(-diff / DAY)) };
}

/**
 * Checks a requested return date. Members may borrow for up to
 * EN_UZUN_ODUNC_GUN days counted from when the loan started (so extending
 * cannot stretch a loan forever); management up to YONETIM_EN_UZUN_ODUNC_GUN.
 */
export function returnDateProblem(
	iade: number,
	opts: { now: number; start?: number; management: boolean },
): string | null {
	if (!Number.isFinite(iade)) return 'Geçerli bir iade tarihi seçin.';
	if (iade < opts.now + 60 * 60 * 1000) return 'İade tarihi en az bir saat sonrası olmalıdır.';
	const limitDays = opts.management ? MANAGEMENT_MAX_LOAN_DAYS : MAX_LOAN_DAYS;
	const from = opts.start ?? opts.now;
	if (iade > from + limitDays * DAY + DAY) return `Ödünç süresi en fazla ${limitDays} gün olabilir.`;
	return null;
}

/** End of the given local day — a return date picked as a day means "by the end of it". */
export function endOfDay(ms: number): number {
	const d = new Date(ms);
	d.setHours(23, 59, 0, 0);
	return d.getTime();
}

/** Text for a loan's state, e.g. "3 gün gecikti", "Bugün iade", "5 gün kaldı". */
export function returnText(returnDate: number | null | undefined, now: number): string {
	const d = returnStatus(returnDate, now);
	if (!d) return '';
	if (d.gecikti) return `${d.day} gün gecikti`;
	if (d.day === 0) return 'Bugün iade';
	if (d.day === 1) return 'Yarın iade';
	return `${d.day} gün kaldı`;
}
