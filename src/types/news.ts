/**
 * The vocabulary of news articles, shared by the portal's News app, its API and the
 * public API the landing site reads.
 */

export const NEWS_CATEGORY_IDS = ['genel', 'teknofest', 'atolye', 'isbirligi', 'resmi'] as const;
export type NewsCategoryId = (typeof NEWS_CATEGORY_IDS)[number];

/** The labels the public API returns. The News app keeps shorter labels of its own, with icons. */
export const NEWS_CATEGORY_LABELS: Record<NewsCategoryId, string> = {
	genel: 'Genel Duyuru & NewsItem',
	teknofest: 'TEKNOFEST & Yarışmalar',
	atolye: 'Atölye & Eğitim',
	isbirligi: 'İş Birliği & Sponsorluk',
	resmi: 'Rektörlük & SKS Resmi Bildirimi',
};

export function isNewsCategory(value: unknown): value is NewsCategoryId {
	return typeof value === 'string' && (NEWS_CATEGORY_IDS as readonly string[]).includes(value);
}

/**
 * Who can read an article:
 *  - `taslak`: a draft — management only, in the portal.
 *  - `uyeler`: signed-in club members, in the portal.
 *  - `yayinda`: everyone — the portal and the public API (and so the landing site).
 */
export const NEWS_VISIBILITIES = ['taslak', 'uyeler', 'yayinda'] as const;
export type NewsVisibility = (typeof NEWS_VISIBILITIES)[number];

export const NEWS_VISIBILITY_LABELS: Record<NewsVisibility, string> = {
	taslak: 'Taslak',
	uyeler: 'Sadece üyeler',
	yayinda: 'Herkese açık',
};

export function isNewsVisibility(value: unknown): value is NewsVisibility {
	return typeof value === 'string' && (NEWS_VISIBILITIES as readonly string[]).includes(value);
}

/** Length caps, enforced by the API and mirrored by the form. */
export const NEWS_LIMITS = { baslik: 200, ozet: 500, icerik: 20_000, resimUrl: 500 } as const;

/**
 * Whether `url` may be stored as an article image: an `https://` address, or one of
 * the portal's own icon presets. The value ends up inside a CSS `url(...)`, so
 * anything that could close the parenthesis or the quote is refused outright.
 */
export function isSafeImageUrl(url: string): boolean {
	if (url.length > NEWS_LIMITS.resimUrl) return false;
	if (/^https:\/\/[^\s"'()<>\\]+$/.test(url)) return true;
	return /^\/app-icons\/[A-Za-z0-9._/-]+$/.test(url) && !url.includes('..');
}
