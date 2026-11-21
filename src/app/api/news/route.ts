import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { getNews, getNewsById, createNews, updateNews, deleteNews, getPgPool } from '@/db';
import { notificationEvents, publishEventQuiet } from '@/db/events';
import { can, requireApp } from '@/lib/auth/access';
import {
	NEWS_LIMITS,
	isNewsCategory,
	isNewsVisibility,
	isSafeImageUrl,
	type NewsVisibility,
} from '@/types/news';
import newsContract from '@/apps/news/news.contract.json';
import { contractErrorResponse } from '@/contracts/helpers';

export const dynamic = 'force-dynamic';

/** What a create or edit request may carry, after checking. `undefined` means "leave as it is". */
interface NewsInput {
	title?: string;
	summary?: string;
	content?: string;
	category?: string;
	isImportant?: boolean;
	imageUrl?: string | null;
	publishStatus?: NewsVisibility;
}

// Both variants declare the other's field as `never`: with `strict` off TypeScript does not
// narrow a union on its literal `ok`, but it does on an optional `never` field.
type Parsed = { ok: true; value: NewsInput; error?: never } | { ok: false; error: string; value?: never };

function text(raw: unknown, label: string, max: number, required: boolean): { value?: string; error?: string } {
	if (raw === undefined || raw === null) {
		return required ? { error: `${label} is required.` } : {};
	}
	if (typeof raw !== 'string') return { error: `${label} must be text.` };
	const value = raw.trim();
	if (required && !value) return { error: `${label} is required.` };
	if (value.length > max) return { error: `${label} can be at most ${max} characters.` };
	return { value };
}

/**
 * Checks a request body against the article's rules. For a create every required
 * field must be present; for an edit (`partial`) only the fields that are present
 * are checked and applied.
 */
function parseNewsInput(body: Record<string, unknown>, partial: boolean): Parsed {
	const out: NewsInput = {};

	const title = text(body.title, 'Title', Math.min(NEWS_LIMITS.title, newsContract.limits.maxTitleLength), !partial);
	if (title.error) return { ok: false, error: title.error };
	if (title.value !== undefined) out.title = title.value;

	const content = text(body.content, 'Content', NEWS_LIMITS.content, !partial);
	if (content.error) return { ok: false, error: content.error };
	if (content.value !== undefined) out.content = content.value;

	const maxSummary = Math.min(NEWS_LIMITS.summary, newsContract.limits.maxSummaryLength);
	const summary = text(body.summary, 'Summary', maxSummary, false);
	if (summary.error) return { ok: false, error: summary.error };
	if (summary.value) out.summary = summary.value;
	// A create without a summary uses the title, as the form always did.
	else if (!partial && out.title) out.summary = out.title.slice(0, maxSummary);

	if (body.category !== undefined) {
		if (!isNewsCategory(body.category)) return { ok: false, error: 'Invalid category.' };
		out.category = body.category;
	} else if (!partial) {
		out.category = 'general';
	}

	if (body.isImportant !== undefined) out.isImportant = Boolean(body.isImportant);

	if (body.imageUrl !== undefined) {
		const url = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';
		if (url && !isSafeImageUrl(url)) {
			return { ok: false, error: 'Image URL must start with https:// or be one of the preset templates.' };
		}
		out.imageUrl = url || null;
	}

	if (body.publishStatus !== undefined) {
		if (!isNewsVisibility(body.publishStatus)) return { ok: false, error: 'Invalid visibility.' };
		out.publishStatus = body.publishStatus;
	} else if (!partial) {
		out.publishStatus = 'published';
	}

	return { ok: true, value: out };
}

/**
 * The articles the caller may read: those who manage news see everything
 * including drafts; readers see what was published to members or to everyone. Drafts and members-only
 * articles are not public — the landing site reads `/api/public/v1/news` instead.
 */
