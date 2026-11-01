import { randomUUID } from 'crypto';
import { ensurePostgresInit, getPgPool, withTransaction } from '@/db/index';
import { notificationEvents, publishEventQuiet } from '@/db/events';
import { PARTICIPATION_XP, ATTENDANCE_TOLERANCE_MS, type EventStatus, type EventType, type AttendanceMethod } from '@/lib/events';
import { slugify, uniqueSlug } from '@/lib/text';
import type { CommunityEvent, Attendance } from '@/db/schema';

export interface PublicEventRow {
	id: string;
	baslik: string;
	tur: string;
	aciklama: string;
	konum: string;
	baslangic: number;
	endTime: number;
	kapasite: number;
	katilimciSayisi: number;
}

/**
 * Events with their registration and attendance counts. Drafts are for the
 * organisers; everyone else's lists (notifications, search) leave them out.
 */
export async function getEvents(opts: { includeDrafts?: boolean } = {}): Promise<CommunityEvent[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT e.*,
		        e.endtime AS "endTime",
		        (SELECT COUNT(*) FROM event_registrations r WHERE r.etkinlikId = e.id)::int AS "kayitliSayisi",
		        (SELECT COUNT(*) FROM attendances y WHERE y.etkinlikId = e.id)::int AS "katilimciSayisi"
		 FROM events e
		 WHERE $1::boolean OR e.status <> 'taslak'
		 ORDER BY e.baslangic ASC`,
		[Boolean(opts.includeDrafts)]
	);
	return res.rows;
}

/** Ids of the events the member has registered for or attended. */
export async function getUserEventRegistrationIds(userId: string): Promise<string[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT etkinlikId FROM event_registrations WHERE userId = $1
		 UNION
		 SELECT etkinlikId FROM attendances WHERE userId = $1`,
		[userId]
	);
	return res.rows.map((r) => r.etkinlikId as string);
}

export async function getAttendancesByEvent(etkinlikId: string): Promise<Attendance[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT y.*,
		        k.first_name || ' ' || k.last_name AS "kullaniciAdSoyad",
		        k.handle AS "kullaniciOgrenciNo",
		        k.department AS "kullaniciBolum",
		        k.avatar_url AS "kullaniciProfilFoto"
		 FROM attendances y
		 LEFT JOIN users k ON y.userId = k.id
		 WHERE y.etkinlikId = $1
		 ORDER BY y.katilimZamani DESC`,
		[etkinlikId]
	);
	return res.rows;
}

export async function createEvent(params: {
	baslik: string;
	tur?: string;
	aciklama?: string;
	konum?: string;
	baslangic: number;
	endTime: number;
	kapasite?: number;
	olusturanId?: string;
	status?: 'taslak' | 'yayinda';
	ownerTeamId?: string | null;
	ownerUserId?: string | null;
}): Promise<{ id: string; slug: string }> {
	await ensurePostgresInit();
	const id = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
	const slug = await uniqueSlug(
		slugify(params.baslik),
		async (candidate) => ((await getPgPool().query('SELECT 1 FROM events WHERE slug = $1', [candidate])).rowCount ?? 0) > 0,
		'etkinlik'
	);
	const now = Date.now();

	await getPgPool().query(
		`INSERT INTO events
			(id, slug, baslik, tur, aciklama, konum, baslangic, endTime, kapasite, status, olusturanId,
			 olusturma, guncellenme, owner_team_id, owner_user_id, created_by)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $12, $10, $11, $11, $13, $14, $10)`,
		[
			id,
			slug,
			params.baslik,
			params.tur || 'atolye',
			params.aciklama || '',
			params.konum || 'Mühendislik D-101',
			params.baslangic,
			params.endTime,
			params.kapasite || 50,
			params.olusturanId || null,
			now,
			params.status ?? 'yayinda',
			params.ownerTeamId ?? null,
			params.ownerUserId ?? params.olusturanId ?? null,
		]
	);
	if ((params.status ?? 'yayinda') === 'yayinda') await publishEventQuiet(getPgPool(), notificationEvents());

	return { id, slug };
}

/** Published events that have not ended yet, soonest first. */
export async function getPublicEvents(limit = 24): Promise<PublicEventRow[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT e.id, e.baslik, e.tur, e.aciklama, e.konum, e.baslangic, e.endTime, e.kapasite,
		        (SELECT COUNT(*) FROM event_registrations r WHERE r.etkinlikId = e.id)::int AS "katilimciSayisi"
		 FROM events e
		 WHERE e.status = 'yayinda' AND e.endTime >= $1
		 ORDER BY e.baslangic ASC
		 LIMIT $2`,
		[Date.now(), limit]
	);
	return res.rows;
}

