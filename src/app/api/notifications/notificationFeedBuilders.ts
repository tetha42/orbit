import type { NotificationItem } from '@/types/notifications';

const MAX_NEWS = 5;
const MAX_EVENTS = 4;
const MAX_DUE = 5;
const MAX_CERTIFICATES = 3;

export interface FeedNotificationInput {
	now: number;
	feedWindow: number;
	eventWindow: number;
	news: Array<{
		id: string;
		title: string;
		category: string;
		isImportant?: number | null;
		publishDate?: number | null;
		createdAt?: number | null;
	}>;
	events: Array<{
		id: string;
		title: string;
		location: string;
		type: string;
		status?: string;
		start: number;
		endTime?: number | null;
		endtime?: number | null;
		createdAt?: number | null;
	}>;
	myEventIds: string[];
	tasks: Array<{ id: string }>;
	assigned: Array<{
		id: string;
		title: string;
		teamId: string;
		teamName: string;
		assigner: string | null;
		at: number;
	}>;
	decisions: Array<{
		teamId: string;
		teamName: string;
		decision: string;
		date: number;
	}>;
	certificates: Array<{
		id: string;
		title: string;
		verificationCode: string;
		createdAt?: number | null;
	}>;
	messages: Array<{
		id: string;
		topic: string;
		at: number;
		sender: { name: string; surname: string };
	}>;
}

export function appendFeedNotifications(items: NotificationItem[], input: FeedNotificationInput): void {
	const { now, feedWindow, eventWindow, news, events, myEventIds, tasks, assigned, decisions, certificates, messages } =
		input;

	const recentNews = news.filter((n) => {
		const published = n.publishDate ?? n.createdAt ?? 0;
		return published <= now && published >= now - feedWindow;
	});
	let pinnedTaken = false;
	for (const article of recentNews.slice(0, MAX_NEWS)) {
		const urgent = article.isImportant === 1 && !pinnedTaken;
		if (urgent) pinnedTaken = true;
		items.push({
			id: `news:${article.id}`,
			kind: 'news',
			priority: 'info',
			urgent: urgent || undefined,
			at: article.publishDate ?? article.createdAt ?? Date.now(),
			data: { title: article.title, category: article.category },
			target: { appId: 'news', kind: 'news', itemId: article.id },
		});
	}

	const upcoming = events
		.filter((e) => e.status === 'published' && Number(e.endTime ?? e.endtime) >= now && e.start <= now + eventWindow)
		.slice(0, MAX_EVENTS);
	for (const event of upcoming) {
		items.push({
			id: `event:${event.id}`,
			kind: 'event',
			priority: 'info',
			at: event.createdAt ?? Date.now(),
			dueAt: event.start,
			data: {
				title: event.title,
				location: event.location,
				eventType: event.type,
				registered: myEventIds.includes(event.id),
				ongoing: event.start <= now,
			},
			target: { appId: 'events', kind: 'event', itemId: event.id },
		});
	}

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

	for (const d of decisions) {
		items.push({
			id: `teamDecision:${d.teamId}`,
			kind: 'teamDecision',
			priority: 'info',
			at: d.date,
			data: { title: d.teamName, accepted: d.decision === 'accepted' },
			target: { appId: 'teams', kind: 'team', itemId: d.teamId },
		});
	}

	for (const certificate of certificates
		.filter((c) => (c.createdAt ?? 0) >= now - feedWindow)
		.slice(0, MAX_CERTIFICATES)) {
		items.push({
			id: `certificate:${certificate.id}`,
			kind: 'certificate',
			priority: 'info',
			at: certificate.createdAt ?? Date.now(),
			data: { title: certificate.title, code: certificate.verificationCode },
			target: { appId: 'certificates', kind: 'cert', itemId: certificate.id, section: 'certificates' },
		});
	}

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
}
