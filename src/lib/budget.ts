/**
 * Kasa calculations shared by the ledger screen and its checks. Pure: no
 * imports, so `scripts/check-pure.mjs` can load it directly.
 */

export interface VaultRow {
	id: string;
	date: number;
	olusturma?: number;
	tur: 'gelir' | 'gider';
	kategori: string;
	tutarKurus: number;
	aciklama: string;
	kaydedenAdSoyad?: string | null;
	aktarimId?: string | null;
}

/**
 * Reads an amount typed in Turkish or English style into kuruş:
 * "1.234,56", "1234,56", "1234.56", "1 234,5", "₺12". Returns null when the
 * text is not a positive amount with at most two decimals.
 */
export function parseAmount(input: string): number | null {
	let s = String(input ?? '')
		.replace(/[₺\s ]/g, '')
		.replace(/TL$/i, '');
	if (!/^\d[\d.,]*$/.test(s)) return null;
	const lastComma = s.lastIndexOf(',');
	const lastDot = s.lastIndexOf('.');
	// The right-most separator is the decimal one when two or fewer digits follow it;
	// any other separators are thousands groups.
	const sep = Math.max(lastComma, lastDot);
	let whole = s;
	let frac = '';
	if (sep >= 0 && s.length - sep - 1 <= 2 && s.length - sep - 1 > 0) {
		whole = s.slice(0, sep);
		frac = s.slice(sep + 1);
	} else if (sep === s.length - 1) {
		return null;
	}
	// Thousands groups must be exactly three digits.
	if (/[.,]/.test(whole)) {
		if (!/^\d{1,3}([.,]\d{3})+$/.test(whole)) return null;
		whole = whole.replace(/[.,]/g, '');
	}
	s = whole;
	const kurus = Number(s) * 100 + Number(frac.padEnd(2, '0') || 0);
	return Number.isSafeInteger(kurus) && kurus > 0 ? kurus : null;
}

/** 123456 → "1.234,56" */
export function formatCents(cents: number): string {
	const sign = cents < 0 ? '-' : '';
	const abs = Math.abs(Math.round(cents));
	const whole = Math.floor(abs / 100)
		.toString()
		.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
	return `${sign}${whole},${String(abs % 100).padStart(2, '0')}`;
}
export const formatKurus = formatCents;

/** Oldest first, then by entry time: the order money actually moved in. */
function chronological<T extends VaultRow>(rows: T[]): T[] {
	return [...rows].sort(
		(a, b) =>
			a.date - b.date || (a.olusturma ?? 0) - (b.olusturma ?? 0) || a.id.localeCompare(b.id),
	);
}

/** The balance right after each entry, keyed by entry id. */
export function runningBalance(rows: VaultRow[]): Map<string, number> {
	const out = new Map<string, number>();
	let balance = 0;
	for (const r of chronological(rows)) {
		balance += r.tur === 'gelir' ? r.tutarKurus : -r.tutarKurus;
		out.set(r.id, balance);
	}
	return out;
}

/** Spending per category, largest first, with each one's share of the total. */
export function categoryBreakdown(rows: VaultRow[], type: 'gelir' | 'gider' = 'gider') {
	const totals = new Map<string, number>();
	for (const r of rows)
		if (r.tur === type) totals.set(r.kategori, (totals.get(r.kategori) ?? 0) + r.tutarKurus);
	const total = [...totals.values()].reduce((a, b) => a + b, 0);
	return [...totals.entries()]
		.map(([kategori, tutarKurus]) => ({
			kategori,
			tutarKurus,
			oran: total ? tutarKurus / total : 0,
		}))
		.sort((a, b) => b.tutarKurus - a.tutarKurus || a.kategori.localeCompare(b.kategori, 'tr'));
}
export const kategoriDagilimi = categoryBreakdown;

/** "2026-10" for a timestamp, in local time. */
export function monthKey(ms: number): string {
	const d = new Date(ms);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export const ayAnahtari = monthKey;

/** Income and expense of the last `count` calendar months up to `now`, oldest first. */
export function monthlyFlow(rows: VaultRow[], now: number, count = 6) {
	const d = new Date(now);
	const months: { ay: string; gelir: number; gider: number }[] = [];
	for (let i = count - 1; i >= 0; i--) {
		const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
		months.push({ ay: monthKey(m.getTime()), gelir: 0, gider: 0 });
	}
	const byKey = new Map(months.map((m) => [m.ay, m]));
	for (const r of rows) {
		const m = byKey.get(monthKey(r.date));
		if (m) m[r.tur] += r.tutarKurus;
	}
	return months;
}
export const aylikAkis = monthlyFlow;

export interface VaultFilter {
	tur?: 'hepsi' | 'gelir' | 'gider';
	kategori?: string;
	/** "2026-10"; empty for all months. */
	ay?: string;
	/** Already folded search text (see foldTr); matched against description, category and recorder. */
	arama?: string;
	fold?: (s: string) => string;
}

export function filterRecords<T extends VaultRow>(rows: T[], f: VaultFilter): T[] {
	const fold = f.fold ?? ((s: string) => s.toLocaleLowerCase('tr'));
	const q = f.arama?.trim() ? fold(f.arama.trim()) : '';
	return rows.filter(
		(r) =>
			(!f.tur || f.tur === 'hepsi' || r.tur === f.tur) &&
			(!f.kategori || r.kategori === f.kategori) &&
			(!f.ay || ayAnahtari(r.date) === f.ay) &&
			(!q || fold(`${r.aciklama} ${r.kategori} ${r.kaydedenAdSoyad ?? ''}`).includes(q)),
	);
}

/** Bounds for a transaction date: not in the future (a day's slack for time zones), not older than three years. */
export function isValidDate(ms: number, now: number): boolean {
	return Number.isFinite(ms) && ms <= now + 86_400_000 && ms >= now - 3 * 365 * 86_400_000;
}

/**
 * A date picked in an `<input type="date">` as a timestamp: today keeps the
 * current time (so a new entry sorts after today's earlier ones); any other day
 * is taken at noon, which stays on that day in every time zone near ours.
 */
export function dateInputToMs(value: string, now: number): number | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!m) return null;
	const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
	if (Number.isNaN(d.getTime())) return null;
	const today = new Date(now);
	const sameDay =
		d.getFullYear() === today.getFullYear() &&
		d.getMonth() === today.getMonth() &&
		d.getDate() === today.getDate();
	return sameDay ? now : d.getTime();
}
