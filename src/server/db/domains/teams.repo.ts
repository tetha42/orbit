import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { ensurePostgresInit, getPgPool, withTransaction } from '@/db/index';
import type { Team, TeamMember } from '@/db/schema';
import { BEKLEYEN_BASVURU_MAX, KAPTAN_ROLU, TAKIM_SINIRI } from '@/lib/teams';
import { slugify, uniqueSlug } from '@/lib/text';
import { unassignTeamMemberTasks } from './kanban.repo';

export * from './kanban.repo';

export type TeamJoinResult =
	| { ok: true; status: 'aktif' | 'basvurdu'; message: string }
	| { ok: false; status?: number; message: string };

export interface TeamPatch {
	ad?: string;
	aciklama?: string;
	kategori?: string;
	kontenjan?: number;
	repoUrl?: string | null;
	status?: 'aktif' | 'askida' | 'tamamlandi';
	katilimTuru?: 'acik' | 'onayli';
	liderId?: string;
}

const TEAM_QUERY = `
	SELECT t.*, k.ad || ' ' || k.soyad as "liderAdSoyad",
	       (SELECT COUNT(*) FROM takim_uyeleri tu WHERE tu.teamId = t.id AND tu.status = 'aktif')::int as "aktifUyeSayisi"
	FROM takimlar t LEFT JOIN kullanicilar k ON t.liderId = k.id
`;

export async function getTeams(): Promise<Team[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(`${TEAM_QUERY} ORDER BY t.olusturma DESC`);
	return res.rows;
}

export async function getTeamById(id: string): Promise<Team | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(`${TEAM_QUERY} WHERE t.id = $1 OR t.slug = $2`, [id, id]);
	return res.rows[0] || null;
}

export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT tu.*, k.ad || ' ' || k.soyad as "kullaniciAdSoyad", k.profilFoto as "kullaniciProfilFoto",
		       k.bolum as "kullaniciBolum", k.sinif as "kullaniciSinif"
		FROM takim_uyeleri tu JOIN kullanicilar k ON tu.userId = k.id
		WHERE tu.teamId = $1 ORDER BY tu.katilimTarihi ASC`,
		[teamId]
	);
	return res.rows;
}

export async function getUserTeamIds(userId: string): Promise<string[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query("SELECT teamId FROM takim_uyeleri WHERE userId = $1 AND status = 'aktif'", [userId]);
	return res.rows.map((r) => r.teamId);
}

export async function getLedTeams(userId: string): Promise<Team[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query('SELECT * FROM takimlar WHERE liderId = $1 ORDER BY ad', [userId]);
	return res.rows;
}

export async function joinTeam(params: {
	teamId: string;
	userId: string;
	takimRolu?: string;
	basvuruNotu?: string | null;
	direct?: boolean;
	/**
	 * Treat the join as an application even in an open team — for members who hold no role
	 * yet (onboarding), whom nobody has vetted. Also refuses a full team and caps pending applications.
	 */
	basvuruZorunlu?: boolean;
}): Promise<TeamJoinResult> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const team = (await client.query('SELECT * FROM takimlar WHERE id = $1 FOR UPDATE', [params.teamId])).rows[0];
		if (!team) return { ok: false, status: 404, message: 'Takım bulunamadı.' };
		if (team.status !== 'aktif') return { ok: false, status: 409, message: 'Bu takım şu anda yeni üye almıyor.' };

		const existing = (await client.query('SELECT status FROM takim_uyeleri WHERE teamId = $1 AND userId = $2', [params.teamId, params.userId])).rows[0];
		const current = existing?.status as string | undefined;
		if (current === 'aktif') return { ok: false, status: 409, message: 'Bu takıma zaten üyesiniz.' };
		if (current === 'basvurdu' && !params.direct) return { ok: false, status: 409, message: 'Başvurunuz zaten değerlendirmede.' };

		const asApp = (team.katilimTuru === 'onayli' || !!params.basvuruZorunlu) && !params.direct;
		// A direct join takes a seat now. A normal application waits for the captain, who is
		// held to the quota when accepting; the onboarding application is refused up front.
		if (!asApp || params.basvuruZorunlu) {
			const count = await client.query("SELECT COUNT(*)::int AS n FROM takim_uyeleri WHERE teamId = $1 AND status = 'aktif'", [params.teamId]);
			if (Number(count.rows[0].n) >= Number(team.kontenjan)) return { ok: false, status: 409, message: 'Takım kontenjanı dolu.' };
		}
		const mine = await client.query("SELECT COUNT(*)::int AS n FROM takim_uyeleri WHERE userId = $1 AND status = 'aktif'", [params.userId]);
		if (Number(mine.rows[0].n) >= TAKIM_SINIRI) {
			return { ok: false, status: 409, message: `Aynı anda en fazla ${TAKIM_SINIRI} takımda yer alabilirsiniz.` };
		}

		if (params.basvuruZorunlu) {
			const pending = await client.query("SELECT COUNT(*)::int AS n FROM takim_uyeleri WHERE userId = $1 AND status = 'basvurdu'", [params.userId]);
			if (Number(pending.rows[0].n) >= BEKLEYEN_BASVURU_MAX) {
				return { ok: false, status: 429, message: `Aynı anda en fazla ${BEKLEYEN_BASVURU_MAX} başvurunuz bekleyebilir.` };
			}
		}

		const status = asApp ? 'basvurdu' : 'aktif';
		// A new try starts from a clean slate: the previous answer no longer applies.
		await client.query('DELETE FROM takim_basvuru_kararlari WHERE teamId = $1 AND userId = $2', [params.teamId, params.userId]);
		if (current) {
			await client.query('UPDATE takim_uyeleri SET status = $1, katilimTarihi = $2 WHERE teamId = $3 AND userId = $4', [status, Date.now(), params.teamId, params.userId]);
		} else {
			await client.query(
				`INSERT INTO takim_uyeleri (id, teamId, userId, takimRolu, status, basvuruNotu, katilimTarihi) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
				[randomUUID(), params.teamId, params.userId, params.takimRolu || 'Geliştirici', status, params.basvuruNotu || null, Date.now()]
			);
		}
		return { ok: true, status, message: asApp ? 'Başvurunuz takım kaptanına iletildi.' : 'Takıma katıldınız.' };
	});
}

