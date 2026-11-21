import { ensurePostgresInit, getPgPool } from '@/db/index';
import { ATTENDANCE_TOLERANCE_MS, type AttendanceMethod } from '@/lib/events';
import type { Attendance, CommunityEvent } from '@/db/schema';
import type { AttendeeRow, EventView, PublicEventRow } from './types';

/** Events with their registration and attendance counts. Drafts are hidden from general lists. */
export async function getEvents(opts: { includeDrafts?: boolean } = {}): Promise<CommunityEvent[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT e.id, e.slug, e.title AS "title", e.category AS "type", e.category AS "typeValue", e.description AS "description",
		        e.location AS "location", e.starts_at AS "start", e.ends_at AS "endTime",
		        e.capacity AS "capacity", e.status, e.created_by AS "creatorId",
		        e.checkin_open AS "checkinOpen", e.checkin_open AS "attendanceOpen",
		        e.created_at AS "updatedAt", e.created_at AS "update", e.created_at AS "createdAt", e.created_at AS "creation",
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

export async function getEventViews(viewerId: string, includeDrafts: boolean): Promise<EventView[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT e.id, e.slug, e.title AS "title", e.category AS "type", e.category AS "typeValue", e.description AS "description",
		        e.location AS "location", e.starts_at AS "start", e.ends_at AS "endTime",
		        e.capacity AS "capacity", e.status, e.created_by AS "creatorId",
		        e.checkin_open AS "checkinOpen", e.checkin_open AS "attendanceOpen",
		        e.created_at AS "updatedAt", e.created_at AS "update", e.created_at AS "createdAt", e.created_at AS "creation",
		        e.owner_team_id, e.owner_user_id, e.created_by,
		        (SELECT COUNT(*) FROM event_participants r WHERE r.event_id = e.id AND r.registered_at > 0 AND r.status <> 'cancelled')::int AS "registeredCount",
		        (SELECT COUNT(*) FROM event_participants y WHERE y.event_id = e.id AND (y.status = 'attended' OR y.attended_at IS NOT NULL))::int AS "participantCount",
		        (my.id IS NOT NULL AND my.registered_at > 0 AND my.status <> 'cancelled') AS "myRecord",
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
			myRecord: Boolean(r.myRecord),
			myAttendance: myMethod
				? { method: myMethod as AttendanceMethod, participationTime: Number(myParticipationTime) }
				: null,
		};
	});
}

export async function getEventById(id: string): Promise<(CommunityEvent & { attendanceOpen: number }) | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT id, slug, title AS "title", category AS "type", category AS "typeValue", description AS "description",
		        location AS "location", starts_at AS "start", ends_at AS "endTime",
		        capacity AS "capacity", status, created_by AS "creatorId",
		        checkin_open AS "checkinOpen", checkin_open AS "attendanceOpen",
		        created_at AS "updatedAt", created_at AS "update", created_at AS "createdAt", created_at AS "creation",
		        owner_team_id, owner_user_id, created_by
		 FROM events WHERE id = $1`,
		[id]
	);
	return res.rows[0] ?? null;
}

/**
 * Published events whose check-in window (plus tolerance) contains now, whether their
 * self check-in switch is open or closed. A code matching one of these but landing on a
 * closed event must say "attendance closed", not "invalid code".
 */
export async function getAttendanceWindowEvents(): Promise<string[]> {
	await ensurePostgresInit();
	const now = Date.now();
	const res = await getPgPool().query(
		`SELECT id FROM events
		 WHERE status = 'published'
		   AND $1 >= starts_at - $2 AND $1 <= ends_at + $2`,
		[now, ATTENDANCE_TOLERANCE_MS]
	);
	return res.rows.map((r) => String(r.id));
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
