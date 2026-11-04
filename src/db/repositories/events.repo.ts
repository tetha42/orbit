import { randomUUID } from 'crypto';
import { ensurePostgresInit, getPgPool, withTransaction } from '@/db/index';
import { notificationEvents, publishEventQuiet } from '@/db/events';
import { PARTICIPATION_XP, ATTENDANCE_TOLERANCE_MS, type EventStatus, type EventType, type AttendanceMethod } from '@/lib/events';
import { slugify, uniqueSlug } from '@/lib/text';
import type { CommunityEvent, Attendance } from '@/db/schema';

export interface PublicEventRow {
	id: string;
	title: string;
	typeValue: string;
	description: string;
	location: string;
	start: number;
	endTime: number;
	capacity: number;
	participantCount: number;
}

/**
 * Events with their registration and attendance counts. Drafts are for the
 * organisers; everyone else's lists (notifications, search) leave them out.
 */
export async function getEvents(opts: { includeDrafts?: boolean } = {}): Promise<CommunityEvent[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT e.id, e.slug, e.title AS "title", e.category AS "typeValue", e.description AS "description",
		        e.location AS "location", e.starts_at AS "start", e.ends_at AS "endTime",
		        e.capacity AS "capacity", e.status, e.created_by AS "creatorId",
		        e.checkin_open AS "attendanceOpen", e.created_at AS "update", e.created_at AS "creation",
		        e.owner_team_id, e.owner_user_id, e.created_by,
		        (SELECT COUNT(*) FROM event_participants r WHERE r.event_id = e.id AND r.registered_at > 0 AND r.status <> 'cancelled')::int AS "registeredCount",
		        (SELECT COUNT(*) FROM event_participants y WHERE y.event_id = e.id AND (y.status = 'attended' OR y.attended_at IS NOT NULL))::int AS "participantCount"
		 FROM events e
		 WHERE $1::boolean OR e.status <> 'draft'
		 ORDER BY e.starts_at ASC`,
		[Boolean(opts.includeDrafts)]
	);
	return res.rows;
}

/** Ids of the events the member has registered for or attended. */
export async function getUserEventRegistrationIds(userId: string): Promise<string[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT event_id AS "eventId" FROM event_participants WHERE user_id = $1 AND status <> 'cancelled'`,
		[userId]
	);
	return res.rows.map((r) => r.eventId as string);
}

export async function getAttendancesByEvent(eventId: string): Promise<Attendance[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT y.id, y.event_id AS "eventId", y.user_id AS "userId", y.checkin_method AS "method",
		        y.attended_at AS "participationTime", y.recorded_by AS "recorderId",
		        k.first_name || ' ' || k.last_name AS "userNameSurname",
		        k.handle AS "userStudentNo",
		        k.department AS "userDepartment",
		        k.avatar_url AS "userProfilePhoto"
		 FROM event_participants y
		 LEFT JOIN users k ON y.user_id = k.id
		 WHERE y.event_id = $1 AND (y.status = 'attended' OR y.attended_at IS NOT NULL)
		 ORDER BY y.attended_at DESC`,
		[eventId]
	);
	return res.rows;
}

export async function createEvent(params: {
	title: string;
	typeValue?: string;
	description?: string;
	location?: string;
	start: number;
	endTime: number;
	capacity?: number;
	creatorId?: string;
	status?: 'draft' | 'published';
	ownerTeamId?: string | null;
	ownerUserId?: string | null;
}): Promise<{ id: string; slug: string }> {
	await ensurePostgresInit();
	const id = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
	const slug = await uniqueSlug(
		slugify(params.title),
		async (candidate) => ((await getPgPool().query('SELECT 1 FROM events WHERE slug = $1', [candidate])).rowCount ?? 0) > 0,
		'etkinlik'
	);
	const now = Date.now();

	await getPgPool().query(
		`INSERT INTO events
			(id, slug, title, category, description, location, starts_at, ends_at, capacity, status,
			 xp_reward, owner_team_id, owner_user_id, created_by, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
		[
			id,
			slug,
			params.title,
			params.typeValue || 'workshop',
			params.description || '',
			params.location || 'Mühendislik D-101',
			params.start,
			params.endTime,
			params.capacity || 50,
			params.status ?? 'published',
			PARTICIPATION_XP,
			params.ownerTeamId ?? null,
			params.ownerUserId ?? params.creatorId ?? null,
			params.creatorId || null,
			now,
		]
	);
	if ((params.status ?? 'published') === 'published') await publishEventQuiet(getPgPool(), notificationEvents());

	return { id, slug };
}

