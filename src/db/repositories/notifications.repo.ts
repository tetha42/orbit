import { getPgPool, ensurePostgresInit } from '@/db';

/** Project proposals waiting for the board. */
export async function getPendingProjectProposals(): Promise<{ id: string; title: string; creatorName: string | null; createdAt: number }[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT p.id, p.title AS title, k.first_name || ' ' || k.last_name AS "creatorName",
		        p.created_at AS "createdAt"
		 FROM projects p LEFT JOIN users k ON k.id = p.created_by
		 WHERE p.status = 'proposed'
		 ORDER BY p.created_at DESC
		 LIMIT 20`
	);
	return res.rows;
}

/** Events the member registered for that are on right now with check-in open, and not yet checked in. */
export async function getPendingAttendanceEvents(
	userId: string,
	now: number,
	tolerance: number
): Promise<{ id: string; title: string; location: string; start: number; endTime: number }[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT e.id, e.title AS title, e.location AS location, e.starts_at AS start, e.ends_at AS "endTime"
		 FROM events e
		 JOIN event_participants r ON r.event_id = e.id AND r.user_id = $1
		 WHERE e.status = 'published' AND e.checkin_open = 1
		   AND e.starts_at - $3 <= $2 AND e.ends_at + $3 >= $2
		   AND r.registered_at > 0 AND r.status <> 'cancelled'
		   AND r.status <> 'attended' AND r.attended_at IS NULL
		 ORDER BY e.starts_at ASC`,
		[userId, now, tolerance]
	);
	return res.rows;
}
