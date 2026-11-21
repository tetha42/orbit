import { randomUUID } from 'crypto';
import { ensurePostgresInit, getPgPool, withTransaction } from '@/db/index';
import { notificationEvents, publishEventQuiet } from '@/db/events';
import { ATTENDANCE_TOLERANCE_MS, PARTICIPATION_XP, type AttendanceMethod } from '@/lib/events';
import { slugify, uniqueSlug } from '@/lib/text';
import { getEventById } from './queries';
import { EVENT_PATCH_COLUMNS, type EventPatch, type RegistrationResult } from './types';

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
		'event'
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
			params.location || 'Engineering Hall D-101',
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

export async function closeFinishedAttendances(): Promise<number> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`UPDATE events SET checkin_open = 0
		 WHERE checkin_open = 1 AND $1 > ends_at + $2`,
		[Date.now(), ATTENDANCE_TOLERANCE_MS]
	);
	return res.rowCount ?? 0;
}

export async function registerForEvent(eventId: string, userId: string): Promise<RegistrationResult> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const ev = await client.query(
			'SELECT status, ends_at AS "endTime", capacity AS "capacity" FROM events WHERE id = $1 FOR UPDATE',
			[eventId]
		);
		const row = ev.rows[0];
		if (!row) return 'not_found';
		if (row.status !== 'published' || Number(row.endTime) < Date.now()) return 'closed';
		const mine = await client.query(
			'SELECT id, registered_at, status FROM event_participants WHERE event_id = $1 AND user_id = $2',
			[eventId, userId]
		);
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

export async function deleteEventRegistration(eventId: string, userId: string): Promise<boolean> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const row = (
			await client.query(
				'SELECT status, attended_at, registered_at FROM event_participants WHERE event_id = $1 AND user_id = $2 FOR UPDATE',
				[eventId, userId]
			)
		).rows[0];
		if (!row || Number(row.registered_at) <= 0) return false;
		if (row.status === 'attended' || row.attended_at !== null) {
			await client.query('UPDATE event_participants SET registered_at = 0 WHERE event_id = $1 AND user_id = $2', [
				eventId,
				userId,
			]);
			return true;
		}
		const del = await client.query('DELETE FROM event_participants WHERE event_id = $1 AND user_id = $2', [
			eventId,
			userId,
		]);
		return (del.rowCount ?? 0) > 0;
	});
}

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
			await client.query(
				'SELECT status, attended_at FROM event_participants WHERE event_id = $1 AND user_id = $2 FOR UPDATE',
				[params.eventId, params.userId]
			)
		).rows[0];
		if (existing && (existing.status === 'attended' || existing.attendedAt !== null)) {
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
		await client.query('UPDATE users SET xp = COALESCE(xp, 0) + $1 WHERE id = $2', [
			PARTICIPATION_XP,
			params.userId,
		]);
		return 'ok';
	});
}

export async function deleteAttendance(eventId: string, userId: string): Promise<boolean> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const existing = (
			await client.query(
				'SELECT status, attended_at, registered_at FROM event_participants WHERE event_id = $1 AND user_id = $2 FOR UPDATE',
				[eventId, userId]
			)
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
