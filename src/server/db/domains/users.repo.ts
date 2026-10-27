import { getPgPool, ensurePostgresInit } from '@/db';
import type { YaklasanIade } from '@/db/schema';

export interface UserSummary {
	takimlar: { id: string; ad: string; role: string; kaptanMi: boolean }[];
	katilinanEtkinlik: number;
	kayitliEtkinlik: number;
	tamamlananGorev: number;
	acikGorev: number;
	sertifika: number;
	proje: number;
}

/** Inventory on loan to the member that is due back before until (epoch ms), soonest first. */
export async function getUserUpcomingReturns(
	userId: string,
	until: number
): Promise<YaklasanIade[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`
		SELECT id, kod, ad, iadeTarihi
		FROM envanter
		WHERE oduncAlanId = $1
		  AND status = 'oduncte'
		  AND iadeTarihi IS NOT NULL
		  AND iadeTarihi <= $2
		ORDER BY iadeTarihi ASC
		LIMIT 20
	`,
		[userId, until]
	);
	return res.rows;
}

export async function updateUserProfile(
	id: string,
	patch: { bio?: string | null; bolum?: string; sinif?: number; profilFoto?: string | null }
): Promise<void> {
	await ensurePostgresInit();
	const sets: string[] = [];
	const values: unknown[] = [];
	const colMap: Record<string, string> = {
		bio: 'bio',
		bolum: 'department',
		sinif: 'grade',
		profilFoto: 'avatar_url',
	};
	for (const key of ['bio', 'bolum', 'sinif', 'profilFoto'] as const) {
		if (patch[key] !== undefined) {
			values.push(patch[key]);
			sets.push(`${colMap[key]} = $${values.length}`);
		}
	}
	if (!sets.length) return;
	values.push(id);
	await getPgPool().query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
}

export async function getUserSummary(id: string): Promise<UserSummary> {
	await ensurePostgresInit();
	const db = getPgPool();
	const [teams, counts] = await Promise.all([
		db.query(
			`SELECT t.id, t.ad, tu.takimRolu AS role, (t.liderId = $1) AS "kaptanMi"
			 FROM takim_uyeleri tu JOIN takimlar t ON t.id = tu.teamId
			 WHERE tu.userId = $1 AND tu.status = 'aktif'
			 ORDER BY tu.katilimTarihi ASC`,
			[id]
		),
		db.query(
			`SELECT
			   (SELECT COUNT(*) FROM yoklamalar WHERE userId = $1)::int AS "katilinanEtkinlik",
			   (SELECT COUNT(*) FROM etkinlik_kayitlari WHERE userId = $1)::int AS "kayitliEtkinlik",
			   (SELECT COUNT(*) FROM takim_gorevleri WHERE atananUyeId = $1 AND status = 'tamamlandi')::int AS "tamamlananGorev",
			   (SELECT COUNT(*) FROM takim_gorevleri WHERE atananUyeId = $1 AND status <> 'tamamlandi')::int AS "acikGorev",
			   (SELECT COUNT(*) FROM sertifikalar WHERE userId = $1)::int AS "sertifika",
			   (SELECT COUNT(*) FROM projeler WHERE olusturanId = $1 AND status = 'yayinda')::int AS "proje"`,
			[id]
		),
	]);
	return {
		takimlar: teams.rows.map((r) => ({ id: r.id, ad: r.ad, role: r.role, kaptanMi: Boolean(r.kaptanMi) })),
		...(counts.rows[0] as Omit<UserSummary, 'takimlar'>),
	};
}
