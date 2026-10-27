import { NextResponse } from 'next/server';
import {
	getNews,
	getEvents,
	getUserEventRegistrationIds,
	getUserUpcomingTasks,
	getUserUpcomingReturns,
	getPendingUsers,
	getCertificates,
	getPendingTeamApplications,
	getUserApplicationDecisions,
	getPendingProjectProposals,
	getUserNewAssignments,
	getPendingAttendanceEvents,
} from '@/db';
import { getChatOkunmamisOdalari, getChatOkunmamisSayisi } from '@/server/db/domains/chat.repo';
import { YOKLAMA_TOLERANS_MS } from '@/lib/events';
import { authenticate, can } from '@/lib/auth/access';
import { BILDIRIM_TURLERI } from '@/core/notifications/kinds';
import type { NotificationItem, NotificationKind, NotificationsResponse } from '@/types/notifications';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

const DAY = 86_400_000;
/** How long an announcement or a new certificate stays in the feed. */
const FEED_WINDOW = 14 * DAY;
/** How far ahead events are worth mentioning. */
const EVENT_WINDOW = 7 * DAY;
/** How close a task deadline or a loan's return date has to be before it becomes a to-do. */
const DUE_WINDOW = 3 * DAY;

/** Caps per source, so one busy source cannot fill the panel. */
const MAX_APPROVALS = 5;
const MAX_NEWS = 5;
const MAX_EVENTS = 4;
const MAX_DUE = 5;
const MAX_CERTIFICATES = 3;
const MAX_MESSAGES = 5;

/**
 * What the member should know about right now, as facts: the client writes the
 * words (in the member's language) and decides what is "new" by comparing `at`
 * with when they last looked.
 *
 * Sources are deliberately few and each one is scoped to the caller — a member is
 * told about their own tasks, loans and certificates and about club-wide news and
 * events, never about anyone else's.
 *
 * Every kind belongs to an app (core/notifications/kinds): a source is read only
 * when the member's role opens that app at the required level — an admin gets
 * everything, a role that only reads news gets only news. A role whose second
 * factor is still missing gets nothing until it is enrolled.
 */