export async function GET(request: Request) {
	const auth = await requireApp(request, 'news', 'use');
	if (!auth.authorized) return auth.response;

	try {
		const manager = can(auth.user, 'news', 'manage');
		const newsItems = await getNews(manager ? 'management' : 'member');
		return NextResponse.json(newsItems, { headers: { 'Cache-Control': 'no-store' } });
	} catch (error) {
		console.error('API /api/news GET error:', error);
		return NextResponse.json({ error: 'Failed to load news.' }, { status: 500 });
	}
}

async function handlePOST(request: Request) {
	try {
		const auth = await requireApp(request, 'news', 'manage');
		if (!auth.authorized) {
			return auth.response;
		}

		const body = await request.json().catch(() => null);
		if (!body || typeof body !== 'object') {
			return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
		}
		const parsed = parseNewsInput(body as Record<string, unknown>, false);
		if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
		const input = parsed.value;

		const result = await createNews({
			title: input.title!,
			summary: input.summary!,
			content: input.content!,
			category: input.category,
			isImportant: input.isImportant,
			imageUrl: input.imageUrl ?? undefined,
			publishStatus: input.publishStatus,
			authorId: auth.user.id,
		});

		await publishEventQuiet(getPgPool(), [{ k: 'news_updated' }, ...notificationEvents()]);

		return NextResponse.json({
			...result,
			authorName: `${auth.user.firstName || auth.user.name || ''} ${auth.user.lastName || auth.user.surname || ''}`.trim(),
		});
	} catch (error) {
		if ((error as { code?: string })?.code === '23505') {
			return contractErrorResponse(newsContract, 'SLUG_ALREADY_EXISTS');
		}
		console.error('API /api/news POST error:', error);
		return NextResponse.json({ error: 'Failed to publish news.' }, { status: 500 });
	}
}

/** Edits an article — its text, category, image or who can read it. Body: `{ id, …fields to change }`. */
async function handlePATCH(request: Request) {
	try {
		const auth = await requireApp(request, 'news', 'manage');
		if (!auth.authorized) {
			return auth.response;
		}

		const body = await request.json().catch(() => null);
		if (!body || typeof body !== 'object' || typeof (body as { id?: unknown }).id !== 'string') {
			return NextResponse.json({ error: 'News ID to update is required.' }, { status: 400 });
		}
		const { id, ...fields } = body as { id: string } & Record<string, unknown>;

		const parsed = parseNewsInput(fields, true);
		if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
		if (Object.keys(parsed.value).length === 0) {
			return NextResponse.json({ error: 'No fields to update were specified.' }, { status: 400 });
		}

		if (!(await getNewsById(id))) {
			return contractErrorResponse(newsContract, 'NEWS_NOT_FOUND');
		}
		const updated = await updateNews(id, parsed.value);
		if (!updated) return contractErrorResponse(newsContract, 'NEWS_NOT_FOUND');
		await publishEventQuiet(getPgPool(), [{ k: 'news_updated' }, ...notificationEvents()]);
		return NextResponse.json(updated);
	} catch (error) {
		console.error('API /api/news PATCH error:', error);
		return NextResponse.json({ error: 'Failed to update news.' }, { status: 500 });
	}
}

async function handleDELETE(request: Request) {
	try {
		const auth = await requireApp(request, 'news', 'manage');
		if (!auth.authorized) {
			return auth.response;
		}

		const { searchParams } = new URL(request.url);
		const id = searchParams.get('id');

		if (!id) {
			return NextResponse.json({ error: 'News ID to delete is required.' }, { status: 400 });
		}

		const success = await deleteNews(id);
		if (success) await publishEventQuiet(getPgPool(), [{ k: 'news_updated' }, ...notificationEvents()]);
		return NextResponse.json({ success });
	} catch (error) {
		console.error('API /api/news DELETE error:', error);
		return NextResponse.json({ error: 'Failed to delete news.' }, { status: 500 });
	}
}

export const POST = withAudit(handlePOST, { action: 'news.create', target: 'news' });
export const PATCH = withAudit(handlePATCH, { action: 'news.update', target: 'news' });
export const DELETE = withAudit(handleDELETE, { action: 'news.delete', target: 'news' });
