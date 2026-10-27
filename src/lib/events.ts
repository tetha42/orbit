/**
 * Event attendance vocabulary and pure helpers, shared by the API and the app.
 *
 * Kept free of imports so `scripts/check-pure.mjs` can load it directly; the
 * signing itself lives in `src/lib/server/attendanceToken.ts`.
 */

export const ETKINLIK_TURLERI = ['atolye', 'seminer', 'yarisma', 'toplanti'] as const;
export type EventType = (typeof ETKINLIK_TURLERI)[number];

/** `taslak` is visible to management only; `iptal` stays listed, marked as cancelled. */
export const ETKINLIK_DURUMLARI = ['taslak', 'yayinda', 'tamamlandi', 'iptal'] as const;
export type EventStatus = (typeof ETKINLIK_DURUMLARI)[number];

/** How attendance was recorded: the rotating projector QR, a ticket scanned at the door, or by hand. */
export type AttendanceMethod = 'qr' | 'bilet' | 'manuel';

/** XP for attending, paid once per member and event. Registering pays nothing. */
export const KATILIM_XP = 150;

/** The projector QR changes every window; the previous window is still accepted. */
export const YOKLAMA_PENCERESI_MS = 30_000;

/** Check-in is possible from this long before the start until this long after the end. */
export const YOKLAMA_TOLERANS_MS = 30 * 60_000;

export const ETKINLIK_BASLIK_MAX = 140;
export const ETKINLIK_ACIKLAMA_MAX = 4000;
export const KAPASITE_MAX = 5000;

export function yoklamaPenceresi(now: number): number {
	return Math.floor(now / YOKLAMA_PENCERESI_MS);
}

/** Milliseconds until the current window rolls over — the projector's countdown. */
export function pencereKalanMs(now: number): number {
	return YOKLAMA_PENCERESI_MS - (now % YOKLAMA_PENCERESI_MS);
}

/** Whether check-in can happen at `now` for an event running from `baslangic` to `endTime`. */
export function yoklamaZamaniMi(baslangic: number, endTime: number, now: number): boolean {
	return now >= baslangic - YOKLAMA_TOLERANS_MS && now <= endTime + YOKLAMA_TOLERANS_MS;
}

/** A projector code: which event, which time window, and the server's signature over both. */
export interface YoklamaKodu {
	etkinlikId: string;
	pencere: number;
	imza: string;
}

/** A member's ticket: which event, whose, and the server's signature over both. */
export interface BiletKodu {
	etkinlikId: string;
	userId: string;
	imza: string;
}

const ID = '[A-Za-z0-9_-]{1,80}';
const SIG = '[A-Za-z0-9_-]{16,64}';
const YOKLAMA_RE = new RegExp(`^BY1\\.(${ID})\\.(\\d{1,12})\\.(${SIG})$`);
const BILET_RE = new RegExp(`^BB1\\.(${ID})\\.(${ID})\\.(${SIG})$`);

/** The token part of a scan: either the bare token or the last path segment of a `/yoklama/<token>` link. */
function tokenOf(text: string): string {
	const trimmed = text.trim();
	const m = /\/yoklama\/([^/?#\s]+)/.exec(trimmed);
	return m ? decodeURIComponent(m[1]) : trimmed;
}

export function yoklamaKoduMetni(k: YoklamaKodu): string {
	return `BY1.${k.etkinlikId}.${k.pencere}.${k.imza}`;
}

export function biletKoduMetni(k: BiletKodu): string {
	return `BB1.${k.etkinlikId}.${k.userId}.${k.imza}`;
}

export function parseYoklamaKodu(text: unknown): YoklamaKodu | null {
	if (typeof text !== 'string') return null;
	const m = YOKLAMA_RE.exec(tokenOf(text));
	return m ? { etkinlikId: m[1], pencere: Number(m[2]), imza: m[3] } : null;
}

export function parseBiletKodu(text: unknown): BiletKodu | null {
	if (typeof text !== 'string') return null;
	const m = BILET_RE.exec(text.trim());
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
