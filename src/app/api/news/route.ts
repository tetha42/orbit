import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { getNews, getNewsById, createNews, updateNews, deleteNews, getPgPool } from '@/db';
import { notificationEvents, publishEventQuiet } from '@/db/olaylar';
import { can, requireApp } from '@/lib/auth/access';
import {
	NEWS_LIMITS,
	isNewsCategory,
	isNewsVisibility,
	isSafeImageUrl,
	type NewsVisibility,
} from '@/types/news';

export const dynamic = 'force-dynamic';

/** What a create or edit request may carry, after checking. `undefined` means "leave as it is". */
interface NewsInput {
	baslik?: string;
	ozet?: string;
	icerik?: string;
	kategori?: string;
	onemliMi?: boolean;
	resimUrl?: string | null;
	publishStatus?: NewsVisibility;
}

// Both variants declare the other's field as `never`: with `strict` off TypeScript does not
// narrow a union on its literal `ok`, but it does on an optional `never` field.
type Parsed = { ok: true; value: NewsInput; error?: never } | { ok: false; error: string; value?: never };

function text(raw: unknown, label: string, max: number, required: boolean): { value?: string; error?: string } {
	if (raw === undefined || raw === null) {
		return required ? { error: `${label} zorunludur.` } : {};
	}
	if (typeof raw !== 'string') return { error: `${label} metin olmalıdır.` };
	const value = raw.trim();
	if (required && !value) return { error: `${label} zorunludur.` };
	if (value.length > max) return { error: `${label} en fazla ${max} karakter olabilir.` };
	return { value };
}

/**
 * Checks a request body against the article's rules. For a create every required
 * field must be present; for an edit (`partial`) only the fields that are present
 * are checked and applied.
 */
function parseNewsInput(body: Record<string, unknown>, partial: boolean): Parsed {
	const out: NewsInput = {};

	const title = text(body.baslik, 'Başlık', NEWS_LIMITS.baslik, !partial);
	if (title.error) return { ok: false, error: title.error };
	if (title.value !== undefined) out.baslik = title.value;

	const content = text(body.icerik, 'NewsItem metni', NEWS_LIMITS.icerik, !partial);
	if (content.error) return { ok: false, error: content.error };
	if (content.value !== undefined) out.icerik = content.value;

	const summary = text(body.ozet, 'Özet', NEWS_LIMITS.ozet, false);
	if (summary.error) return { ok: false, error: summary.error };
	if (summary.value) out.ozet = summary.value;
	// A create without a summary uses the title, as the form always did.
	else if (!partial && out.baslik) out.ozet = out.baslik.slice(0, NEWS_LIMITS.ozet);

	if (body.kategori !== undefined) {
		if (!isNewsCategory(body.kategori)) return { ok: false, error: 'Geçersiz kategori.' };
		out.kategori = body.kategori;
	} else if (!partial) {
		out.kategori = 'genel';
	}

	if (body.onemliMi !== undefined) out.onemliMi = Boolean(body.onemliMi);

	if (body.resimUrl !== undefined) {
		const url = typeof body.resimUrl === 'string' ? body.resimUrl.trim() : '';
		if (url && !isSafeImageUrl(url)) {
			return { ok: false, error: 'Görsel adresi https:// ile başlamalı veya hazır şablonlardan biri olmalıdır.' };
		}
		out.resimUrl = url || null;
	}

	if (body.publishStatus !== undefined) {
		if (!isNewsVisibility(body.publishStatus)) return { ok: false, error: 'Geçersiz görünürlük.' };
		out.publishStatus = body.publishStatus;
	} else if (!partial) {
		out.publishStatus = 'yayinda';
	}

	return { ok: true, value: out };
}

/**
 * The articles the caller may read: those who manage news see everything
 * including drafts; readers see what was published to members or to everyone. Drafts and members-only
 * articles are not public — the landing site reads `/api/public/v1/news` instead.
 */
