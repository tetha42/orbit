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
		`SELECT e.id, e.slug, e.title AS "baslik", e.category AS "tur", e.description AS "aciklama",
		        e.location AS "konum", e.starts_at AS "baslangic", e.ends_at AS "endTime",
		        e.capacity AS "kapasite", e.status, e.created_by AS "olusturanId",
		        e.checkin_open AS "yoklamaAcik", e.created_at AS "guncellenme", e.created_at AS "olusturma",
		        e.owner_team_id, e.owner_user_id, e.created_by,
		        (SELECT COUNT(*) FROM event_participants r WHERE r.event_id = e.id AND r.registered_at > 0 AND r.status <> 'iptal')::int AS "kayitliSayisi",
		        (SELECT COUNT(*) FROM event_participants y WHERE y.event_id = e.id AND (y.status = 'attended' OR y.attended_at IS NOT NULL))::int AS "katilimciSayisi"
		 FROM events e
		 WHERE $1::boolean OR e.status <> 'taslak'
		 ORDER BY e.starts_at ASC`,
		[Boolean(opts.includeDrafts)]
	);
	return res.rows;
}

/** Ids of the events the member has registered for or attended. */
export async function getUserEventRegistrationIds(userId: string): Promise<string[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT event_id AS "etkinlikId" FROM event_participants WHERE user_id = $1 AND status <> 'iptal'`,
		[userId]
	);
	return res.rows.map((r) => r.etkinlikId as string);
}

export async function getAttendancesByEvent(etkinlikId: string): Promise<Attendance[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT y.id, y.event_id AS "etkinlikId", y.user_id AS "userId", y.checkin_method AS "yontem",
		        y.attended_at AS "katilimZamani", y.recorded_by AS "kaydedenId",
		        k.first_name || ' ' || k.last_name AS "kullaniciAdSoyad",
		        k.handle AS "kullaniciOgrenciNo",
		        k.department AS "kullaniciBolum",
		        k.avatar_url AS "kullaniciProfilFoto"
		 FROM event_participants y
		 LEFT JOIN users k ON y.user_id = k.id
		 WHERE y.event_id = $1 AND (y.status = 'attended' OR y.attended_at IS NOT NULL)
		 ORDER BY y.attended_at DESC`,
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
			(id, slug, title, category, description, location, starts_at, ends_at, capacity, status,
			 xp_reward, owner_team_id, owner_user_id, created_by, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
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
			params.status ?? 'yayinda',
			PARTICIPATION_XP,
			params.ownerTeamId ?? null,
			params.ownerUserId ?? params.olusturanId ?? null,
			params.olusturanId || null,
			now,
		]
	);
	if ((params.status ?? 'yayinda') === 'yayinda') await publishEventQuiet(getPgPool(), notificationEvents());

	return { id, slug };
}