export async function leaveTeam(params: { teamId: string; userId: string; aktorId?: string }): Promise<{ success: boolean; status?: number; message: string }> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const team = (await client.query('SELECT liderId FROM takimlar WHERE id = $1', [params.teamId])).rows[0];
		if (!team) return { success: false, status: 404, message: 'Takım bulunamadı.' };
		if (team.liderId === params.userId) return { success: false, status: 409, message: 'Kaptan takımdan çıkarılamaz; önce kaptanlığı devredin.' };

		const res = await client.query('DELETE FROM takim_uyeleri WHERE teamId = $1 AND userId = $2 RETURNING status', [params.teamId, params.userId]);
		if (!res.rowCount) return { success: false, status: 404, message: 'Takım üyeliği bulunamadı.' };
		await client.query('DELETE FROM takim_basvuru_kararlari WHERE teamId = $1 AND userId = $2', [params.teamId, params.userId]);

		await unassignTeamMemberTasks(client, params.teamId, params.userId, params.aktorId ?? params.userId);
		return { success: true, message: res.rows[0].status === 'basvurdu' ? 'Başvurunuz geri çekildi.' : 'Takımdan ayrıldınız.' };
	});
}

export type ApplicationDecision = 'kabul' | 'red';

async function saveDecision(client: PoolClient, teamId: string, userId: string, karar: ApplicationDecision): Promise<void> {
	await client.query(
		`INSERT INTO team_application_decisions (teamId, userId, karar, date) VALUES ($1, $2, $3, $4)
		 ON CONFLICT (teamId, userId) DO UPDATE SET karar = EXCLUDED.karar, date = EXCLUDED.date`,
		[teamId, userId, karar, Date.now()]
	);
}

/** A team as the onboarding showcase lists it for one member. */
export interface TeamShowcaseRecord {
	id: string;
	ad: string;
	slug: string;
	aciklama: string;
	kategori: string;
	kontenjan: number;
	liderAdSoyad: string | null;
	katilimTuru: 'acik' | 'onayli';
	aktifUyeSayisi: number;
	kalanKontenjan: number;
	/** The member's own standing in the team. */
	benimDurumum: 'aktif' | 'basvurdu' | null;
	/** The captain's last answer to this member's application, if any. */
	benimKararim: ApplicationDecision | null;
	kararTarihi: number | null;
}