/** Published events that have not ended yet, soonest first. */
export async function getPublicEvents(limit = 24): Promise<PublicEventRow[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT e.id, e.title AS "title", e.category AS "typeValue", e.description AS "description",
		        e.location AS "location", e.starts_at AS "start", e.ends_at AS "endTime", e.capacity AS "capacity",
		        (SELECT COUNT(*) FROM event_participants r WHERE r.event_id = e.id AND r.registered_at > 0 AND r.status <> 'cancelled')::int AS "participantCount"
		 FROM events e
		 WHERE e.status = 'published' AND e.ends_at >= $1
		 ORDER BY e.starts_at ASC
		 LIMIT $2`,
		[Date.now(), limit]
	);
	return res.rows;
}

/** An event as one member sees it: counts, plus their own registration and check-in. */
export interface EventView extends CommunityEvent {
	registeredCount: number;
	participantCount: number;
	attendanceOpen: number;
	update: number | null;
	myMyRecord: boolean;
	myMyAttendance: { method: AttendanceMethod; participationTime: number } | null;
}

export async function getEventViews(viewerId: string, includeDrafts: boolean): Promise<EventView[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT e.id, e.slug, e.title AS "title", e.category AS "typeValue", e.description AS "description",
		        e.location AS "location", e.starts_at AS "start", e.ends_at AS "endTime",
		        e.capacity AS "capacity", e.status, e.created_by AS "creatorId",
		        e.checkin_open AS "attendanceOpen", e.created_at AS "update", e.created_at AS "creation",
		        e.owner_team_id, e.owner_user_id, e.created_by,
		        (SELECT COUNT(*) FROM event_participants r WHERE r.event_id = e.id AND r.registered_at > 0 AND r.status <> 'cancelled')::int AS "registeredCount",
		        (SELECT COUNT(*) FROM event_participants y WHERE y.event_id = e.id AND (y.status = 'attended' OR y.attended_at IS NOT NULL))::int AS "participantCount",
		        (my.id IS NOT NULL AND my.registered_at > 0 AND my.status <> 'cancelled') AS "myMyRecord",
		        CASE WHEN my.status = 'attended' OR my.attended_at IS NOT NULL THEN my.checkin_method ELSE NULL END AS "myMethod",
		        CASE WHEN my.status = 'attended' OR my.attended_at IS NOT NULL THEN my.attended_at ELSE NULL END AS "myParticipationTime"
		 FROM events e
		 LEFT JOIN event_participants my ON my.event_id = e.id AND my.user_id = $1
		 WHERE $2::boolean OR e.status <> 'draft'
		 ORDER BY e.starts_at ASC`,
		[viewerId, includeDrafts]
	);
	return res.rows.map((r) => {
		const { myMethod, myParticipationTime, ...rest } = r as Record<string, unknown>;
		return {
			...(rest as unknown as EventView),
			myMyRecord: Boolean(r.myMyRecord),
			myMyAttendance: myMethod
				? { method: myMethod as AttendanceMethod, participationTime: Number(myParticipationTime) }
				: null,
		};
	});
}

export async function getEventById(id: string): Promise<(CommunityEvent & { attendanceOpen: number }) | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT id, slug, title AS "title", category AS "typeValue", description AS "description",
		        location AS "location", starts_at AS "start", ends_at AS "endTime",
		        capacity AS "capacity", status, created_by AS "creatorId", checkin_open AS "attendanceOpen",
		        created_at AS "update", created_at AS "creation", owner_team_id, owner_user_id, created_by
		 FROM events WHERE id = $1`,
		[id]
	);
	return res.rows[0] ?? null;
}

/**
 * Closes check-in on events whose check-in window has passed, so the stored flag
 * matches reality (the projector and member paths also check the time).
 */
export async function closeFinishedAttendances(): Promise<number> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`UPDATE events SET checkin_open = 0
		 WHERE checkin_open = 1 AND $1 > ends_at + $2`,
		[Date.now(), ATTENDANCE_TOLERANCE_MS]
	);
	return res.rowCount ?? 0;
}

/** Ids of the events that are published, have check-in open, and are within their check-in window. */
export async function getOpenAttendanceEvents(): Promise<string[]> {
	await ensurePostgresInit();
	const now = Date.now();
	const res = await getPgPool().query(
		`SELECT id FROM events
		 WHERE status = 'published' AND checkin_open = 1
		   AND $1 >= starts_at - $2 AND $1 <= ends_at + $2`,
		[now, ATTENDANCE_TOLERANCE_MS]
	);
	return res.rows.map((r) => String(r.id));
}

/** One line of the organisers' list: a registration, a check-in, or both. */
export interface AttendeeRow {
	userId: string;
	nameSurname: string;
	studentNo: string | null;
	department: string | null;
	recordTime: number | null;
	participationTime: number | null;
	method: AttendanceMethod | null;
	recorderNameSurname: string | null;
}

/** Everyone registered or checked in (walk-ins included), registered first then by name. */
export async function getEventAttendeeList(eventId: string): Promise<AttendeeRow[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT k.id AS "userId",
		        k.first_name || ' ' || k.last_name AS "nameSurname",
		        k.handle AS "studentNo",
		        k.department AS "department",
		        NULLIF(ep.registered_at, 0) AS "recordTime",
		        ep.attended_at AS "participationTime",
		        ep.checkin_method AS "method",
		        kd.first_name || ' ' || kd.last_name AS "recorderNameSurname"
		 FROM event_participants ep
		 JOIN users k ON k.id = ep.user_id
		 LEFT JOIN users kd ON kd.id = ep.recorded_by
		 WHERE ep.event_id = $1 AND ep.status <> 'cancelled'
		 ORDER BY (ep.attended_at IS NULL), k.first_name, k.last_name`,
		[eventId]
	);
	return res.rows as AttendeeRow[];
}

