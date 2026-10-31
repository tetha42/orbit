import { getPgPool, ensurePostgresInit } from '@/db';

/** Project proposals waiting for the board. */
export async function getPendingProjectProposals(): Promise<{ id: string; baslik: string; olusturanAdSoyad: string | null; olusturma: number }[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT p.id, p.baslik, k.first_name || ' ' || k.last_name AS "olusturanAdSoyad", p.olusturma
		 FROM projects p LEFT JOIN users k ON k.id = p.olusturanId
		 WHERE p.status = 'oneri'
		 ORDER BY p.olusturma DESC
		 LIMIT 20`
	);
	return res.rows;
}

/** Events the member registered for that are on right now with check-in open, and not yet checked in. */
export async function getPendingAttendanceEvents(
	userId: string,
	now: number,
	tolerance: number
): Promise<{ id: string; baslik: string; konum: string; baslangic: number; endTime: number }[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT e.id, e.baslik, e.konum, e.baslangic, e.endTime
		 FROM events e
		 JOIN event_registrations r ON r.etkinlikId = e.id AND r.userId = $1
		 WHERE e.status = 'yayinda' AND e.yoklamaAcik = 1
		   AND e.baslangic - $3 <= $2 AND e.endTime + $3 >= $2
		   AND NOT EXISTS (SELECT 1 FROM attendances y WHERE y.etkinlikId = e.id AND y.userId = $1)
		 ORDER BY e.baslangic ASC`,
		[userId, now, tolerance]
	);
	return res.rows;
}