export async function GET(request: Request) {
	const auth = await authenticate(request);
	if (!auth.authorized) return auth.response;
	const user = auth.user;
	const izinli = (kind: NotificationKind) => can(user, BILDIRIM_TURLERI[kind].appId, BILDIRIM_TURLERI[kind].seviye);
	/** Reads a source only when its kind may be shown. */
	const when = <T,>(kind: NotificationKind, load: () => Promise<T[]>): Promise<T[]> => (izinli(kind) ? load() : Promise.resolve([]));

	try {
		const now = Date.now();

		const [applications, proposals, assigned, checkins, decisions] = await Promise.all([
			// Teams managers see every team's applications; a captain their own teams'.
			when('teamApplication', () => getPendingTeamApplications(user.id, can(user, 'teams', 'yonet'))),
			when('projectProposal', () => getPendingProjectProposals()),
			when('assigned', () => getUserNewAssignments(user.id, now - FEED_WINDOW)),
			when('checkin', () => getPendingAttendanceEvents(user.id, now, YOKLAMA_TOLERANS_MS)),
			when('teamDecision', () => getUserApplicationDecisions(user.id, now - FEED_WINDOW)),
		]);

		const [pending, news, events, myEventIds, tasks, loans, certificates, messages] = await Promise.all([
			when('approval', () => getPendingUsers()),
			when('news', () => getNews('uye')),
			when('event', () => getEvents()),
			when('event', () => getUserEventRegistrationIds(user.id)),
			when('task', () => getUserUpcomingTasks(user.id, now + DUE_WINDOW)),
			when('loan', () => getUserUpcomingReturns(user.id, now + DUE_WINDOW)),
			when('certificate', () => getCertificates(user.id)),
			when('message', () => getChatOkunmamisOdalari(user.id, user.permission.admin, MAX_MESSAGES)),
		]);
		const unreadMessages = await (izinli('message') ? getChatOkunmamisSayisi(user.id, user.permission.admin) : Promise.resolve(0));

		const items: NotificationItem[] = [];

		// --- to-dos ---------------------------------------------------------------
		for (const applicant of pending.slice(0, MAX_APPROVALS)) {
			items.push({
				id: `approval:${applicant.id}`,
				kind: 'approval',
				priority: 'action',
				at: applicant.olusturma,
				data: {
					title: `${applicant.ad} ${applicant.soyad}`,
					userId: applicant.id,
					department: applicant.bolum,
					year: applicant.sinif,
				},
				target: { appId: 'members', kind: 'member', itemId: applicant.id },
			});
		}

		for (const task of tasks.slice(0, MAX_DUE)) {
			items.push({
				id: `task:${task.id}`,
				kind: 'task',
				priority: 'action',
				at: task.teslimTarihi,
				dueAt: task.teslimTarihi,
				data: { title: task.baslik, teamName: task.takimAdi, taskPriority: task.oncelik },
				target: { appId: 'teams', kind: 'task', itemId: task.id, parentId: task.teamId },
			});
		}

		for (const loan of loans.slice(0, MAX_DUE)) {
			items.push({
				id: `loan:${loan.id}`,
				kind: 'loan',
				priority: 'action',
				at: loan.iadeTarihi,
				dueAt: loan.iadeTarihi,
				data: { title: loan.ad, code: loan.kod },
				target: { appId: 'inventory', kind: 'item', itemId: loan.id },
			});
		}

		// Check-in is open right now at an event the member signed up for.
		for (const e of checkins) {
			items.push({
				id: `checkin:${e.id}`,
				kind: 'checkin',
				priority: 'action',
				at: e.baslangic,
				dueAt: e.endTime,
				data: { title: e.baslik, location: e.konum },
				target: { appId: 'events', kind: 'event', itemId: e.id },
			});
		}

		for (const a of applications.slice(0, MAX_APPROVALS)) {
			items.push({
				id: `teamApplication:${a.teamId}:${a.userId}`,
				kind: 'teamApplication',
				priority: 'action',
				at: a.olusturma,
				data: { title: a.adSoyad, teamName: a.takimAdi, department: a.bolum },
				target: { appId: 'teams', kind: 'team', itemId: a.teamId, section: 'members' },
			});
		}

		for (const p of proposals.slice(0, MAX_APPROVALS)) {
			items.push({
				id: `projectProposal:${p.id}`,
				kind: 'projectProposal',
				priority: 'action',
				at: p.olusturma,
				data: { title: p.baslik, author: p.olusturanAdSoyad },
				target: { appId: 'projects', kind: 'project', itemId: p.id, section: 'oneri' },
			});
		}

		// --- to know ----------------------------------------------------------------
		// `getNews('uye')` leaves drafts out and lists "önemli" first, so the first recent
		// one is the pinned headline.
		const recentNews = news.filter((n) => {
			const published = n.yayinTarihi ?? n.olusturma;
			return published <= now && published >= now - FEED_WINDOW;
		});
		let pinnedTaken = false;
		for (const article of recentNews.slice(0, MAX_NEWS)) {
			const urgent = article.onemliMi === 1 && !pinnedTaken;
			if (urgent) pinnedTaken = true;
			items.push({
				id: `news:${article.id}`,
				kind: 'news',
				priority: 'info',
				urgent: urgent || undefined,
				at: article.yayinTarihi ?? article.olusturma,
				data: { title: article.baslik, category: article.kategori },
				target: { appId: 'news', kind: 'news', itemId: article.id },
			});
		}

		const upcoming = events
			.filter((e) => e.status === 'yayinda' && e.endTime >= now && e.baslangic <= now + EVENT_WINDOW)
			.slice(0, MAX_EVENTS);
		for (const event of upcoming) {
			items.push({
				id: `event:${event.id}`,
				kind: 'event',
				priority: 'info',
				at: event.olusturma,
				dueAt: event.baslangic,
				data: {
					title: event.baslik,
					location: event.konum,
					eventType: event.tur,
					registered: myEventIds.includes(event.id),
					ongoing: event.baslangic <= now,
				},
				target: { appId: 'events', kind: 'event', itemId: event.id },
			});
		}

		// Tasks someone else handed to the member recently (their deadlines show up as to-dos above).
		const dueSoon = new Set(tasks.map((task) => task.id));
		for (const a of assigned.filter((x) => !dueSoon.has(x.id)).slice(0, MAX_DUE)) {
			items.push({
				id: `assigned:${a.id}`,
				kind: 'assigned',
				priority: 'info',
				at: a.at,
				data: { title: a.baslik, teamName: a.takimAdi, by: a.atayan },
				target: { appId: 'teams', kind: 'task', itemId: a.id, parentId: a.teamId },
			});
		}

		// The captain's answer to the member's own application.
		for (const d of decisions) {
			items.push({
				id: `teamDecision:${d.teamId}`,
				kind: 'teamDecision',
				priority: 'info',
				at: d.date,
				data: { title: d.takimAdi, accepted: d.karar === 'kabul' },
				target: { appId: 'teams', kind: 'team', itemId: d.teamId },
			});
		}

		for (const certificate of certificates
			.filter((c) => c.olusturma >= now - FEED_WINDOW)
			.slice(0, MAX_CERTIFICATES)) {
			items.push({
				id: `certificate:${certificate.id}`,
				kind: 'certificate',
				priority: 'info',
				at: certificate.olusturma,
				data: { title: certificate.baslik, code: certificate.verificationCode },
				target: { appId: 'certificates', kind: 'cert', itemId: certificate.id, section: 'certificates' },
			});
		}

		// One row per conversation with something unread, for as long as it is unread.
		for (const m of messages) {
			items.push({
				id: `message:${m.id}`,
				kind: 'message',
				priority: 'info',
				at: m.at,
				data: { title: m.konu, from: `${m.gonderen.ad} ${m.gonderen.soyad}`.trim() },
				target: { appId: 'chat', kind: 'thread', itemId: m.id },
			});
		}

		// The sources above are already gated; this keeps the table the single
		// rule even if a source is added without its check.
		const visible = items.filter((i) => izinli(i.kind));
		const body: NotificationsResponse = {
			generatedAt: now,
			counts: {
				actionRequired:
					pending.length + tasks.length + loans.length + checkins.length + applications.length + proposals.length,
				total: visible.length + Math.max(0, pending.length - MAX_APPROVALS),
				unreadMessages,
			},
			items: visible,
			...(pending.length > MAX_APPROVALS ? { moreApprovals: pending.length - MAX_APPROVALS } : {}),
		};
		return NextResponse.json(body, { headers: NO_STORE });
	} catch (error) {
		console.error('API /api/bildirimler error:', error);
		return NextResponse.json({ error: 'Bildirimler okunamadı.' }, { status: 500, headers: NO_STORE });
	}
}
