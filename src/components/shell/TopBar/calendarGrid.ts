/**
 * Month-grid arithmetic for the clock's calendar panel. Pure (no imports), all in the
 * viewer's local time zone: a day is the local calendar day, whatever the server's clock says.
 */

export interface DayCell {
	/** `YYYY-MM-DD`, local. */
	key: string;
	year: number;
	month: number;
	day: number;
	/** The day belongs to the month on show (the rest are the neighbouring months' filler). */
	inMonth: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function parseDayKey(key: string): Date {
	const [y, m, d] = key.split('-').map(Number);
	return new Date(y, m - 1, d);
}

/** Weeks start on Monday in Turkish, on Sunday in English (0 = Sunday). */
export const weekStartOf = (language: string): number => (language === 'en' ? 0 : 1);

export const localeOf = (language: string): string => (language === 'en' ? 'en-US' : 'tr-TR');

/** Six full weeks — a fixed height, so the panel does not jump between months. */
export function monthGrid(year: number, month: number, weekStart: number): DayCell[] {
	const lead = (new Date(year, month, 1).getDay() - weekStart + 7) % 7;
	return Array.from({ length: 42 }, (_, i) => {
		const d = new Date(year, month, 1 - lead + i);
		return { key: dayKey(d), year: d.getFullYear(), month: d.getMonth(), day: d.getDate(), inMonth: d.getMonth() === month && d.getFullYear() === year };
	});
}

/** Short weekday names in the order the grid shows them. */
export function weekdayLabels(language: string, weekStart: number): string[] {
	const fmt = new Intl.DateTimeFormat(localeOf(language), { weekday: 'short' });
	// 2023-01-01 was a Sunday.
	return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2023, 0, 1 + ((weekStart + i) % 7))));
}

export const monthTitle = (language: string, year: number, month: number): string =>
	new Intl.DateTimeFormat(localeOf(language), { month: 'long', year: 'numeric' }).format(new Date(year, month, 1));

export const dayLong = (language: string, d: Date): string =>
	new Intl.DateTimeFormat(localeOf(language), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);

export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** A month move keeps the day of the month, clamped to the target month's length. */
export function addMonths(d: Date, n: number): Date {
	const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
	const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
	return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last));
}

/** Every local day an event touches, from its start to its end. */
export function daysOfEvent(start: number, end: number): string[] {
	const lastKey = dayKey(new Date(Math.max(start, end)));
	const first = new Date(start);
	const out: string[] = [];
	let d = new Date(first.getFullYear(), first.getMonth(), first.getDate());
	for (let i = 0; i < 62; i++) {
		const k = dayKey(d);
		out.push(k);
		if (k === lastKey) break;
		d = addDays(d, 1);
	}
	return out;
}