export type RegistrationResult = 'ok' | 'already' | 'full' | 'closed' | 'not_found';

/**
 * Registers a member. The event row is locked, so two members racing for the
 * last seat cannot both get it — capacity used to be checked only in the browser.
 */
export async function registerForEvent(eventId: string, userId: string): Promise<RegistrationResult> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const ev = await client.query('SELECT status, ends_at AS "endTime", capacity AS "capacity" FROM events WHERE id = $1 FOR UPDATE', [eventId]);
		const row = ev.rows[0];
		if (!row) return 'not_found';
		if (row.status !== 'published' || Number(row.endTime) < Date.now()) return 'closed';
		const mine = await client.query('SELECT id, registered_at, status FROM event_participants WHERE event_id = $1 AND user_id = $2', [
			eventId,
			userId,
		]);
		const existing = mine.rows[0];
		if (existing && Number(existing.registered_at) > 0 && existing.status !== 'cancelled') return 'already';
		const count = await client.query(
			"SELECT COUNT(*)::int AS n FROM event_participants WHERE event_id = $1 AND registered_at > 0 AND status <> 'cancelled'",
			[eventId]
		);
		if (Number(row.capacity) > 0 && Number(count.rows[0].n) >= Number(row.capacity)) return 'full';
		const now = Date.now();
		if (existing) {
			await client.query(
				"UPDATE event_participants SET registered_at = $3, status = CASE WHEN status = 'attended' THEN 'attended' ELSE 'registered' END WHERE event_id = $1 AND user_id = $2",
				[eventId, userId, now]
			);
		} else {
			await client.query(
				"INSERT INTO event_participants (id, event_id, user_id, status, registered_at) VALUES ($1, $2, $3, 'registered', $4)",
				[randomUUID(), eventId, userId, now]
			);
		}
		return 'ok';
	});
}

/** Withdraws a registration, until the event starts. */
export async function cancelEventRegistration(eventId: string, userId: string): Promise<'ok' | 'none' | 'started'> {
	await ensurePostgresInit();
	const ev = await getEventById(eventId);
	if (!ev) return 'none';
	if (Number(ev.start) <= Date.now()) return 'started';
	const res = await getPgPool().query(
		"DELETE FROM event_participants WHERE event_id = $1 AND user_id = $2 AND status <> 'attended' AND attended_at IS NULL",
		[eventId, userId]
	);
	return (res.rowCount ?? 0) > 0 ? 'ok' : 'none';
}

/** Organiser removal of a registration (independent of event start time). */
export async function deleteEventRegistration(eventId: string, userId: string): Promise<boolean> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const row = (
			await client.query('SELECT status, attended_at, registered_at FROM event_participants WHERE event_id = $1 AND user_id = $2 FOR UPDATE', [
				eventId,
				userId,
			])
		).rows[0];
		if (!row || Number(row.registered_at) <= 0) return false;
		if (row.status === 'attended' || row.attended_at !== null) {
			await client.query('UPDATE event_participants SET registered_at = 0 WHERE event_id = $1 AND user_id = $2', [eventId, userId]);
			return true;
		}
		const del = await client.query('DELETE FROM event_participants WHERE event_id = $1 AND user_id = $2', [eventId, userId]);
		return (del.rowCount ?? 0) > 0;
	});
}

/**
 * Records attendance once and pays the attendance XP once. A second check-in
 * for the same member and event changes nothing and pays nothing.
 */
