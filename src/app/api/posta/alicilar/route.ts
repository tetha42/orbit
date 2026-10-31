import { NextResponse } from 'next/server';
import { searchMailCandidates, getMailCandidate, getMailCandidateRoles, getRecentMailThreads } from '@/db/posta';
import { requireApp } from '@/lib/auth/access';
import { consumeRateLimit } from '@/lib/rateLimit';
import { recipientList, ulasilabilirIdler } from '@/lib/server/posta';
import { MAIL_SEARCH_LIMIT, MAIL_SEARCH_MAX, type MailRecipientList } from '@/lib/posta';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * The recipient picker's lookup, open to whoever uses Mail (`mail: kullan`) — a role that
 * cannot open the Member Directory can still address a message. It answers with an id and
 * a name per person, never an e-mail address, department or student number, even though
 * the search text may match them: the caller learns who, not what is on their record.
 * `ulasilabilir` says whether the person's role opens Mail.
 *
 *   ?q=text        active members matching every word of the text (name, department, e-mail
 *                  or student number from its start), at most POSTA_ARAMA_LIMITI of them
 *   (no q)         the people the caller wrote with most recently; `oneri: true`
 *   ?id=…          that one member, if active — for opening Mail with a person already picked
 *   ?ulasilabilir=1  only the ids of the members a message would reach (names are not sent),
 *                  for screens that show a "send a message" button per person
 */
export async function GET(request: Request) {
	const auth = await requireApp(request, 'mail', 'kullan');
	if (!auth.authorized) return auth.response;
	const user = auth.user;
	try {
		const limit = consumeRateLimit(`posta-alicilar:${user.id}`, 60, 10_000);
		if (!limit.allowed) {
			return NextResponse.json({ error: 'Çok hızlı arama yapıyorsunuz. Birkaç saniye bekleyin.' }, { status: 429, headers: { ...NO_STORE, 'Retry-After': String(limit.retryAfter) } });
		}
		const params = new URL(request.url).searchParams;

		if (params.get('ulasilabilir') === '1') {
			return NextResponse.json({ idler: await ulasilabilirIdler(await getMailCandidateRoles(user.id)) }, { headers: NO_STORE });
		}

		const id = params.get('id');
		if (id) {
			const aday = await getMailCandidate(user.id, id.slice(0, 64));
			const body: MailRecipientList = { q: '', alicilar: aday ? await recipientList([aday]) : [], oneri: false };
			return NextResponse.json(body, { headers: NO_STORE });
		}

		const q = (params.get('q') ?? '').trim().slice(0, MAIL_SEARCH_MAX);
		const adaylar = q ? await searchMailCandidates(user.id, q, MAIL_SEARCH_LIMIT) : await getRecentMailThreads(user.id, MAIL_SEARCH_LIMIT);
		// Nobody written with yet: show the directory's first names rather than an empty box.
		const suggestion = !q && adaylar.length > 0;
		const secilen = !q && adaylar.length === 0 ? await searchMailCandidates(user.id, '', MAIL_SEARCH_LIMIT) : adaylar;
		const body: MailRecipientList = { q, alicilar: await recipientList(secilen), oneri: suggestion };
		return NextResponse.json(body, { headers: NO_STORE });
	} catch (error) {
		console.error('API /api/posta/alicilar error:', error);
		return NextResponse.json({ error: 'Alıcılar okunamadı.' }, { status: 500, headers: NO_STORE });
	}
}