/** The teams that are taking members, with the caller's own standing in each. No rosters, tasks or notes. */
export async function getTeamShowcase(userId: string): Promise<TeamShowcaseRecord[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT t.id, t.ad, t.slug, t.aciklama, t.kategori, t.kontenjan, t.katilimTuru AS "katilimTuru",
		        k.ad || ' ' || k.soyad AS "liderAdSoyad",
		        (SELECT COUNT(*) FROM takim_uyeleri a WHERE a.teamId = t.id AND a.status = 'aktif')::int AS "aktifUyeSayisi",
		        me.status AS "benimDurumum", d.karar AS "benimKararim", d.date AS "kararTarihi"
		 FROM takimlar t
		 LEFT JOIN kullanicilar k ON k.id = t.liderId
		 LEFT JOIN takim_uyeleri me ON me.teamId = t.id AND me.userId = $1
		 LEFT JOIN takim_basvuru_kararlari d ON d.teamId = t.id AND d.userId = $1
		 WHERE t.status = 'aktif' OR me.status IS NOT NULL
		 ORDER BY t.olusturma DESC`,
		[userId]
	);
	return res.rows.map((r) => ({
		...r,
		kalanKontenjan: Math.max(0, Number(r.kontenjan) - Number(r.aktifUyeSayisi)),
	}));
}

/** Answers to this member's applications since `since`, newest first — for the notification feed. */
export async function getUserApplicationDecisions(
	userId: string,
	since: number
): Promise<{ teamId: string; takimAdi: string; karar: ApplicationDecision; date: number }[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT d.teamId AS "teamId", t.ad AS "takimAdi", d.karar, d.date
		 FROM takim_basvuru_kararlari d JOIN takimlar t ON t.id = d.teamId
		 WHERE d.userId = $1 AND d.date >= $2
		 ORDER BY d.date DESC LIMIT 10`,
		[userId, since]
	);
	return res.rows;
}

export async function decideTeamApplication(params: { teamId: string; userId: string; accept: boolean }): Promise<{ success: boolean; status?: number; message: string }> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const team = (await client.query('SELECT * FROM takimlar WHERE id = $1 FOR UPDATE', [params.teamId])).rows[0];
		if (!team) return { success: false, status: 404, message: 'Takım bulunamadı.' };
		const app = await client.query("SELECT 1 FROM takim_uyeleri WHERE teamId = $1 AND userId = $2 AND status = 'basvurdu'", [params.teamId, params.userId]);
		if (!app.rowCount) return { success: false, status: 404, message: 'Bekleyen başvuru bulunamadı.' };
		if (!params.accept) {
			await client.query('DELETE FROM takim_uyeleri WHERE teamId = $1 AND userId = $2', [params.teamId, params.userId]);
			await saveDecision(client, params.teamId, params.userId, 'red');
			return { success: true, message: 'Başvuru reddedildi.' };
		}
		const count = await client.query("SELECT COUNT(*)::int AS n FROM takim_uyeleri WHERE teamId = $1 AND status = 'aktif'", [params.teamId]);
		if (Number(count.rows[0].n) >= Number(team.kontenjan)) return { success: false, status: 409, message: 'Takım kontenjanı dolu.' };
		const mine = await client.query("SELECT COUNT(*)::int AS n FROM takim_uyeleri WHERE userId = $1 AND status = 'aktif'", [params.userId]);
		if (Number(mine.rows[0].n) >= TAKIM_SINIRI) return { success: false, status: 409, message: `Bu üye zaten ${TAKIM_SINIRI} takımda.` };
		await client.query("UPDATE takim_uyeleri SET status = 'aktif', katilimTarihi = $3 WHERE teamId = $1 AND userId = $2", [params.teamId, params.userId, Date.now()]);
		await saveDecision(client, params.teamId, params.userId, 'kabul');
		return { success: true, message: 'Başvuru kabul edildi.' };
	});
}

export async function setTeamMemberRole(teamId: string, userId: string, role: string): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query("UPDATE takim_uyeleri SET takimRolu = $3 WHERE teamId = $1 AND userId = $2 AND status = 'aktif'", [teamId, userId, role]);
	return (res.rowCount ?? 0) > 0;
}

