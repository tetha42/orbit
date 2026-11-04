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
import { getUnreadMailThreads, getUnreadMailCount } from '@/db/messages';
import { ATTENDANCE_TOLERANCE_MS } from '@/lib/events';
import { authenticate, can } from '@/lib/auth/access';
import { NOTIFICATION_KINDS } from '@/core/notifications/kinds';
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
	const permitted = (kind: NotificationKind) => can(user, NOTIFICATION_KINDS[kind].appId, NOTIFICATION_KINDS[kind].level);
	/** Reads a source only when its kind may be shown. */
	const when = <T,>(kind: NotificationKind, load: () => Promise<T[]>): Promise<T[]> => (permitted(kind) ? load() : Promise.resolve([]));

	try {
		const now = Date.now();

		const [applications, proposals, assigned, checkins, decisions] = await Promise.all([
			// Teams managers see every team's applications; a captain their own teams'.
			when('teamApplication', () => getPendingTeamApplications(user.id, can(user, 'teams', 'yonet'))),
			when('projectProposal', () => getPendingProjectProposals()),
			when('assigned', () => getUserNewAssignments(user.id, now - FEED_WINDOW)),
			when('checkin', () => getPendingAttendanceEvents(user.id, now, ATTENDANCE_TOLERANCE_MS)),
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
			when('message', () => getUnreadMailThreads(user.id, MAX_MESSAGES)),
		]);
		const unreadMessages = await (permitted('message') ? getUnreadMailCount(user.id) : Promise.resolve(0));

		const items: NotificationItem[] = [];

		// --- to-dos ---------------------------------------------------------------
		for (const applicant of pending.slice(0, MAX_APPROVALS)) {
			items.push({
				id: `approval:${applicant.id}`,
				kind: 'approval',
				priority: 'action',
				at: applicant.creation,
				data: {
					title: `${applicant.name} ${applicant.surname}`,
					userId: applicant.id,
					department: applicant.department,
					year: applicant.grade,
				},
				target: { appId: 'members', kind: 'member', itemId: applicant.id },
			});
		}

		for (const task of tasks.slice(0, MAX_DUE)) {
			items.push({
				id: `task:${task.id}`,
				kind: 'task',
				priority: 'action',
				at: task.dueDate,
				dueAt: task.dueDate,
				data: { title: task.title, teamName: task.teamName, taskPriority: task.priority },
				target: { appId: 'teams', kind: 'task', itemId: task.id, parentId: task.teamId },
			});
		}

		for (const loan of loans.slice(0, MAX_DUE)) {
			items.push({
				id: `loan:${loan.id}`,
				kind: 'loan',
				priority: 'action',
				at: loan.returnDate,
				dueAt: loan.returnDate,
				data: { title: loan.name, code: loan.code },
				target: { appId: 'inventory', kind: 'item', itemId: loan.id },
			});
		}

		// Check-in is open right now at an event the member signed up for.
		for (const e of checkins) {
			items.push({
				id: `checkin:${e.id}`,
				kind: 'checkin',
				priority: 'action',
				at: e.start,
				dueAt: e.endTime,
				data: { title: e.title, location: e.location },
				target: { appId: 'events', kind: 'event', itemId: e.id },
			});
		}

		for (const a of applications.slice(0, MAX_APPROVALS)) {
			items.push({
				id: `teamApplication:${a.teamId}:${a.userId}`,
				kind: 'teamApplication',
				priority: 'action',
				at: a.creation,
				data: { title: a.nameSurname, teamName: a.teamName, department: a.department },
				target: { appId: 'teams', kind: 'team', itemId: a.teamId, section: 'members' },
			});
		}

		for (const p of proposals.slice(0, MAX_APPROVALS)) {
			items.push({
				id: `projectProposal:${p.id}`,
				kind: 'projectProposal',
				priority: 'action',
				at: p.creation,
				data: { title: p.title, author: p.creatorNameSurname },
				target: { appId: 'projects', kind: 'project', itemId: p.id, section: 'oneri' },
			});
		}

		// --- to know ----------------------------------------------------------------
		// `getNews('uye')` leaves drafts out and lists "önemli" first, so the first recent
		// one is the pinned headline.
		const recentNews = news.filter((n) => {
			const published = n.publishDate ?? n.creation;
			return published <= now && published >= now - FEED_WINDOW;
		});
		let pinnedTaken = false;
		for (const article of recentNews.slice(0, MAX_NEWS)) {
			const urgent = article.importantMi === 1 && !pinnedTaken;
			if (urgent) pinnedTaken = true;
			items.push({
				id: `news:${article.id}`,
				kind: 'news',
				priority: 'info',
				urgent: urgent || undefined,
				at: article.publishDate ?? article.creation,
				data: { title: article.title, category: article.category },
				target: { appId: 'news', kind: 'news', itemId: article.id },
			});
		}

		const upcoming = events
			.filter((e) => e.status === 'yayinda' && Number(e.endTime ?? (e as { endtime?: number }).endtime) >= now && e.start <= now + EVENT_WINDOW)
			.slice(0, MAX_EVENTS);
		for (const event of upcoming) {
			items.push({
				id: `event:${event.id}`,
				kind: 'event',
				priority: 'info',
				at: event.creation,
				dueAt: event.start,
				data: {
					title: event.title,
					location: event.location,
					eventType: event.typeValue,
					registered: myEventIds.includes(event.id),
					ongoing: event.start <= now,
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
				data: { title: a.title, teamName: a.teamName, by: a.assigner },
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
				data: { title: d.teamName, accepted: d.decision === 'kabul' },
				target: { appId: 'teams', kind: 'team', itemId: d.teamId },
			});
		}

		for (const certificate of certificates
			.filter((c) => c.creation >= now - FEED_WINDOW)
			.slice(0, MAX_CERTIFICATES)) {
			items.push({
				id: `certificate:${certificate.id}`,
				kind: 'certificate',
				priority: 'info',
				at: certificate.creation,
				data: { title: certificate.title, code: certificate.verificationCode },
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
				data: { title: m.topic, from: `${m.sender.name} ${m.sender.surname}`.trim() },
				target: { appId: 'mail', kind: 'thread', itemId: m.id },
			});
		}

		// The sources above are already gated; this keeps the table the single
		// rule even if a source is added without its check.
		const visible = items.filter((i) => permitted(i.kind));
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
