import { getPgPool, ensurePostgresInit, isDatabaseConfigured } from '@/db';
import { withTransaction } from '@/db/index';
import { logAuditEvent, type AuditContext } from '@/db/audit';
import { alanFarki, memberTargetName } from '@/lib/audit';
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

const EMPTY_USER_SUMMARY: UserSummary = {
	takimlar: [],
	katilinanEtkinlik: 0,
	kayitliEtkinlik: 0,
	tamamlananGorev: 0,
	acikGorev: 0,
	sertifika: 0,
	proje: 0,
};

/** Inventory on loan to the member that is due back before until (epoch ms), soonest first. */
export async function getUserUpcomingReturns(
	userId: string,
	until: number
): Promise<YaklasanIade[]> {
	if (!userId || !isDatabaseConfigured()) return [];
	try {
		await ensurePostgresInit();
		const res = await getPgPool().query(
			`
			SELECT id, kod, ad, iadeTarihi
			FROM inventory
			WHERE oduncAlanId = $1
			  AND status = 'oduncte'
			  AND iadeTarihi IS NOT NULL
			  AND iadeTarihi <= $2
			ORDER BY iadeTarihi ASC
			LIMIT 20
		`,
			[userId, until]
		);
		return res.rows ?? [];
	} catch (error) {
		console.error('getUserUpcomingReturns error:', error);
		return [];
	}
}

export async function updateUserProfile(
	id: string,
	patch: { bio?: string | null; bolum?: string; sinif?: number; profilFoto?: string | null },
	denetim?: AuditContext
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

	if (!denetim) {
		values.push(id);
		await getPgPool().query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
		return;
	}

	await withTransaction(async (client) => {
		const beforeRes = await client.query(
			`SELECT first_name, last_name, email, bio, department, grade, avatar_url
			 FROM users WHERE id = $1 FOR UPDATE`,
			[id]
		);
		const row = beforeRes.rows[0];
		if (!row) return;

		values.push(id);
		await client.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${values.length}`, values);

		const before = {
			ad: `${row.first_name} ${row.last_name}`.trim(),
			email: String(row.email),
			bio: row.bio ?? null,
			bolum: row.department ?? null,
			sinif: Number(row.grade) || 0,
			profilFoto: row.avatar_url ?? null,
		};
		const after = {
			...before,
			...(patch.bio !== undefined ? { bio: patch.bio } : {}),
			...(patch.bolum !== undefined ? { bolum: patch.bolum } : {}),
			...(patch.sinif !== undefined ? { sinif: patch.sinif } : {}),
			...(patch.profilFoto !== undefined ? { profilFoto: patch.profilFoto } : {}),
		};
		const fark = alanFarki(before, after);
		if (!fark) return;
		await logAuditEvent(client, denetim, {
			islem: 'uye.profil',
			hedefTur: 'uye',
			hedefId: id,
			hedefAd: memberTargetName({
				ad: String(row.first_name),
				soyad: String(row.last_name),
				email: String(row.email),
			}),
			onceki: fark.onceki,
			sonraki: fark.sonraki,
		});
	});
}

export async function getUserSummary(id: string): Promise<UserSummary> {
	if (!id || !isDatabaseConfigured()) return { ...EMPTY_USER_SUMMARY };
	try {
		await ensurePostgresInit();
		const db = getPgPool();
		const [teams, counts] = await Promise.all([
			db.query(
				`SELECT t.id, t.ad, tu.takimRolu AS role, (t.liderId = $1) AS "kaptanMi"
				 FROM team_members tu JOIN teams t ON t.id = tu.teamId
				 WHERE tu.userId = $1 AND tu.status = 'aktif'
				 ORDER BY tu.katilimTarihi ASC`,
				[id]
			),
			db.query(
				`SELECT
				   (SELECT COUNT(*) FROM attendances WHERE userId = $1)::int AS "katilinanEtkinlik",
				   (SELECT COUNT(*) FROM event_registrations WHERE userId = $1)::int AS "kayitliEtkinlik",
				   (SELECT COUNT(*) FROM team_tasks WHERE atananUyeId = $1 AND status = 'tamamlandi')::int AS "tamamlananGorev",
				   (SELECT COUNT(*) FROM team_tasks WHERE atananUyeId = $1 AND status <> 'tamamlandi')::int AS "acikGorev",
				   (SELECT COUNT(*) FROM certificates WHERE userId = $1)::int AS "sertifika",
				   (SELECT COUNT(*) FROM projects WHERE olusturanId = $1 AND status = 'yayinda')::int AS "proje"`,
				[id]
			),
		]);
		const row = (counts.rows[0] ?? {}) as Partial<Omit<UserSummary, 'takimlar'>>;
		return {
			takimlar: (teams.rows ?? []).map((r) => ({
				id: String(r.id),
				ad: String(r.ad ?? ''),
				role: String(r.role ?? ''),
				kaptanMi: Boolean(r.kaptanMi),
			})),
			katilinanEtkinlik: Number(row.katilinanEtkinlik ?? 0),
			kayitliEtkinlik: Number(row.kayitliEtkinlik ?? 0),
			tamamlananGorev: Number(row.tamamlananGorev ?? 0),
			acikGorev: Number(row.acikGorev ?? 0),
			sertifika: Number(row.sertifika ?? 0),
			proje: Number(row.proje ?? 0),
		};
	} catch (error) {
		console.error('getUserSummary error:', error);
		return { ...EMPTY_USER_SUMMARY };
	}
}
