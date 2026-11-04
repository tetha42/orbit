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
			SELECT id, code AS kod, name AS ad, due_at AS "iadeTarihi"
			FROM inventory
			WHERE holder_user_id = $1
			  AND status IN ('oduncte', 'borrowed')
			  AND due_at IS NOT NULL
			  AND due_at <= $2
			ORDER BY due_at ASC
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
			ad: `${row.first_name ?? row.firstName ?? ''} ${row.last_name ?? row.lastName ?? ''}`.trim(),
			email: String(row.email),
			bio: row.bio ?? null,
			bolum: row.department ?? null,
			sinif: Number(row.grade) || 0,
			profilFoto: row.avatar_url ?? row.avatarUrl ?? null,
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
			action: 'member.profile',
			targetType: 'member',
			targetId: id,
			targetName: memberTargetName({
				ad: String(row.first_name ?? row.firstName ?? ''),
				soyad: String(row.last_name ?? row.lastName ?? ''),
				email: String(row.email),
			}),
			before: fark.before,
			after: fark.after,
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
				`SELECT t.id, t.name AS ad, tu.role_title AS role, (t.lead_id = $1) AS "kaptanMi"
				 FROM team_members tu JOIN teams t ON t.id = tu.team_id
				 WHERE tu.user_id = $1 AND tu.status IN ('aktif', 'active')
				 ORDER BY tu.joined_at ASC`,
				[id]
			),
			db.query(
				`SELECT
				   (SELECT COUNT(*) FROM event_participants WHERE user_id = $1 AND status = 'attended')::int AS "katilinanEtkinlik",
				   (SELECT COUNT(*) FROM event_participants WHERE user_id = $1 AND status IN ('registered', 'attended'))::int AS "kayitliEtkinlik",
				   (SELECT COUNT(*) FROM team_tasks WHERE assignee_id = $1 AND status IN ('tamamlandi', 'done'))::int AS "tamamlananGorev",
				   (SELECT COUNT(*) FROM team_tasks WHERE assignee_id = $1 AND status NOT IN ('tamamlandi', 'done'))::int AS "acikGorev",
				   (SELECT COUNT(*) FROM certificates WHERE user_id = $1)::int AS "sertifika",
				   (SELECT COUNT(*) FROM projects WHERE created_by = $1 AND status IN ('yayinda', 'published'))::int AS "proje"`,
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
