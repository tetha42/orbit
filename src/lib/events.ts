/**
 * Event attendance vocabulary and pure helpers, shared by the API and the app.
 *
 * Kept free of imports so `scripts/check-pure.mjs` can load it directly; the
 * signing itself lives in `src/lib/server/attendanceToken.ts`.
 */

export const EVENT_TYPES = ['atolye', 'seminer', 'yarisma', 'toplanti'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** `taslak` is visible to management only; `iptal` stays listed, marked as cancelled. */
export const EVENT_STATUSES = ['taslak', 'yayinda', 'tamamlandi', 'iptal'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

/** How attendance was recorded: the rotating projector QR, a ticket scanned at the door, or by hand. */
export type AttendanceMethod = 'qr' | 'bilet' | 'manuel';

/** XP for attending, paid once per member and event. Registering pays nothing. */
export const PARTICIPATION_XP = 150;

/** The projector QR changes every window; the previous window is still accepted. */
export const ATTENDANCE_WINDOW_MS = 30_000;

/** Check-in is possible from this long before the start until this long after the end. */
export const ATTENDANCE_TOLERANCE_MS = 30 * 60_000;

export const EVENT_TITLE_MAX = 140;
export const EVENT_DESCRIPTION_MAX = 4000;
export const KAPASITE_MAX = 5000;

export function attendanceWindow(now: number): number {
	return Math.floor(now / ATTENDANCE_WINDOW_MS);
}

/** Milliseconds until the current window rolls over — the projector's countdown. */
export function windowRemainingMs(now: number): number {
	return ATTENDANCE_WINDOW_MS - (now % ATTENDANCE_WINDOW_MS);
}

/** Whether check-in can happen at `now` for an event running from `baslangic` to `endTime`. */
export function isAttendanceTime(baslangic: number, endTime: number, now: number): boolean {
	return now >= baslangic - ATTENDANCE_TOLERANCE_MS && now <= endTime + ATTENDANCE_TOLERANCE_MS;
}

/** A projector code: which event, which time window, and the server's signature over both. */
export interface AttendanceCode {
	etkinlikId: string;
	pencere: number;
	imza: string;
}

/** A member's ticket: which event, whose, and the server's signature over both. */
export interface TicketCode {
	etkinlikId: string;
	userId: string;
	imza: string;
}

const ID = '[A-Za-z0-9_-]{1,80}';
const SIG = '[A-Za-z0-9_-]{16,64}';
const ATTENDANCE_RE = new RegExp(`^BY1\\.(${ID})\\.(\\d{1,12})\\.(${SIG})$`);
const TICKET_RE = new RegExp(`^BB1\\.(${ID})\\.(${ID})\\.(${SIG})$`);

/** The token part of a scan: either the bare token or the last path segment of a `/yoklama/<token>` link. */
function tokenOf(text: string): string {
	const trimmed = text.trim();
	const m = /\/yoklama\/([^/?#\s]+)/.exec(trimmed);
	return m ? decodeURIComponent(m[1]) : trimmed;
}

export function attendanceCodeText(k: AttendanceCode): string {
	return `BY1.${k.etkinlikId}.${k.pencere}.${k.imza}`;
}

export function ticketCodeText(k: TicketCode): string {
	return `BB1.${k.etkinlikId}.${k.userId}.${k.imza}`;
}

export function parseAttendanceCode(text: unknown): AttendanceCode | null {
	if (typeof text !== 'string') return null;
	const m = ATTENDANCE_RE.exec(tokenOf(text));
	return m ? { etkinlikId: m[1], pencere: Number(m[2]), imza: m[3] } : null;
}

export function parseTicketCode(text: unknown): TicketCode | null {
	if (typeof text !== 'string') return null;
	const m = TICKET_RE.exec(text.trim());
	return m ? { etkinlikId: m[1], userId: m[2], imza: m[3] } : null;
}

/**
 * One CSV cell. Quotes when needed, and neutralises values a spreadsheet would
 * run as a formula (`=`, `+`, `-`, `@`, tab, CR) — a member's name is user input.
 */
export function csvCell(value: string | number | null | undefined): string {
	let s = value === null || value === undefined ? '' : String(value);
	if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
	return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows to CSV with a header line; `;` because Turkish Excel expects it. */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
	return [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n');
}