/** Published events that have not ended yet, soonest first. */
export async function getPublicEvents(limit = 24): Promise<PublicEventRow[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT e.id, e.title AS "baslik", e.category AS "tur", e.description AS "aciklama",
		        e.location AS "konum", e.starts_at AS "baslangic", e.ends_at AS "endTime", e.capacity AS "kapasite",
		        (SELECT COUNT(*) FROM event_participants r WHERE r.event_id = e.id AND r.registered_at > 0 AND r.status <> 'iptal')::int AS "katilimciSayisi"
		 FROM events e
		 WHERE e.status = 'yayinda' AND e.ends_at >= $1
		 ORDER BY e.starts_at ASC
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
		`SELECT e.id, e.slug, e.title AS "baslik", e.category AS "tur", e.description AS "aciklama",
		        e.location AS "konum", e.starts_at AS "baslangic", e.ends_at AS "endTime",
		        e.capacity AS "kapasite", e.status, e.created_by AS "olusturanId",
		        e.checkin_open AS "yoklamaAcik", e.created_at AS "guncellenme", e.created_at AS "olusturma",
		        e.owner_team_id, e.owner_user_id, e.created_by,
		        (SELECT COUNT(*) FROM event_participants r WHERE r.event_id = e.id AND r.registered_at > 0 AND r.status <> 'iptal')::int AS "kayitliSayisi",
		        (SELECT COUNT(*) FROM event_participants y WHERE y.event_id = e.id AND (y.status = 'attended' OR y.attended_at IS NOT NULL))::int AS "katilimciSayisi",
		        (my.id IS NOT NULL AND my.registered_at > 0 AND my.status <> 'iptal') AS "benimKaydim",
		        CASE WHEN my.status = 'attended' OR my.attended_at IS NOT NULL THEN my.checkin_method ELSE NULL END AS "benimYontem",
		        CASE WHEN my.status = 'attended' OR my.attended_at IS NOT NULL THEN my.attended_at ELSE NULL END AS "benimKatilimZamani"
		 FROM events e
		 LEFT JOIN event_participants my ON my.event_id = e.id AND my.user_id = $1
		 WHERE $2::boolean OR e.status <> 'taslak'
		 ORDER BY e.starts_at ASC`,
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
	const res = await getPgPool().query(
		`SELECT id, slug, title AS "baslik", category AS "tur", description AS "aciklama",
		        location AS "konum", starts_at AS "baslangic", ends_at AS "endTime",
		        capacity AS "kapasite", status, created_by AS "olusturanId", checkin_open AS "yoklamaAcik",
		        created_at AS "guncellenme", created_at AS "olusturma", owner_team_id, owner_user_id, created_by
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
		 WHERE status = 'yayinda' AND checkin_open = 1
		   AND $1 >= starts_at - $2 AND $1 <= ends_at + $2`,
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
		        NULLIF(ep.registered_at, 0) AS "kayitZamani",
		        ep.attended_at AS "katilimZamani",
		        ep.checkin_method AS "yontem",
		        kd.first_name || ' ' || kd.last_name AS "kaydedenAdSoyad"
		 FROM event_participants ep
		 JOIN users k ON k.id = ep.user_id
		 LEFT JOIN users kd ON kd.id = ep.recorded_by
		 WHERE ep.event_id = $1 AND ep.status <> 'iptal'
		 ORDER BY (ep.attended_at IS NULL), k.first_name, k.last_name`,
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
		const ev = await client.query('SELECT status, ends_at AS "endTime", capacity AS "kapasite" FROM events WHERE id = $1 FOR UPDATE', [etkinlikId]);
		const row = ev.rows[0];
		if (!row) return 'bulunamadi';
		if (row.status !== 'yayinda' || Number(row.endTime) < Date.now()) return 'kapali';
		const mine = await client.query('SELECT id, registered_at, status FROM event_participants WHERE event_id = $1 AND user_id = $2', [
			etkinlikId,
			userId,
		]);
		const existing = mine.rows[0];
		if (existing && Number(existing.registered_at) > 0 && existing.status !== 'iptal') return 'zaten';
		const count = await client.query(
			"SELECT COUNT(*)::int AS n FROM event_participants WHERE event_id = $1 AND registered_at > 0 AND status <> 'iptal'",
			[etkinlikId]
		);
		if (Number(row.kapasite) > 0 && Number(count.rows[0].n) >= Number(row.kapasite)) return 'dolu';
		const now = Date.now();
		if (existing) {
			await client.query(
				"UPDATE event_participants SET registered_at = $3, status = CASE WHEN status = 'attended' THEN 'attended' ELSE 'kayitli' END WHERE event_id = $1 AND user_id = $2",
				[etkinlikId, userId, now]
			);
		} else {
			await client.query(
				"INSERT INTO event_participants (id, event_id, user_id, status, registered_at) VALUES ($1, $2, $3, 'kayitli', $4)",
				[randomUUID(), etkinlikId, userId, now]
			);
		}
		return 'ok';
	});
}

/** Withdraws a registration, until the event starts. */
export async function cancelEventRegistration(etkinlikId: string, userId: string): Promise<'ok' | 'yok' | 'basladi'> {
	await ensurePostgresInit();
	const ev = await getEventById(etkinlikId);
	if (!ev) return 'yok';
	if (Number(ev.baslangic) <= Date.now()) return 'basladi';
	const res = await getPgPool().query(
		"DELETE FROM event_participants WHERE event_id = $1 AND user_id = $2 AND status <> 'attended' AND attended_at IS NULL",
		[etkinlikId, userId]
	);
	return (res.rowCount ?? 0) > 0 ? 'ok' : 'yok';
}

/** Organiser removal of a registration (independent of event start time). */
export async function deleteEventRegistration(etkinlikId: string, userId: string): Promise<boolean> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const row = (
			await client.query('SELECT status, attended_at, registered_at FROM event_participants WHERE event_id = $1 AND user_id = $2 FOR UPDATE', [
				etkinlikId,
				userId,
			])
		).rows[0];
		if (!row || Number(row.registered_at) <= 0) return false;
		if (row.status === 'attended' || row.attended_at !== null) {
			await client.query('UPDATE event_participants SET registered_at = 0 WHERE event_id = $1 AND user_id = $2', [etkinlikId, userId]);
			return true;
		}
		const del = await client.query('DELETE FROM event_participants WHERE event_id = $1 AND user_id = $2', [etkinlikId, userId]);
		return (del.rowCount ?? 0) > 0;
	});
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
		const now = Date.now();
		const existing = (
			await client.query('SELECT status, attended_at FROM event_participants WHERE event_id = $1 AND user_id = $2 FOR UPDATE', [
				params.etkinlikId,
				params.userId,
			])
		).rows[0];
		if (existing && (existing.status === 'attended' || existing.attended_at !== null)) {
			return 'zaten';
		}
		if (existing) {
			await client.query(
				"UPDATE event_participants SET status = 'attended', checkin_method = $3, attended_at = $4, recorded_by = $5 WHERE event_id = $1 AND user_id = $2",
				[params.etkinlikId, params.userId, params.yontem, now, params.kaydedenId ?? null]
			);
		} else {
			await client.query(
				`INSERT INTO event_participants (id, event_id, user_id, status, checkin_method, registered_at, attended_at, recorded_by)
				 VALUES ($1, $2, $3, 'attended', $4, 0, $5, $6)`,
				[randomUUID(), params.etkinlikId, params.userId, params.yontem, now, params.kaydedenId ?? null]
			);
		}
		await client.query('UPDATE users SET xp = COALESCE(xp, 0) + $1 WHERE id = $2', [PARTICIPATION_XP, params.userId]);
		return 'ok';
	});
}

/** Removes a check-in recorded by mistake, and takes back the XP it paid. */
export async function deleteAttendance(etkinlikId: string, userId: string): Promise<boolean> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const existing = (
			await client.query('SELECT status, attended_at, registered_at FROM event_participants WHERE event_id = $1 AND user_id = $2 FOR UPDATE', [
				etkinlikId,
				userId,
			])
		).rows[0];
		if (!existing || (existing.status !== 'attended' && existing.attended_at === null)) return false;

		if (Number(existing.registered_at) > 0) {
			await client.query(
				"UPDATE event_participants SET status = 'kayitli', checkin_method = NULL, attended_at = NULL, recorded_by = NULL WHERE event_id = $1 AND user_id = $2",
				[etkinlikId, userId]
			);
		} else {
			await client.query('DELETE FROM event_participants WHERE event_id = $1 AND user_id = $2', [etkinlikId, userId]);
		}
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

const EVENT_PATCH_COLUMNS: Record<string, string> = {
	baslik: 'title',
	tur: 'category',
	aciklama: 'description',
	konum: 'location',
	baslangic: 'starts_at',
	endTime: 'ends_at',
	kapasite: 'capacity',
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
	for (const key of ['baslik', 'tur', 'aciklama', 'konum', 'baslangic', 'endTime', 'kapasite', 'status'] as const) {
		if (patch[key] !== undefined) set(EVENT_PATCH_COLUMNS[key], patch[key]);
	}
	if (patch.yoklamaAcik !== undefined) set('checkin_open', patch.yoklamaAcik ? 1 : 0);
	if (patch.ownerTeamId !== undefined) set('owner_team_id', patch.ownerTeamId);
	if (patch.ownerUserId !== undefined) set('owner_user_id', patch.ownerUserId);
	if (!sets.length) return true;
	values.push(id);
	const res = await getPgPool().query(`UPDATE events SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
	return (res.rowCount ?? 0) > 0;
}

/** Deletes an event nobody attended; one with check-ins is history and can only be cancelled. */
export async function deleteEvent(id: string): Promise<'ok' | 'katilim-var' | 'yok'> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const att = await client.query(
			"SELECT 1 FROM event_participants WHERE event_id = $1 AND (status = 'attended' OR attended_at IS NOT NULL) LIMIT 1",
			[id]
		);
		if (att.rowCount) return 'katilim-var';
		const res = await client.query('DELETE FROM events WHERE id = $1', [id]);
		return (res.rowCount ?? 0) > 0 ? 'ok' : 'yok';
	});
}
