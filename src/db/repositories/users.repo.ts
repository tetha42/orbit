import { getPgPool, ensurePostgresInit, isDatabaseConfigured } from '@/db';
import { withTransaction } from '@/db/index';
import { logAuditEvent, type AuditContext } from '@/db/audit';
import { fieldDiff, memberTargetName } from '@/lib/audit';
import type { UpcomingReturn } from '@/db/schema';

export interface UserSummary {
	teams: { id: string; name: string; role: string; captainMi: boolean }[];
	attendedEvent: number;
	registeredEvent: number;
	completedTask: number;
	openTask: number;
	certificate: number;
	project: number;
}

const EMPTY_USER_SUMMARY: UserSummary = {
	teams: [],
	attendedEvent: 0,
	registeredEvent: 0,
	completedTask: 0,
	openTask: 0,
	certificate: 0,
	project: 0,
};

/** Inventory on loan to the member that is due back before until (epoch ms), soonest first. */
export async function getUserUpcomingReturns(
	userId: string,
	until: number
): Promise<UpcomingReturn[]> {
	if (!userId || !isDatabaseConfigured()) return [];
	try {
		await ensurePostgresInit();
		const res = await getPgPool().query(
			`
			SELECT id, code AS code, name AS name, due_at AS "returnDate"
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
	patch: { bio?: string | null; department?: string; grade?: number; profilePhoto?: string | null },
	audit?: AuditContext
): Promise<void> {
	await ensurePostgresInit();
	const sets: string[] = [];
	const values: unknown[] = [];
	const colMap: Record<string, string> = {
		bio: 'bio',
		department: 'department',
		grade: 'grade',
		profilePhoto: 'avatar_url',
	};
	for (const key of ['bio', 'department', 'grade', 'profilePhoto'] as const) {
		if (patch[key] !== undefined) {
			values.push(patch[key]);
			sets.push(`${colMap[key]} = $${values.length}`);
		}
	}
	if (!sets.length) return;

	if (!audit) {
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
			name: `${row.first_name ?? row.firstName ?? ''} ${row.last_name ?? row.lastName ?? ''}`.trim(),
			email: String(row.email),
			bio: row.bio ?? null,
			department: row.department ?? null,
			grade: Number(row.grade) || 0,
			profilePhoto: row.avatar_url ?? row.avatarUrl ?? null,
		};
		const after = {
			...before,
			...(patch.bio !== undefined ? { bio: patch.bio } : {}),
			...(patch.department !== undefined ? { department: patch.department } : {}),
			...(patch.grade !== undefined ? { grade: patch.grade } : {}),
			...(patch.profilePhoto !== undefined ? { profilePhoto: patch.profilePhoto } : {}),
		};
		const diff = fieldDiff(before, after);
		if (!diff) return;
		await logAuditEvent(client, audit, {
			action: 'member.profile',
			targetType: 'member',
			targetId: id,
			targetName: memberTargetName({
				name: String(row.first_name ?? row.firstName ?? ''),
				surname: String(row.last_name ?? row.lastName ?? ''),
				email: String(row.email),
			}),
			before: diff.before,
			after: diff.after,
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
				`SELECT t.id, t.name AS name, tu.role_title AS role, (t.lead_id = $1) AS "captainMi"
				 FROM team_members tu JOIN teams t ON t.id = tu.team_id
				 WHERE tu.user_id = $1 AND tu.status IN ('aktif', 'active')
				 ORDER BY tu.joined_at ASC`,
				[id]
			),
			db.query(
				`SELECT
				   (SELECT COUNT(*) FROM event_participants WHERE user_id = $1 AND status = 'attended')::int AS "attendedEvent",
				   (SELECT COUNT(*) FROM event_participants WHERE user_id = $1 AND status IN ('registered', 'attended'))::int AS "registeredEvent",
				   (SELECT COUNT(*) FROM team_tasks WHERE assignee_id = $1 AND status IN ('tamamlandi', 'done'))::int AS "completedTask",
				   (SELECT COUNT(*) FROM team_tasks WHERE assignee_id = $1 AND status NOT IN ('tamamlandi', 'done'))::int AS "openTask",
				   (SELECT COUNT(*) FROM certificates WHERE user_id = $1)::int AS "certificate",
				   (SELECT COUNT(*) FROM projects WHERE created_by = $1 AND status IN ('yayinda', 'published'))::int AS "project"`,
				[id]
			),
		]);
		const row = (counts.rows[0] ?? {}) as Partial<Omit<UserSummary, 'teams'>>;
		return {
			teams: (teams.rows ?? []).map((r) => ({
				id: String(r.id),
				name: String(r.name ?? ''),
				role: String(r.role ?? ''),
				captainMi: Boolean(r.captainMi),
			})),
			attendedEvent: Number(row.attendedEvent ?? 0),
			registeredEvent: Number(row.registeredEvent ?? 0),
			completedTask: Number(row.completedTask ?? 0),
			openTask: Number(row.openTask ?? 0),
			certificate: Number(row.certificate ?? 0),
			project: Number(row.project ?? 0),
		};
	} catch (error) {
		console.error('getUserSummary error:', error);
		return { ...EMPTY_USER_SUMMARY };
	}
}
