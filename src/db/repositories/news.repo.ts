import type { Pool, PoolClient } from 'pg';
import { ensurePostgresInit, getPgPool } from '@/db/index';
import type { NewsItem } from '@/db/schema';
import { notificationEvents, publishEventQuiet } from '@/db/events';
import { slugify, uniqueSlug } from '@/lib/text';
import type { NewsVisibility } from '@/types/news';

function mapNews(r: Record<string, unknown>): NewsItem {
	return {
		...(r as unknown as NewsItem),
		onemliMi: Number(r.onemliMi),
		olusturma: Number(r.olusturma),
		guncellenme: Number(r.guncellenme),
		yayinTarihi: r.yayinTarihi === null || r.yayinTarihi === undefined ? null : Number(r.yayinTarihi),
	};
}

/**
 * The articles a reader may see, headlines first. `yonetim` (management) also gets
 * drafts; everyone else only what has been published to members or to the public.
 */
export async function getNews(audience: 'yonetim' | 'uye' = 'yonetim'): Promise<NewsItem[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(`
		SELECT h.*,
		       k.first_name || ' ' || k.last_name as "yazarAdSoyad"
		FROM news h
		LEFT JOIN users k ON h.yazarId = k.id
		${audience === 'yonetim' ? '' : "WHERE h.publishStatus <> 'taslak'"}
		ORDER BY h.onemliMi DESC, COALESCE(h.yayinTarihi, h.olusturma) DESC
	`);
	return res.rows.map(mapNews);
}

export async function getNewsById(id: string): Promise<NewsItem | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`
		SELECT h.*,
		       k.first_name || ' ' || k.last_name as "yazarAdSoyad"
		FROM news h
		LEFT JOIN users k ON h.yazarId = k.id
		WHERE h.id = $1
	`,
		[id]
	);
	return res.rows.length === 0 ? null : mapNews(res.rows[0]);
}

/** Slug for an article: its title, made unique. `exceptId` lets an article keep its own slug. */
async function newsSlug(client: Pool | PoolClient, baslik: string, exceptId?: string): Promise<string> {
	return uniqueSlug(
		slugify(baslik),
		async (candidate) =>
			((await client.query('SELECT 1 FROM news WHERE slug = $1 AND id <> $2', [candidate, exceptId ?? ''])).rowCount ?? 0) > 0,
		'haber'
	);
}

export async function createNews(params: {
	baslik: string;
	ozet: string;
	icerik: string;
	kategori?: string;
	onemliMi?: boolean | number;
	resimUrl?: string;
	publishStatus?: NewsVisibility;
	yazarId: string;
}): Promise<NewsItem> {
	await ensurePostgresInit();
	const p = getPgPool();
	const id = `hbr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
	const now = Date.now();
	const publishStatus: NewsVisibility = params.publishStatus ?? 'yayinda';

	for (let attempt = 0; ; attempt += 1) {
		const slug = await newsSlug(p, params.baslik.trim());
		try {
			await p.query(
				`INSERT INTO news (id, slug, baslik, ozet, icerik, kategori, onemliMi, resimUrl, publishStatus, yayinTarihi, yazarId, olusturma, guncellenme)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)`,
				[
					id,
					slug,
					params.baslik.trim(),
					params.ozet.trim(),
					params.icerik.trim(),
					params.kategori || 'genel',
					params.onemliMi ? 1 : 0,
					params.resimUrl || null,
					publishStatus,
					publishStatus === 'taslak' ? null : now,
					params.yazarId,
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
		baslik: string;
		ozet: string;
		icerik: string;
		kategori: string;
		onemliMi: boolean | number;
		resimUrl: string | null;
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

	if (patch.baslik !== undefined) add('baslik', patch.baslik.trim());
	if (patch.ozet !== undefined) add('ozet', patch.ozet.trim());
	if (patch.icerik !== undefined) add('icerik', patch.icerik.trim());
	if (patch.kategori !== undefined) add('kategori', patch.kategori);
	if (patch.onemliMi !== undefined) add('onemliMi', patch.onemliMi ? 1 : 0);
	if (patch.resimUrl !== undefined) add('resimUrl', patch.resimUrl || null);
	if (patch.publishStatus !== undefined) {
		add('publishStatus', patch.publishStatus);
		if (patch.publishStatus !== 'taslak') sets.push('yayinTarihi = COALESCE(yayinTarihi, $' + (values.length + 1) + ')');
		if (patch.publishStatus !== 'taslak') values.push(Date.now());
	}
	add('guncellenme', Date.now());

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
	const conditions = ["h.publishStatus = 'yayinda'", 'h.yayinTarihi <= $1'];
	const values: unknown[] = [Date.now()];
	if (query.category) {
		values.push(query.category);
		conditions.push(`h.kategori = $${values.length}`);
	}
	if (query.featured) conditions.push('h.onemliMi = 1');
	const where = conditions.join(' AND ');

	const total = await getPgPool().query(`SELECT count(*)::int AS n FROM news h WHERE ${where}`, values);
	values.push(query.pageSize, (query.page - 1) * query.pageSize);
	const rows = await getPgPool().query(
		`SELECT h.* FROM news h WHERE ${where}
		 ORDER BY h.yayinTarihi DESC, h.id ASC
		 LIMIT $${values.length - 1} OFFSET $${values.length}`,
		values
	);
	return { rows: rows.rows.map(mapNews), total: total.rows[0].n };
}

export async function getPublicNewsBySlug(slug: string): Promise<NewsItem | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT h.* FROM news h WHERE h.slug = $1 AND h.publishStatus = 'yayinda' AND h.yayinTarihi <= $2`,
		[slug, Date.now()]
	);
	return res.rows.length === 0 ? null : mapNews(res.rows[0]);
}

export async function getPublicNewsCategoryCounts(): Promise<{ kategori: string; sayi: number }[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT kategori, count(*)::int AS sayi FROM news
		 WHERE publishStatus = 'yayinda' AND yayinTarihi <= $1 GROUP BY kategori`,
		[Date.now()]
	);
	return res.rows;
}

export async function deleteNews(id: string): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query('DELETE FROM news WHERE id = $1', [id]);
	return (res.rowCount ?? 0) > 0;
}
