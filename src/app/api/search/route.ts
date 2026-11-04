import { NextResponse } from 'next/server';
import {
	getBudgetRecords,
	getEvents,
	getNews,
	getUserTeamIds,
	getCertificates,
	getTeamTasks,
	getTeams,
	getMemberRoster,
} from '@/db';
import { getInventoryItems } from '@/db/repositories/inventory.repo';
import { searchMailCandidates, getMailSearchThreads } from '@/db/messages';
import { recipientList } from '@/server/messages';
import { authenticate, can } from '@/lib/auth/access';
import { listAccessibleVaults } from '@/lib/vaultAccess';
import { consumeRateLimit } from '@/lib/rateLimit';
import { scoreMatch, type SearchField } from '@/lib/text';
import { MAX_HITS_PER_KIND, type SearchHit, type SearchKind, type SearchResponse } from '@/types/search';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** Fixed order for the response; the client groups by kind in this order too. */
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

const formatTL = (minor: number) =>
	`₺${(minor / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (ms: number) => new Date(Number(ms)).toLocaleDateString('tr-TR');

/**
 * Unified search across every kind of record.
 *
 * One rule governs what a caller can find: **a query may only match what that
 * caller can already see in the app that owns the record.** An app the caller's
 * role does not open is not searched at all. Records are read through the same
 * getters the app endpoints use and filtered by the same rules — plus a stricter
 * one for people, so search does not become a way to look up applicants or
 * e-mail addresses that the member directory would not put in front of them:
 *
 *  - members: active members by name, department or team; those who manage
 *    members also match e-mail, student number and pending applicants;
 *  - tasks: only for teams the caller manages, leads or belongs to;
 *  - decisions: board-only ones (`kamuyaAcikMi = 0`) are for decision managers;
 *  - news: drafts are for news managers;
 *  - certificates: your own, or everyone's for certificate managers;
 *  - kasa entries: only kasas the caller may open (see `kasaAccess`);
 *  - messages: the caller's own conversations (trash left out), never anyone else's; and, for
 *    roles that use Mail, up to five people to "send a message" to (the recipient picker's
 *    lookup: active members whose role opens Mail, name only — see /api/posta/alicilar).
 *
 * Matching is done in JS with `foldTr`, not SQL `ILIKE`: the database collation
 * (en_US.utf8) does not fold İ/ı/ş/ğ, and folding here needs no escaping of `%`/`_`.
 */
export async function GET(request: Request) {
	const auth = await authenticate(request);
	if (!auth.authorized) return auth.response;
	const user = auth.user;
	// `can` is false for every app while a required second factor is missing.
	const uses = (app: string) => can(user, app, 'use');
	const manages = (app: string) => can(user, app, 'manage');
	const when = <T,>(ok: boolean, load: () => Promise<T[]>): Promise<T[]> => (ok ? load() : Promise.resolve([]));

	const q = (new URL(request.url).searchParams.get('q') ?? '').trim();
	if (q.length < 2 || q.length > 64) {
		return NextResponse.json(
			{ error: 'Arama en az 2, en çok 64 karakter olmalıdır.' },
			{ status: 400, headers: NO_STORE }
		);
	}

	const limit = consumeRateLimit(`search:${user.id}`, 40, 10_000);
	if (!limit.allowed) {
		return NextResponse.json(
			{ error: 'Çok hızlı arama yapıyorsunuz. Birkaç saniye bekleyin.' },
			{ status: 429, headers: { ...NO_STORE, 'Retry-After': String(limit.retryAfter) } }
		);
	}

	try {
		const [roster, teams, events, news, items, certificates, memberTeamIds, vaults, threads, people] =
			await Promise.all([
				when(uses('members'), () => getMemberRoster()),
				when(uses('teams'), () => getTeams()),
				when(uses('events'), () => getEvents()),
				when(uses('news'), () => getNews(manages('news') ? 'management' : 'member')),
				when(uses('inventory'), () => getInventoryItems()),
				when(uses('certificates'), () => getCertificates(manages('certificates') ? undefined : user.id)),
				when(uses('teams') && !manages('teams'), () => getUserTeamIds(user.id)),
				listAccessibleVaults(user),
				when(uses('mail'), () => getMailSearchThreads(user.id)),
				when(uses('mail'), async () => (await recipientList(await searchMailCandidates(user.id, q, MAX_HITS_PER_KIND))).filter((p) => p.reachable)),
			]);

		const byKind = new Map<SearchKind, SearchHit[]>();
		const add = (hit: Omit<SearchHit, 'score'>, fields: SearchField[]) => {
			const score = scoreMatch(q, fields);
			if (score === 0) return;
			const list = byKind.get(hit.kind) ?? [];
			list.push({ ...hit, score });
			byKind.set(hit.kind, list);
		};

		const memberManager = manages('members');
		for (const m of roster) {
			if (!memberManager && m.status !== 'active') continue;
			add(
				{
					id: `member:${m.id}`,
					kind: 'member',
					appId: 'members',
					title: `${m.name} ${m.surname}`,
					subtitle: [m.department, m.teamName].filter(Boolean).join(' · '),
					target: { kind: 'member', itemId: m.id },
				},
				[
					{ text: `${m.name} ${m.surname}`, weight: 4 },
					{ text: m.department, weight: 1 },
					{ text: m.teamName, weight: 1 },
					...(memberManager
						? [
								{ text: m.email, weight: 2 },
								{ text: m.studentNo, weight: 2 },
							]
						: []),
				]
			);
		}

		const canSeeTasksOf = (teamId: string, leadId: string) =>
			manages('teams') || leadId === user.id || memberTeamIds.includes(teamId);

		for (const team of teams) {
			add(
				{
					id: `team:${team.id}`,
					kind: 'team',
					appId: 'teams',
					title: team.name,
					subtitle: [team.category, team.leaderNameSurname && `Kaptan: ${team.leaderNameSurname}`].filter(Boolean).join(' · '),
					target: { kind: 'team', itemId: team.id },
				},
				[
					{ text: team.name, weight: 4 },
					{ text: team.category, weight: 2 },
					{ text: team.description, weight: 1 },
				]
			);
		}

		const taskLists = await Promise.all(
			teams
				.filter((team) => canSeeTasksOf(team.id, team.leadId))
				.map(async (team) => ({ team, tasks: await getTeamTasks(team.id) }))
		);
		for (const { team, tasks } of taskLists) {
			for (const task of tasks) {
				add(
					{
						id: `task:${task.id}`,
						kind: 'task',
						appId: 'teams',
						title: task.title,
						subtitle: team.name,
						target: { kind: 'task', itemId: task.id, parentId: team.id },
					},
					[
						{ text: task.title, weight: 4 },
						{ text: task.description, weight: 1 },
						{ text: task.assigneeNameSurname, weight: 1 },
					]
				);
			}
		}

		for (const e of events) {
			if (!manages('events') && e.status === 'draft') continue;
			add(
				{
					id: `event:${e.id}`,
					kind: 'event',
					appId: 'events',
					title: e.title,
					subtitle: [formatDate(e.start), e.location].filter(Boolean).join(' · '),
					target: { kind: 'event', itemId: e.id },
				},
				[
					{ text: e.title, weight: 4 },
					{ text: e.location, weight: 1 },
					{ text: e.description, weight: 1 },
				]
			);
		}

		// `getNews` already left drafts out for everyone but news managers.
		for (const n of news) {
			add(
				{
					id: `news:${n.id}`,
					kind: 'news',
					appId: 'news',
					title: n.title,
					subtitle: n.summary,
					target: { kind: 'news', itemId: n.id },
				},
				[
					{ text: n.title, weight: 4 },
					{ text: n.summary, weight: 2 },
					{ text: n.content, weight: 1 },
				]
			);
		}



		for (const item of items) {
			add(
				{
					id: `item:${item.id}`,
					kind: 'item',
					appId: 'inventory',
					title: item.name,
					subtitle: [item.code, item.location].filter(Boolean).join(' · '),
					target: { kind: 'item', itemId: item.id },
				},
				[
					{ text: item.name, weight: 4 },
					{ text: item.code, weight: 4 },
					{ text: item.category, weight: 1 },
					{ text: item.location, weight: 1 },
				]
			);
		}

		for (const c of certificates) {
			const mine = c.userId === user.id;
			add(
				{
					id: `certificate:${c.id}`,
					kind: 'certificate',
					appId: 'certificates',
					title: c.title,
					subtitle: [c.verificationCode, !mine && c.userNameSurname].filter(Boolean).join(' · '),
					target: { kind: 'cert', itemId: c.id, section: mine ? 'certificates' : 'all' },
				},
				[
					{ text: c.title, weight: 4 },
					{ text: c.verificationCode, weight: 3 },
					...(manages('certificates') ? [{ text: c.userNameSurname, weight: 2 }] : []),
				]
			);
		}

		// Kasa entries. Only kasas this caller may open are read at all.
		const vaultApp = uses('budget');
		const vaultEntries = await Promise.all(
			vaults.map(async (vault) => ({ vault, records: await getBudgetRecords(vault.teamId) }))
		);
		for (const { vault, records } of vaultEntries) {
			for (const r of records) {
				add(
					{
						id: `ledger:${r.id}`,
						kind: 'ledger',
						// The Kasa app if the role opens it; otherwise a captain reaches their kasa through the team.
						appId: vaultApp ? 'budget' : 'teams',
						title: r.description,
						subtitle: [formatTL(r.amountMinor), r.category, vault.name].join(' · '),
						target: vaultApp
							? { kind: 'ledger', itemId: r.id, parentId: vault.teamId ?? 'general' }
							: { section: 'vault', kind: 'ledger', itemId: r.id, parentId: vault.teamId ?? undefined },
					},
					[
						{ text: r.description, weight: 4 },
						{ text: r.category, weight: 2 },
						{ text: (r.amountMinor / 100).toFixed(2), weight: 1 },
					]
				);
			}
		}

		for (const th of threads) {
			add(
				{
					id: `message:${th.id}`,
					kind: 'message',
					appId: 'mail',
					title: th.topic,
					subtitle: [th.people, formatDate(th.last)].filter(Boolean).join(' · '),
					target: { kind: 'thread', itemId: th.id },
				},
				[
					{ text: th.topic, weight: 4 },
					{ text: th.people, weight: 2 },
					{ text: th.text, weight: 1 },
				]
			);
		}

		// People Mail can reach, for "send a message": a name only, found by the same rules as the recipient picker.
		// Their role must open Mail (a hit that could not be messaged is not offered).
		for (const p of people) {
			add(
				{
					id: `compose:${p.id}`,
					kind: 'message',
					appId: 'mail',
					title: `${p.name} ${p.surname}`,
					target: { section: 'compose', itemId: p.id },
				},
				[{ text: `${p.name} ${p.surname}`, weight: 2 }, { text: q, weight: 1 }]
			);
		}

		let truncated = false;
		const hits: SearchHit[] = [];
		for (const kind of KIND_ORDER) {
			// A hit opens an app; never one the role does not open.
			const list = (byKind.get(kind) ?? []).filter((h) => uses(h.appId)).sort((a, b) => b.score - a.score);
			if (list.length > MAX_HITS_PER_KIND) truncated = true;
			hits.push(...list.slice(0, MAX_HITS_PER_KIND));
		}

		const body: SearchResponse = { q, truncated, hits };
		return NextResponse.json(body, { headers: NO_STORE });
	} catch (error) {
		console.error('API /api/search error:', error);
		return NextResponse.json({ error: 'Arama tamamlanamadı.' }, { status: 500, headers: NO_STORE });
	}
}
