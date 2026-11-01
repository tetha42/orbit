import { NextResponse } from 'next/server';
import { searchMailCandidates, getMailCandidate, getMailCandidateRoles, getRecentMailThreads } from '@/db/messages';
import { recipientList, reachableIds } from '@/lib/server/messages';
import { requireApp } from '@/lib/auth/access';
import { consumeRateLimit } from '@/lib/rateLimit';
import { MAIL_SEARCH_LIMIT, MAIL_SEARCH_MAX } from '@/lib/messages';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * The recipient picker's lookup, open to whoever uses Mail (`mail: kullan`) — a role that
 * cannot open the Member Directory can still address a message. It answers with an id and
 * a name per person, never an e-mail address, department or student number, even though
 * the search text may match them: the caller learns who, not what is on their record.
 * `ulasilabilir` says whether the person's role opens Mail.
 */
export async function GET(request: Request) {
	const auth = await requireApp(request, 'mail', 'kullan');
	if (!auth.authorized) return auth.response;
	const user = auth.user;
	try {
		const limit = consumeRateLimit(`messages-recipients:${user.id}`, 60, 10_000);
		if (!limit.allowed) {
			return NextResponse.json({ error: 'Çok hızlı arama yapıyorsunuz. Birkaç saniye bekleyin.' }, { status: 429, headers: { ...NO_STORE, 'Retry-After': String(limit.retryAfter) } });
		}
		const params = new URL(request.url).searchParams;

		if (params.get('ulasilabilir') === '1' || params.get('reachable') === '1') {
			const idler = await reachableIds(await getMailCandidateRoles(user.id));
			return NextResponse.json({ ids: idler, idler }, { headers: NO_STORE });
		}

		const id = params.get('id');
		if (id) {
			const candidate = await getMailCandidate(user.id, id.slice(0, 64));
			const alicilar = candidate ? await recipientList([candidate]) : [];
			return NextResponse.json(
				{ q: '', recipients: alicilar, alicilar, suggestion: false, oneri: false },
				{ headers: NO_STORE }
			);
		}

		const q = (params.get('q') ?? '').trim().slice(0, MAIL_SEARCH_MAX);
		const candidates = q ? await searchMailCandidates(user.id, q, MAIL_SEARCH_LIMIT) : await getRecentMailThreads(user.id, MAIL_SEARCH_LIMIT);
		// Nobody written with yet: show the directory's first names rather than an empty box.
		const suggestion = !q && candidates.length > 0;
		const selected = !q && candidates.length === 0 ? await searchMailCandidates(user.id, '', MAIL_SEARCH_LIMIT) : candidates;
		const alicilar = await recipientList(selected);
		return NextResponse.json(
			{ q, recipients: alicilar, alicilar, suggestion, oneri: suggestion },
			{ headers: NO_STORE }
		);
	} catch (error) {
		console.error('API /api/messages/recipients error:', error);
		return NextResponse.json({ error: 'Alıcılar okunamadı.' }, { status: 500, headers: NO_STORE });
	}
}
