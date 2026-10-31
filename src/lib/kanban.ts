/**
 * Kanban vocabulary and input rules, shared by the task API and the board.
 *
 * Kept free of imports so `scripts/check-pure.mjs` can load it directly.
 */

/** Board columns, in order. `inceleme` is "waiting for review". */
export const TASK_STATUSES = ['yapilacak', 'suruyor', 'inceleme', 'tamamlandi'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['dusuk', 'orta', 'yuksek', 'kritik'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** Higher means more urgent; used for sorting. */
export const ONCELIK_AGIRLIGI: Record<TaskPriority, number> = { dusuk: 0, orta: 1, yuksek: 2, kritik: 3 };

export const TITLE_MAX = 160;
export const DESCRIPTION_MAX = 4000;
export const ETIKET_MAX = 24;
export const ETIKET_SAYISI_MAX = 6;
export const MADDE_MAX = 200;
export const YORUM_MAX = 2000;

/**
 * Older clients sent `'bitti'` for "done" while the column stores `'tamamlandi'`.
 * Known aliases are mapped instead of persisting a value no client can filter on.
 */
const STATUS_ALIASES: Record<string, TaskStatus> = {
	bitti: 'tamamlandi',
	tamam: 'tamamlandi',
	done: 'tamamlandi',
	devam: 'suruyor',
	bekliyor: 'yapilacak',
	review: 'inceleme',
};

export function normalizeStatus(value: unknown): TaskStatus | null {
	if (typeof value !== 'string') return null;
	const key = value.trim().toLowerCase();
	if ((TASK_STATUSES as readonly string[]).includes(key)) return key as TaskStatus;
	return STATUS_ALIASES[key] ?? null;
}

export function normalizeOncelik(value: unknown): TaskPriority | null {
	if (typeof value !== 'string') return null;
	const key = value.trim().toLowerCase();
	return (TASK_PRIORITIES as readonly string[]).includes(key) ? (key as TaskPriority) : null;
}

/**
 * Labels: trimmed, lower-cased (Turkish-aware), inner whitespace turned into `-`,
 * capped in length and count, duplicates dropped. Anything that is not an array
 * of strings yields `null` so the caller can reject it.
 */
export function normalizeEtiketler(value: unknown): string[] | null {
	if (!Array.isArray(value)) return null;
	const out: string[] = [];
	for (const raw of value) {
		if (typeof raw !== 'string') return null;
		const label = raw
			.trim()
			.toLocaleLowerCase('tr-TR')
			.replace(/^#+/, '')
			.replace(/\s+/g, '-')
			.slice(0, ETIKET_MAX);
		if (label && !out.includes(label)) out.push(label);
		if (out.length === ETIKET_SAYISI_MAX) break;
	}
	return out;
}

/**
 * A due date as epoch millis, `null` for "none", or `undefined` when the input
 * is unusable. Accepts a number or an ISO date (`2026-10-12` means the end of
 * that day in local time, so a task due "on the 12th" is not overdue at 00:01).
 */
export function normalizeDueDate(value: unknown): number | null | undefined {
	if (value === null || value === '' || value === 0) return null;
	if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? Math.round(value) : undefined;
	if (typeof value === 'string') {
		const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
		if (m) {
			const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 0, 0);
			return Number.isNaN(d.getTime()) ? undefined : d.getTime();
		}
		const t = Date.parse(value);
		return Number.isNaN(t) ? undefined : t;
	}
	return undefined;
}

/** `YYYY-MM-DD` in local time, for `<input type="date">`. */
export function toDateInput(ms: number | null | undefined): string {
	if (!ms) return '';
	const d = new Date(ms);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The `sira` for a card dropped between two neighbours (either may be missing).
 * Smaller sorts higher. With no neighbours the card takes `fallback`.
 */
export function siraBetween(before: number | undefined, after: number | undefined, fallback: number): number {
	if (before === undefined && after === undefined) return fallback;
	if (before === undefined) return (after as number) - 1024;
	if (after === undefined) return before + 1024;
	return (before + after) / 2;
}

/**
 * Whether `mid` still sorts strictly between its neighbours. Halving a gap runs
 * out of floating-point precision after a few dozen drops into the same spot;
 * when it does, the column has to be renumbered instead (see `SIRA_ADIMI`).
 */
export function siraFits(before: number | undefined, mid: number, after: number | undefined): boolean {
	return (before === undefined || before < mid) && (after === undefined || mid < after);
}

/** Spacing used when a column is renumbered from scratch. */
export const SIRA_ADIMI = 1024;
/** Most cards a renumbering request may list. */
export const SIRALAMA_MAX = 500;

export type DueStatus = 'gecikti' | 'bugun' | 'yakin' | 'ileri';

const DAY = 86_400_000;

/** How pressing a due date is, relative to `now`. Done tasks are never late. */
export function dueStatus(
	teslimTarihi: number | null | undefined,
	status: TaskStatus,
	now: number
): DueStatus | null {
	if (!teslimTarihi || status === 'tamamlandi') return null;
	if (teslimTarihi < now) return 'gecikti';
	const start = new Date(now);
	start.setHours(0, 0, 0, 0);
	const endOfToday = start.getTime() + DAY;
	if (teslimTarihi < endOfToday) return 'bugun';
	if (teslimTarihi < endOfToday + 2 * DAY) return 'yakin';
	return 'ileri';
}
