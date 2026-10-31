/**
 * Date and number formatting — one place instead of a `toLocaleDateString`
 * with slightly different options in every app. Pure (no imports).
 */

export type Locale = 'tr' | 'en';
const tag = (l: Locale | string | undefined) => (l === 'en' || l === 'en-US' ? 'en-US' : 'tr-TR');

/** 06.10.2026 */
export const formatDate = (ms: number, locale?: Locale | string) => new Date(ms).toLocaleDateString(tag(locale), { day: '2-digit', month: '2-digit', year: 'numeric' });

/** 6 Ekim 2026 */
export const formatDateLong = (ms: number, locale?: Locale | string) => new Date(ms).toLocaleDateString(tag(locale), { day: 'numeric', month: 'long', year: 'numeric' });

/** 06.10.2026 14:05 */
export const formatDateTime = (ms: number, locale?: Locale | string) =>
	new Date(ms).toLocaleString(tag(locale), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** 14:05 */
export const formatTime = (ms: number, locale?: Locale | string) => new Date(ms).toLocaleTimeString(tag(locale), { hour: '2-digit', minute: '2-digit' });

const DAY = 86_400_000;

/** Whole calendar days from `now` to `ts` in the local time zone: 0 today, 1 tomorrow, -1 yesterday. */
export function dayOffset(ts: number, now: number): number {
	const a = new Date(ts);
	a.setHours(0, 0, 0, 0);
	const b = new Date(now);
	b.setHours(0, 0, 0, 0);
	// Rounded, because a day is 23 or 25 hours long when the clocks change.
	return Math.round((a.getTime() - b.getTime()) / DAY);
}

/** "2 saat önce" / "in 3 days" — the coarsest unit that still reads naturally. */
export function relativeTime(ts: number, now: number, locale: string): string {
	const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
	const diff = ts - now;
	const abs = Math.abs(diff);
	if (abs < 60_000) return rtf.format(0, 'second');
	if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), 'minute');
	if (abs < DAY) return rtf.format(Math.round(diff / 3_600_000), 'hour');
	return rtf.format(dayOffset(ts, now), 'day');
}

/** "12.4 MB" / "0 B" — human-readable byte sizing. Pure (no imports). */
export function formatBytes(bytes?: number): string {
	if (!bytes || bytes <= 0 || !Number.isFinite(bytes)) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	const unitIndex = Math.min(i, units.length - 1);
	const value = bytes / Math.pow(1024, unitIndex);
	return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

