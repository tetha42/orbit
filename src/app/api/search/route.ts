import { NextResponse } from 'next/server';
import { authenticate, can } from '@/lib/auth/access';
import { consumeRateLimit } from '@/lib/rateLimit';
import { MAX_HITS_PER_KIND, type SearchHit, type SearchKind, type SearchResponse } from '@/types/search';
import { collectSearchHits } from './searchIndexers';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

const KIND_ORDER: SearchKind[] = [
	'team',
	'task',
	'event',
	'news',
	'member',
	'item',
	'certificate',
	'ledger',
	'message',
];

export async function GET(request: Request) {
	const auth = await authenticate(request);
	if (!auth.authorized) return auth.response;
	const user = auth.user;
	const uses = (app: string) => can(user, app, 'use');

	const q = (new URL(request.url).searchParams.get('q') ?? '').trim();
	if (q.length < 2 || q.length > 64) {
		return NextResponse.json(
			{ error: 'Search query must be between 2 and 64 characters.' },
			{ status: 400, headers: NO_STORE }
		);
	}

	const limit = consumeRateLimit(`search:${user.id}`, 40, 10_000);
	if (!limit.allowed) {
		return NextResponse.json(
			{ error: 'You are searching too fast. Please wait a few seconds.' },
			{ status: 429, headers: { ...NO_STORE, 'Retry-After': String(limit.retryAfter) } }
		);
	}

	try {
		const byKind = await collectSearchHits(user, q);
		let truncated = false;
		const hits: SearchHit[] = [];
		for (const kind of KIND_ORDER) {
			const list = (byKind.get(kind) ?? []).filter((h) => uses(h.appId)).sort((a, b) => b.score - a.score);
			if (list.length > MAX_HITS_PER_KIND) truncated = true;
			hits.push(...list.slice(0, MAX_HITS_PER_KIND));
		}

		const body: SearchResponse = { q, truncated, hits };
		return NextResponse.json(body, { headers: NO_STORE });
	} catch (error) {
		console.error('API /api/search error:', error);
		return NextResponse.json({ error: 'Search could not be completed.' }, { status: 500, headers: NO_STORE });
	}
}
