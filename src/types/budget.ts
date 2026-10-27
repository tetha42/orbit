/**
 * Canonical budget categories.
 *
 * Defined once so the form, the API and the stored type agree. The form
 * previously accepted free text while the type declared a fixed set — so any
 * category a user invented was silently outside the type and broke the
 * per-category summaries.
 */
export const BUTCE_KATEGORILERI = [
	'İkram',
	'Afiş/Baskı',
	'Sponsorluk',
	'Donanım',
	'Ulaşım',
	'Diğer',
] as const;

export type BudgetCategory = (typeof BUTCE_KATEGORILERI)[number];

/**
 * The category of the two rows an allocation writes (one in each kasa). It is not
 * in BUTCE_KATEGORILERI on purpose: an ordinary entry cannot claim to be one.
 */
export const AKTARIM_KATEGORISI = 'Ödenek Aktarımı' as const;

/** Any category a stored row can carry. */
export type KayitKategorisi = BudgetCategory | typeof AKTARIM_KATEGORISI;

export function isButceKategorisi(value: unknown): value is BudgetCategory {
	return typeof value === 'string' && (BUTCE_KATEGORILERI as readonly string[]).includes(value);
}

/**
 * Largest single entry: 20,000,000 TL in kuruş. `tutarKurus` is a 32-bit INTEGER
 * column, so this also keeps a sum of entries from ever overflowing it.
 */
export const MAX_TUTAR_KURUS = 2_000_000_000;

/** One cash box: the club's general kasa, or the kasa of a single project (takım). */
export interface KasaSummary {
	/** `null` is the general kasa. */
	teamId: string | null;
	ad: string;
	kind: 'genel' | 'proje';
	toplamGelirKurus: number;
	toplamGiderKurus: number;
	netBakiyeKurus: number;
	kayitSayisi: number;
}
