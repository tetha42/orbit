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
import { can } from '@/lib/auth/access';
import { NOTIFICATION_KINDS } from '@/core/notifications/kinds';
import type { AuthorizedUser } from '@/lib/auth/access';
import type { NotificationItem, NotificationKind, NotificationsResponse } from '@/types/notifications';
import { appendFeedNotifications } from './notificationFeedBuilders';

const DAY = 86_400_000;
/** How long an announcement or a new certificate stays in the feed. */
const FEED_WINDOW = 14 * DAY;
/** How far ahead events are worth mentioning. */
const EVENT_WINDOW = 7 * DAY;
/** How close a task deadline or a loan's return date has to be before it becomes a to-do. */
const DUE_WINDOW = 3 * DAY;

/** Caps per source, so one busy source cannot fill the panel. */
const MAX_APPROVALS = 5;
const MAX_DUE = 5;
const MAX_MESSAGES = 5;

export async function buildNotificationsResponse(user: AuthorizedUser, now: number): Promise<NotificationsResponse> {
	const permitted = (kind: NotificationKind) => can(user, NOTIFICATION_KINDS[kind].appId, NOTIFICATION_KINDS[kind].level);
	const when = <T,>(kind: NotificationKind, load: () => Promise<T[]>): Promise<T[]> =>
		permitted(kind) ? load() : Promise.resolve([]);

	const [
		applications,
		proposals,
		assigned,
		checkins,
		decisions,
		pending,
		news,
		events,
		myEventIds,
		tasks,
		loans,
		certificates,
		messages,
		unreadMessages,
	] = await Promise.all([
		when('teamApplication', () => getPendingTeamApplications(user.id, can(user, 'teams', 'manage'))),
		when('projectProposal', () => getPendingProjectProposals()),
		when('assigned', () => getUserNewAssignments(user.id, now - FEED_WINDOW)),
		when('checkin', () => getPendingAttendanceEvents(user.id, now, ATTENDANCE_TOLERANCE_MS)),
		when('teamDecision', () => getUserApplicationDecisions(user.id, now - FEED_WINDOW)),
		when('approval', () => getPendingUsers()),
		when('news', () => getNews('member')),
		when('event', () => getEvents()),
		when('event', () => getUserEventRegistrationIds(user.id)),
		when('task', () => getUserUpcomingTasks(user.id, now + DUE_WINDOW)),
		when('loan', () => getUserUpcomingReturns(user.id, now + DUE_WINDOW)),
		when('certificate', () => getCertificates(user.id)),
		when('message', () => getUnreadMailThreads(user.id, MAX_MESSAGES)),
		permitted('message') ? getUnreadMailCount(user.id) : Promise.resolve(0),
	]);

	const items: NotificationItem[] = [];

	// --- to-dos ---------------------------------------------------------------
	for (const applicant of pending.slice(0, MAX_APPROVALS)) {
		items.push({
			id: `approval:${applicant.id}`,
			kind: 'approval',
			priority: 'action',
			at: applicant.createdAt ?? Date.now(),
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
			at: task.dueDate ?? Date.now(),
			dueAt: task.dueDate ?? undefined,
			data: { title: task.title, teamName: task.teamName, taskPriority: task.priority },
			target: { appId: 'teams', kind: 'task', itemId: task.id, parentId: task.teamId },
		});
	}

	for (const loan of loans.slice(0, MAX_DUE)) {
		const due = loan.dueDate;
		items.push({
			id: `loan:${loan.id}`,
			kind: 'loan',
			priority: 'action',
			at: due ?? Date.now(),
			dueAt: due,
			data: { title: loan.name, code: loan.code },
			target: { appId: 'inventory', kind: 'item', itemId: loan.id },
		});
	}

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
			at: a.createdAt ?? Date.now(),
			data: { title: a.applicantName, teamName: a.teamName, department: a.department },
			target: { appId: 'teams', kind: 'team', itemId: a.teamId, section: 'members' },
		});
	}

	for (const p of proposals.slice(0, MAX_APPROVALS)) {
		items.push({
			id: `projectProposal:${p.id}`,
			kind: 'projectProposal',
			priority: 'action',
			at: p.createdAt ?? Date.now(),
			data: { title: p.title, author: p.creatorName },
			target: { appId: 'projects', kind: 'project', itemId: p.id, section: 'proposed' },
		});
	}

	// --- to know ----------------------------------------------------------------
	appendFeedNotifications(items, {
		now,
		feedWindow: FEED_WINDOW,
		eventWindow: EVENT_WINDOW,
		news,
		events,
		myEventIds,
		tasks,
		assigned,
		decisions,
		certificates,
		messages,
	});

	const visible = items.filter((i) => permitted(i.kind));
	return {
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
}