export async function updateTeam(id: string, patch: TeamPatch): Promise<boolean> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const team = (await client.query('SELECT * FROM takimlar WHERE id = $1 FOR UPDATE', [id])).rows[0];
		if (!team) return false;
		const sets: string[] = [];
		const values: unknown[] = [];
		const set = (col: string, val: unknown) => {
			values.push(val);
			sets.push(`${col} = $${values.length}`);
		};
		for (const key of ['ad', 'aciklama', 'kategori', 'kontenjan', 'repoUrl', 'status', 'katilimTuru'] as const) {
			if (patch[key] !== undefined) set(key, patch[key]);
		}
		if (patch.liderId !== undefined && patch.liderId !== team.liderId) {
			set('liderId', patch.liderId);
			await client.query(
				`INSERT INTO team_members (id, teamId, userId, takimRolu, status, katilimTarihi) VALUES ($1, $2, $3, $4, 'aktif', $5)
				 ON CONFLICT (teamId, userId) DO UPDATE SET status = 'aktif', takimRolu = $4`,
				[randomUUID(), id, patch.liderId, KAPTAN_ROLU, Date.now()]
			);
			if (team.liderId) {
				await client.query(`UPDATE team_members SET takimRolu = 'Ar-Ge Üyesi' WHERE teamId = $1 AND userId = $2 AND takimRolu = $3`, [id, team.liderId, KAPTAN_ROLU]);
			}
		}
		if (!sets.length) return true;
		values.push(id);
		await client.query(`UPDATE takimlar SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
		return true;
	});
}

export async function createTeam(params: {
	ad: string;
	kategori: string;
	aciklama: string;
	kontenjan?: number;
	repoUrl?: string;
	liderId?: string;
	katilimTuru?: 'acik' | 'onayli';
}): Promise<Team> {
	await ensurePostgresInit();
	const id = `tkm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
	const slug = await uniqueSlug(slugify(params.ad), async (c) => ((await getPgPool().query('SELECT 1 FROM takimlar WHERE slug = $1', [c])).rowCount ?? 0) > 0, 'takim');
	const now = Date.now();
	const kontenjan = Number(params.kontenjan) || 6;

	await getPgPool().query(
		`INSERT INTO takimlar (id, ad, slug, kategori, aciklama, liderId, kontenjan, repoUrl, status, olusturma, katilimTuru)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'aktif', $9, $10)`,
		[id, params.ad.trim(), slug, params.kategori.trim(), params.aciklama.trim(), params.liderId || null, kontenjan, params.repoUrl?.trim() || null, now, params.katilimTuru ?? 'acik']
	);

	if (params.liderId) {
		const tuId = `tu_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
		await getPgPool().query(
			`INSERT INTO team_members (id, teamId, userId, takimRolu, status, katilimTarihi)
			 VALUES ($1, $2, $3, 'Takım Kaptanı', 'aktif', $4) ON CONFLICT (teamId, userId) DO NOTHING`,
			[tuId, id, params.liderId, now]
		);
	}
	const team = await getTeamById(id);
	if (!team) throw new Error('Takım oluşturulamadı');
	return team;
}

export async function deleteTeam(id: string): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query('DELETE FROM takimlar WHERE id = $1', [id]);
	return (res.rowCount ?? 0) > 0;
}

export async function getPendingTeamApplications(
	userId: string,
	allTeams: boolean
): Promise<{ teamId: string; takimAdi: string; userId: string; adSoyad: string; bolum: string; olusturma: number }[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT tu.teamId AS "teamId", t.ad AS "takimAdi", tu.userId AS "userId",
		        k.ad || ' ' || k.soyad AS "adSoyad", k.bolum AS "bolum", tu.katilimTarihi AS "olusturma"
		 FROM takim_uyeleri tu JOIN takimlar t ON t.id = tu.teamId JOIN kullanicilar k ON k.id = tu.userId
		 WHERE tu.status = 'basvurdu' AND ($2::boolean OR t.liderId = $1)
		 ORDER BY tu.katilimTarihi DESC LIMIT 20`,
		[userId, allTeams]
	);
	return res.rows;
}