/** An event as one member sees it: counts, plus their own registration and check-in. */
export interface EventView extends CommunityEvent {
	kayitliSayisi: number;
	katilimciSayisi: number;
	yoklamaAcik: number;
	guncellenme: number | null;
	benimKaydim: boolean;
	benimYoklamam: { yontem: AttendanceMethod; katilimZamani: number } | null;
}

export async function getEventViews(viewerId: string, includeDrafts: boolean): Promise<EventView[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT e.*,
		        e.endtime AS "endTime",
		        (SELECT COUNT(*) FROM event_registrations r WHERE r.etkinlikId = e.id)::int AS "kayitliSayisi",
		        (SELECT COUNT(*) FROM attendances y WHERE y.etkinlikId = e.id)::int AS "katilimciSayisi",
		        EXISTS (SELECT 1 FROM event_registrations r WHERE r.etkinlikId = e.id AND r.userId = $1) AS "benimKaydim",
		        my.yontem AS "benimYontem",
		        my.katilimZamani AS "benimKatilimZamani"
		 FROM events e
		 LEFT JOIN attendances my ON my.etkinlikId = e.id AND my.userId = $1
		 WHERE $2::boolean OR e.status <> 'taslak'
		 ORDER BY e.baslangic ASC`,
		[viewerId, includeDrafts]
	);
	return res.rows.map((r) => {
		const { benimYontem, benimKatilimZamani, ...rest } = r as Record<string, unknown>;
		return {
			...(rest as unknown as EventView),
			benimKaydim: Boolean(r.benimKaydim),
			benimYoklamam: benimYontem
				? { yontem: benimYontem as AttendanceMethod, katilimZamani: Number(benimKatilimZamani) }
				: null,
		};
	});
}

export async function getEventById(id: string): Promise<(CommunityEvent & { yoklamaAcik: number }) | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query('SELECT * FROM events WHERE id = $1', [id]);
	return res.rows[0] ?? null;
}

/**
 * Closes check-in on events whose check-in window has passed, so the stored flag
 * matches reality (the projector and member paths also check the time).
 */
export async function closeFinishedAttendances(): Promise<number> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`UPDATE events SET yoklamaAcik = 0
		 WHERE yoklamaAcik = 1 AND $1 > endTime + $2`,
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
		 WHERE status = 'yayinda' AND yoklamaAcik = 1
		   AND $1 >= baslangic - $2 AND $1 <= endTime + $2`,
		[now, ATTENDANCE_TOLERANCE_MS]
	);
	return res.rows.map((r) => String(r.id));
}

/** One line of the organisers' list: a registration, a check-in, or both. */
export interface AttendeeRow {
	userId: string;
	adSoyad: string;
	ogrenciNo: string | null;
	bolum: string | null;
	kayitZamani: number | null;
	katilimZamani: number | null;
	yontem: AttendanceMethod | null;
	kaydedenAdSoyad: string | null;
}

