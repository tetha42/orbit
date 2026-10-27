import { getPublicNewsCategoryCounts, getPublicNews } from '@/db';
import { isoDate, limitPublic, publicError, publicImageUrl, publicJson, publicPreflight } from '@/lib/publicApi';
import { NEWS_CATEGORY_IDS, NEWS_CATEGORY_LABELS, isNewsCategory } from '@/types/news';

export const dynamic = 'force-dynamic';

export const OPTIONS = publicPreflight;

const MAX_PAGE_SIZE = 24;
const DEFAULT_PAGE_SIZE = 12;

/** Reads a positive integer query parameter; `undefined` when absent, `null` when present but invalid. */
function positiveInt(value: string | null, max: number): number | undefined | null {
	if (value === null || value === '') return undefined;
	if (!/^\d+$/.test(value)) return null;
	const parsed = Number(value);
	return parsed >= 1 && parsed <= max ? parsed : null;
}

/**
 * `GET /api/public/v1/news` — published articles, newest first.
 *
 * Query: `page` (default 1), `pageSize` (1–24, default 12), `category` (one of the
 * category ids), `featured` (`1`/`true`: only "önemli" articles). Drafts and
 * members-only articles never appear here.
 */
export async function GET(request: Request) {
	const limited = await limitPublic(request);
	if (limited) return limited;

	try {
		const params = new URL(request.url).searchParams;

		const page = positiveInt(params.get('page'), 10_000);
		const pageSize = positiveInt(params.get('pageSize'), MAX_PAGE_SIZE);
		if (page === null) return publicError(request, 400, 'invalid_page', 'page 1 veya daha büyük bir tam sayı olmalıdır.');
		if (pageSize === null) {
			return publicError(request, 400, 'invalid_page_size', `pageSize 1 ile ${MAX_PAGE_SIZE} arasında bir tam sayı olmalıdır.`);
		}

		const category = params.get('category');
		if (category && !isNewsCategory(category)) {
			return publicError(request, 400, 'invalid_category', `category şunlardan biri olmalıdır: ${NEWS_CATEGORY_IDS.join(', ')}.`);
		}
		const featuredParam = params.get('featured');
		const featured = featuredParam === '1' || featuredParam === 'true';

		const effectivePage = page ?? 1;
		const effectiveSize = pageSize ?? DEFAULT_PAGE_SIZE;
		const [{ rows, total }, counts] = await Promise.all([
			getPublicNews({ page: effectivePage, pageSize: effectiveSize, category: category ?? undefined, featured }),
			getPublicNewsCategoryCounts(),
		]);

		const countOf = new Map(counts.map((row) => [row.kategori, row.sayi]));
		return publicJson(request, {
			data: rows.map((article) => ({
				id: article.id,
				slug: article.slug,
				title: article.baslik,
				summary: article.ozet,
				category: { id: article.kategori, label: NEWS_CATEGORY_LABELS[article.kategori as keyof typeof NEWS_CATEGORY_LABELS] ?? NEWS_CATEGORY_LABELS.genel },
				featured: article.onemliMi === 1,
				imageUrl: publicImageUrl(article.resimUrl),
				publishedAt: isoDate(article.yayinTarihi),
				updatedAt: isoDate(article.guncellenme),
			})),
			meta: { page: effectivePage, pageSize: effectiveSize, total, totalPages: Math.max(1, Math.ceil(total / effectiveSize)) },
			categories: NEWS_CATEGORY_IDS.map((id) => ({ id, label: NEWS_CATEGORY_LABELS[id], count: countOf.get(id) ?? 0 })),
		});
	} catch (error) {
		console.error('API /api/public/v1/news error:', error);
		return publicError(request, 500, 'server_error', 'Haberler şu anda getirilemedi.');
	}
}
