import type { Pool, PoolClient } from 'pg';
import { ensurePostgresInit, getPgPool } from '@/db/index';
import type { NewsItem } from '@/db/schema';
import { notificationEvents, publishEventQuiet } from '@/db/events';
import { slugify, uniqueSlug } from '@/lib/text';
import type { NewsVisibility } from '@/types/news';

const NEWS_COLUMNS = `
	h.id, h.slug, h.title AS baslik, h.summary AS ozet, h.content AS icerik, h.category AS kategori,
	h.is_pinned AS "onemliMi", h.cover_url AS "resimUrl",
	h.publish_status AS "publishStatus", h.published_at AS "yayinTarihi",
	h.author_id AS "yazarId", h.created_at AS olusturma, h.updated_at AS guncellenme
`;

function mapNews(r: Record<string, unknown>): NewsItem {
	return {
		...(r as unknown as NewsItem),
		importantMi: Number(r.importantMi),
		creation: Number(r.creation),
		update: Number(r.update),
		publishDate: r.publishDate === null || r.publishDate === undefined ? null : Number(r.publishDate),
	};
}

/**
 * The articles a reader may see, headlines first. `yonetim` (management) also gets
 * drafts; everyone else only what has been published to members or to the public.
 */
export async function getNews(audience: 'yonetim' | 'uye' = 'yonetim'): Promise<NewsItem[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(`
		SELECT ${NEWS_COLUMNS},
		       k.first_name || ' ' || k.last_name as "authorNameSurname"
		FROM news h
		LEFT JOIN users k ON h.author_id = k.id
		${audience === 'yonetim' ? '' : "WHERE h.publish_status <> 'taslak'"}
		ORDER BY h.is_pinned DESC, COALESCE(h.published_at, h.created_at) DESC
	`);
	return res.rows.map(mapNews);
}

export async function getNewsById(id: string): Promise<NewsItem | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`
		SELECT ${NEWS_COLUMNS},
		       k.first_name || ' ' || k.last_name as "authorNameSurname"
		FROM news h
		LEFT JOIN users k ON h.author_id = k.id
		WHERE h.id = $1
	`,
		[id]
	);
	return res.rows.length === 0 ? null : mapNews(res.rows[0]);
}

/** Slug for an article: its title, made unique. `exceptId` lets an article keep its own slug. */
async function newsSlug(client: Pool | PoolClient, title: string, exceptId?: string): Promise<string> {
	return uniqueSlug(
		slugify(title),
		async (candidate) =>
			((await client.query('SELECT 1 FROM news WHERE slug = $1 AND id <> $2', [candidate, exceptId ?? ''])).rowCount ?? 0) > 0,
		'haber'
	);
}

export async function createNews(params: {
	title: string;
	summary: string;
	content: string;
	category?: string;
	importantMi?: boolean | number;
	imageUrl?: string;
	publishStatus?: NewsVisibility;
	authorId: string;
}): Promise<NewsItem> {
	await ensurePostgresInit();
	const p = getPgPool();
	const id = `hbr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
	const now = Date.now();
	const publishStatus: NewsVisibility = params.publishStatus ?? 'yayinda';

	for (let attempt = 0; ; attempt += 1) {
		const slug = await newsSlug(p, params.title.trim());
		try {
			await p.query(
				`INSERT INTO news (id, slug, title, summary, content, category, is_pinned, cover_url, publish_status, published_at, author_id, created_at, updated_at)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)`,
				[
					id,
					slug,
					params.title.trim(),
					params.summary.trim(),
					params.content.trim(),
					params.category || 'genel',
					params.importantMi ? 1 : 0,
					params.imageUrl || null,
					publishStatus,
					publishStatus === 'taslak' ? null : now,
					params.authorId,
					now,
				]
			);
			break;
		} catch (error) {
			if ((error as { code?: string }).code === '23505' && attempt < 3) continue;
			throw error;
		}
	}

	if (publishStatus !== 'taslak') await publishEventQuiet(p, notificationEvents());
	return (await getNewsById(id)) as NewsItem;
}

export async function updateNews(
	id: string,
	patch: Partial<{
		title: string;
		summary: string;
		content: string;
		category: string;
		importantMi: boolean | number;
		imageUrl: string | null;
		publishStatus: NewsVisibility;
	}>
): Promise<NewsItem | null> {
	await ensurePostgresInit();
	const sets: string[] = [];
	const values: unknown[] = [];
	const add = (column: string, value: unknown) => {
		values.push(value);
		sets.push(`${column} = $${values.length}`);
	};

	if (patch.title !== undefined) add('title', patch.title.trim());
	if (patch.summary !== undefined) add('summary', patch.summary.trim());
	if (patch.content !== undefined) add('content', patch.content.trim());
	if (patch.category !== undefined) add('category', patch.category);
	if (patch.importantMi !== undefined) add('is_pinned', patch.importantMi ? 1 : 0);
	if (patch.imageUrl !== undefined) add('cover_url', patch.imageUrl || null);
	if (patch.publishStatus !== undefined) {
		add('publish_status', patch.publishStatus);
		if (patch.publishStatus !== 'taslak') sets.push('published_at = COALESCE(published_at, $' + (values.length + 1) + ')');
		if (patch.publishStatus !== 'taslak') values.push(Date.now());
	}
	add('updated_at', Date.now());

	values.push(id);
	const res = await getPgPool().query(
		`UPDATE news SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING id`,
		values
	);
	return res.rowCount ? getNewsById(id) : null;
}

export interface PublicNewsQuery {
	page: number;
	pageSize: number;
	category?: string;
	featured?: boolean;
}

export async function getPublicNews(query: PublicNewsQuery): Promise<{ rows: NewsItem[]; total: number }> {
	await ensurePostgresInit();
	const conditions = ["h.publish_status = 'yayinda'", 'h.published_at <= $1'];
	const values: unknown[] = [Date.now()];
	if (query.category) {
		values.push(query.category);
		conditions.push(`h.category = $${values.length}`);
	}
	if (query.featured) conditions.push('h.is_pinned = 1');
	const where = conditions.join(' AND ');

	const total = await getPgPool().query(`SELECT count(*)::int AS n FROM news h WHERE ${where}`, values);
	values.push(query.pageSize, (query.page - 1) * query.pageSize);
	const rows = await getPgPool().query(
		`SELECT ${NEWS_COLUMNS} FROM news h WHERE ${where}
		 ORDER BY h.published_at DESC, h.id ASC
		 LIMIT $${values.length - 1} OFFSET $${values.length}`,
		values
	);
	return { rows: rows.rows.map(mapNews), total: total.rows[0].n };
}

export async function getPublicNewsBySlug(slug: string): Promise<NewsItem | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT ${NEWS_COLUMNS} FROM news h WHERE h.slug = $1 AND h.publish_status = 'yayinda' AND h.published_at <= $2`,
		[slug, Date.now()]
	);
	return res.rows.length === 0 ? null : mapNews(res.rows[0]);
}

export async function getPublicNewsCategoryCounts(): Promise<{ category: string; count: number }[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT category AS category, count(*)::int AS count FROM news
		 WHERE publish_status = 'yayinda' AND published_at <= $1 GROUP BY category`,
		[Date.now()]
	);
	return res.rows;
}

export async function deleteNews(id: string): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query('DELETE FROM news WHERE id = $1', [id]);
	return (res.rowCount ?? 0) > 0;
}