export async function GET(request: Request) {
	const auth = await requireApp(request, 'news', 'kullan');
	if (!auth.authorized) return auth.response;

	try {
		const manager = can(auth.user, 'news', 'yonet');
		const newsItems = await getNews(manager ? 'yonetim' : 'uye');
		return NextResponse.json(newsItems, { headers: { 'Cache-Control': 'no-store' } });
	} catch (error) {
		console.error('API /api/haberler GET error:', error);
		return NextResponse.json({ error: 'Haberler okunamadı.' }, { status: 500 });
	}
}

async function handlePOST(request: Request) {
	try {
		const auth = await requireApp(request, 'news', 'yonet');
		if (!auth.authorized) {
			return auth.response;
		}

		const body = await request.json().catch(() => null);
		if (!body || typeof body !== 'object') {
			return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
		}
		const parsed = parseNewsInput(body as Record<string, unknown>, false);
		if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
		const input = parsed.value;

		const result = await createNews({
			baslik: input.baslik!,
			ozet: input.ozet!,
			icerik: input.icerik!,
			kategori: input.kategori,
			onemliMi: input.onemliMi,
			resimUrl: input.resimUrl ?? undefined,
			publishStatus: input.publishStatus,
			yazarId: auth.user.id,
		});

		await publishEventQuiet(getPgPool(), [{ k: 'haber_guncellendi' }, ...notificationEvents()]);

		return NextResponse.json({
			...result,
			yazarAdSoyad: `${auth.user.ad} ${auth.user.soyad}`.trim(),
		});
	} catch (error) {
		console.error('API /api/haberler POST error:', error);
		return NextResponse.json({ error: 'NewsItem ve duyuru yayınlanamadı.' }, { status: 500 });
	}
}

/** Edits an article — its text, category, image or who can read it. Body: `{ id, …fields to change }`. */
async function handlePATCH(request: Request) {
	try {
		const auth = await requireApp(request, 'news', 'yonet');
		if (!auth.authorized) {
			return auth.response;
		}

		const body = await request.json().catch(() => null);
		if (!body || typeof body !== 'object' || typeof (body as { id?: unknown }).id !== 'string') {
			return NextResponse.json({ error: 'Düzenlenecek haber ID zorunludur.' }, { status: 400 });
		}
		const { id, ...fields } = body as { id: string } & Record<string, unknown>;

		const parsed = parseNewsInput(fields, true);
		if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
		if (Object.keys(parsed.value).length === 0) {
			return NextResponse.json({ error: 'Değiştirilecek bir alan belirtilmedi.' }, { status: 400 });
		}

		if (!(await getNewsById(id))) {
			return NextResponse.json({ error: 'NewsItem bulunamadı.' }, { status: 404 });
		}
		const updated = await updateNews(id, parsed.value);
		if (!updated) return NextResponse.json({ error: 'NewsItem bulunamadı.' }, { status: 404 });
		await publishEventQuiet(getPgPool(), [{ k: 'haber_guncellendi' }, ...notificationEvents()]);
		return NextResponse.json(updated);
	} catch (error) {
		console.error('API /api/haberler PATCH error:', error);
		return NextResponse.json({ error: 'NewsItem güncellenemedi.' }, { status: 500 });
	}
}

async function handleDELETE(request: Request) {
	try {
		const auth = await requireApp(request, 'news', 'yonet');
		if (!auth.authorized) {
			return auth.response;
		}

		const { searchParams } = new URL(request.url);
		const id = searchParams.get('id');

		if (!id) {
			return NextResponse.json({ error: 'Silinecek haber ID zorunludur.' }, { status: 400 });
		}

		const success = await deleteNews(id);
		if (success) await publishEventQuiet(getPgPool(), [{ k: 'haber_guncellendi' }, ...notificationEvents()]);
		return NextResponse.json({ success });
	} catch (error) {
		console.error('API /api/haberler DELETE error:', error);
		return NextResponse.json({ error: 'NewsItem silinemedi.' }, { status: 500 });
	}
}

export const POST = withAudit(handlePOST, { action: 'news.create', target: 'news' });
export const PATCH = withAudit(handlePATCH, { action: 'news.update', target: 'news' });
export const DELETE = withAudit(handleDELETE, { action: 'news.delete', target: 'news' });