/** Everyone registered or checked in (walk-ins included), registered first then by name. */
export async function getEventAttendeeList(etkinlikId: string): Promise<AttendeeRow[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT k.id AS "userId",
		        k.first_name || ' ' || k.last_name AS "adSoyad",
		        k.handle AS "ogrenciNo",
		        k.department AS "bolum",
		        r.olusturma AS "kayitZamani",
		        y.katilimZamani AS "katilimZamani",
		        y.yontem AS "yontem",
		        kd.first_name || ' ' || kd.last_name AS "kaydedenAdSoyad"
		 FROM (
		   SELECT userId FROM event_registrations WHERE etkinlikId = $1
		   UNION
		   SELECT userId FROM attendances WHERE etkinlikId = $1
		 ) ids
		 JOIN users k ON k.id = ids.userId
		 LEFT JOIN event_registrations r ON r.etkinlikId = $1 AND r.userId = k.id
		 LEFT JOIN attendances y ON y.etkinlikId = $1 AND y.userId = k.id
		 LEFT JOIN users kd ON kd.id = y.kaydedenId
		 ORDER BY (y.katilimZamani IS NULL), k.first_name, k.last_name`,
		[etkinlikId]
	);
	return res.rows as AttendeeRow[];
}

export type RegistrationResult = 'ok' | 'zaten' | 'dolu' | 'kapali' | 'bulunamadi';

/**
 * Registers a member. The event row is locked, so two members racing for the
 * last seat cannot both get it — capacity used to be checked only in the browser.
 */
export async function registerForEvent(etkinlikId: string, userId: string): Promise<RegistrationResult> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const ev = await client.query('SELECT status, endTime, kapasite FROM events WHERE id = $1 FOR UPDATE', [etkinlikId]);
		const row = ev.rows[0];
		if (!row) return 'bulunamadi';
		if (row.status !== 'yayinda' || Number(row.endTime) < Date.now()) return 'kapali';
		const mine = await client.query('SELECT 1 FROM event_registrations WHERE etkinlikId = $1 AND userId = $2', [
			etkinlikId,
			userId,
		]);
		if (mine.rowCount) return 'zaten';
		const count = await client.query('SELECT COUNT(*)::int AS n FROM event_registrations WHERE etkinlikId = $1', [etkinlikId]);
		if (Number(row.kapasite) > 0 && Number(count.rows[0].n) >= Number(row.kapasite)) return 'dolu';
		await client.query('INSERT INTO event_registrations (etkinlikId, userId, olusturma) VALUES ($1, $2, $3)', [
			etkinlikId,
			userId,
			Date.now(),
		]);
		return 'ok';
	});
}

/** Withdraws a registration, until the event starts. */
export async function cancelEventRegistration(etkinlikId: string, userId: string): Promise<'ok' | 'yok' | 'basladi'> {
	await ensurePostgresInit();
	const ev = await getEventById(etkinlikId);
	if (!ev) return 'yok';
	if (Number(ev.baslangic) <= Date.now()) return 'basladi';
	const res = await getPgPool().query('DELETE FROM event_registrations WHERE etkinlikId = $1 AND userId = $2', [
		etkinlikId,
		userId,
	]);
	return (res.rowCount ?? 0) > 0 ? 'ok' : 'yok';
}

/** Organiser removal of a registration (independent of event start time). */
export async function deleteEventRegistration(etkinlikId: string, userId: string): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query('DELETE FROM event_registrations WHERE etkinlikId = $1 AND userId = $2', [
		etkinlikId,
		userId,
	]);
	return (res.rowCount ?? 0) > 0;
}

/**
 * Records attendance once and pays the attendance XP once. A second check-in
 * for the same member and event changes nothing and pays nothing.
 */
export async function saveAttendance(params: {
	etkinlikId: string;
	userId: string;
	yontem: AttendanceMethod;
	kaydedenId?: string | null;
}): Promise<'ok' | 'zaten'> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const ins = await client.query(
			`INSERT INTO attendances (id, etkinlikId, userId, yontem, katilimZamani, kaydedenId)
			 VALUES ($1, $2, $3, $4, $5, $6)
			 ON CONFLICT (etkinlikId, userId) DO NOTHING`,
			[randomUUID(), params.etkinlikId, params.userId, params.yontem, Date.now(), params.kaydedenId ?? null]
		);
		if (!ins.rowCount) return 'zaten';
		await client.query('UPDATE users SET xp = COALESCE(xp, 0) + $1 WHERE id = $2', [PARTICIPATION_XP, params.userId]);
		return 'ok';
	});
}

/** Removes a check-in recorded by mistake, and takes back the XP it paid. */
export async function deleteAttendance(etkinlikId: string, userId: string): Promise<boolean> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const del = await client.query('DELETE FROM attendances WHERE etkinlikId = $1 AND userId = $2', [
			etkinlikId,
			userId,
		]);
		if (!del.rowCount) return false;
		await client.query('UPDATE users SET xp = GREATEST(0, COALESCE(xp, 0) - $1) WHERE id = $2', [
			PARTICIPATION_XP,
			userId,
		]);
		return true;
	});
}

export interface EventPatch {
	baslik?: string;
	tur?: EventType;
	aciklama?: string;
	konum?: string;
	baslangic?: number;
	endTime?: number;
	kapasite?: number;
	status?: EventStatus;
	yoklamaAcik?: boolean;
	ownerTeamId?: string | null;
	ownerUserId?: string | null;
}

export async function updateEvent(id: string, patch: EventPatch): Promise<boolean> {
	await ensurePostgresInit();
	const sets: string[] = [];
	const values: unknown[] = [];
	const set = (column: string, value: unknown) => {
		values.push(value);
		sets.push(`${column} = $${values.length}`);
	};
	for (const key of ['baslik', 'tur', 'aciklama', 'konum', 'baslangic', 'endTime', 'kapasite', 'status'] as const) {
		if (patch[key] !== undefined) set(key, patch[key]);
	}
	if (patch.yoklamaAcik !== undefined) set('yoklamaAcik', patch.yoklamaAcik ? 1 : 0);
	if (patch.ownerTeamId !== undefined) set('owner_team_id', patch.ownerTeamId);
	if (patch.ownerUserId !== undefined) set('owner_user_id', patch.ownerUserId);
	set('guncellenme', Date.now());
	values.push(id);
	const res = await getPgPool().query(`UPDATE events SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
	return (res.rowCount ?? 0) > 0;
}

/** Deletes an event nobody attended; one with check-ins is history and can only be cancelled. */
export async function deleteEvent(id: string): Promise<'ok' | 'katilim-var' | 'yok'> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const att = await client.query('SELECT 1 FROM attendances WHERE etkinlikId = $1 LIMIT 1', [id]);
		if (att.rowCount) return 'katilim-var';
		const res = await client.query('DELETE FROM events WHERE id = $1', [id]);
		return (res.rowCount ?? 0) > 0 ? 'ok' : 'yok';
	});
}