export async function saveAttendance(params: {
	eventId: string;
	userId: string;
	method: AttendanceMethod;
	recorderId?: string | null;
}): Promise<'ok' | 'already'> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const now = Date.now();
		const existing = (
			await client.query('SELECT status, attended_at FROM event_participants WHERE event_id = $1 AND user_id = $2 FOR UPDATE', [
				params.eventId,
				params.userId,
			])
		).rows[0];
		if (existing && (existing.status === 'attended' || existing.attended_at !== null)) {
			return 'already';
		}
		if (existing) {
			await client.query(
				"UPDATE event_participants SET status = 'attended', checkin_method = $3, attended_at = $4, recorded_by = $5 WHERE event_id = $1 AND user_id = $2",
				[params.eventId, params.userId, params.method, now, params.recorderId ?? null]
			);
		} else {
			await client.query(
				`INSERT INTO event_participants (id, event_id, user_id, status, checkin_method, registered_at, attended_at, recorded_by)
				 VALUES ($1, $2, $3, 'attended', $4, 0, $5, $6)`,
				[randomUUID(), params.eventId, params.userId, params.method, now, params.recorderId ?? null]
			);
		}
		await client.query('UPDATE users SET xp = COALESCE(xp, 0) + $1 WHERE id = $2', [PARTICIPATION_XP, params.userId]);
		return 'ok';
	});
}

/** Removes a check-in recorded by mistake, and takes back the XP it paid. */
export async function deleteAttendance(eventId: string, userId: string): Promise<boolean> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const existing = (
			await client.query('SELECT status, attended_at, registered_at FROM event_participants WHERE event_id = $1 AND user_id = $2 FOR UPDATE', [
				eventId,
				userId,
			])
		).rows[0];
		if (!existing || (existing.status !== 'attended' && existing.attended_at === null)) return false;

		if (Number(existing.registered_at) > 0) {
			await client.query(
				"UPDATE event_participants SET status = 'registered', checkin_method = NULL, attended_at = NULL, recorded_by = NULL WHERE event_id = $1 AND user_id = $2",
				[eventId, userId]
			);
		} else {
			await client.query('DELETE FROM event_participants WHERE event_id = $1 AND user_id = $2', [eventId, userId]);
		}
		await client.query('UPDATE users SET xp = GREATEST(0, COALESCE(xp, 0) - $1) WHERE id = $2', [
			PARTICIPATION_XP,
			userId,
		]);
		return true;
	});
}

export interface EventPatch {
	title?: string;
	typeValue?: EventType;
	description?: string;
	location?: string;
	start?: number;
	endTime?: number;
	capacity?: number;
	status?: EventStatus;
	attendanceOpen?: boolean;
	ownerTeamId?: string | null;
	ownerUserId?: string | null;
}

const EVENT_PATCH_COLUMNS: Record<string, string> = {
	title: 'title',
	typeValue: 'category',
	description: 'description',
	location: 'location',
	start: 'starts_at',
	endTime: 'ends_at',
	capacity: 'capacity',
	status: 'status',
};

export async function updateEvent(id: string, patch: EventPatch): Promise<boolean> {
	await ensurePostgresInit();
	const sets: string[] = [];
	const values: unknown[] = [];
	const set = (column: string, value: unknown) => {
		values.push(value);
		sets.push(`${column} = $${values.length}`);
	};
	for (const key of ['title', 'typeValue', 'description', 'location', 'start', 'endTime', 'capacity', 'status'] as const) {
		if (patch[key] !== undefined) set(EVENT_PATCH_COLUMNS[key], patch[key]);
	}
	if (patch.attendanceOpen !== undefined) set('checkin_open', patch.attendanceOpen ? 1 : 0);
	if (patch.ownerTeamId !== undefined) set('owner_team_id', patch.ownerTeamId);
	if (patch.ownerUserId !== undefined) set('owner_user_id', patch.ownerUserId);
	if (!sets.length) return true;
	values.push(id);
	const res = await getPgPool().query(`UPDATE events SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
	return (res.rowCount ?? 0) > 0;
}

/** Deletes an event nobody attended; one with check-ins is history and can only be cancelled. */
export async function deleteEvent(id: string): Promise<'ok' | 'has_participation' | 'none'> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const att = await client.query(
			"SELECT 1 FROM event_participants WHERE event_id = $1 AND (status = 'attended' OR attended_at IS NOT NULL) LIMIT 1",
			[id]
		);
		if (att.rowCount) return 'has_participation';
		const res = await client.query('DELETE FROM events WHERE id = $1', [id]);
		return (res.rowCount ?? 0) > 0 ? 'ok' : 'none';
	});
}
