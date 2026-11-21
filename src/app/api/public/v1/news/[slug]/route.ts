import { getPublicNewsBySlug } from '@/db';
import { isoDate, limitPublic, publicError, publicImageUrl, publicJson, publicPreflight } from '@/lib/publicApi';
import { NEWS_CATEGORY_LABELS } from '@/types/news';

export const dynamic = 'force-dynamic';

export const OPTIONS = publicPreflight;

/**
 * `GET /api/public/v1/news/<slug>` — one published article, with its full text.
 * `content` is plain text: paragraphs are separated by blank lines, list items
 * start with "- ", and `**bold**` markers may appear; render it as text.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
	const limited = await limitPublic(request);
	if (limited) return limited;

	try {
		const { slug } = await params;
		// Slugs are lowercase ASCII words joined by dashes; anything else cannot exist.
		if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) {
			return publicError(request, 404, 'not_found', 'Article not found.');
		}

		const article = await getPublicNewsBySlug(slug);
		if (!article) return publicError(request, 404, 'not_found', 'Article not found.');

		return publicJson(request, {
			data: {
				id: article.id,
				slug: article.slug,
				title: article.title,
				summary: article.summary,
				content: article.content,
				category: { id: article.category, label: NEWS_CATEGORY_LABELS[article.category as keyof typeof NEWS_CATEGORY_LABELS] ?? NEWS_CATEGORY_LABELS.general },
				featured: article.isImportant === 1,
				imageUrl: publicImageUrl(article.imageUrl),
				publishedAt: isoDate(article.publishDate),
				updatedAt: isoDate(article.updatedAt),
			},
		});
	} catch (error) {
		console.error('API /api/public/v1/news/[slug] error:', error);
		return publicError(request, 500, 'server_error', 'Could not retrieve article at this time.');
	}
}
