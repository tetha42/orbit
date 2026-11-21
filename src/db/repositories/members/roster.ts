import { ensurePostgresInit, getPgPool, isDatabaseConfigured } from '@/db/index';
import type { User, MemberRosterRow } from '@/db/schema';
import { MEMBER_ROSTER_SQL } from '@/db/schema';
import { getUsersDiskUsage } from '../files.repo';
import type { MemberRosterOptions, PaginatedMemberRoster } from './normalize';

function parseRosterTeams(raw: unknown): MemberRosterRow['teams'] {
	let parsed: unknown = raw;
	if (typeof raw === 'string' && raw.trim()) {
		try {
			parsed = JSON.parse(raw);
		} catch {
			return [];
		}
	}
	if (!Array.isArray(parsed)) return [];
	// Legacy/foreign rows may contain the same team twice (leader + member).
	const byId = new Map<string, NonNullable<MemberRosterRow['teams']>[number]>();
	for (const item of parsed) {
		if (!item || typeof item !== 'object' || !(item as { id?: unknown }).id) continue;
		const team = item as NonNullable<MemberRosterRow['teams']>[number];
		const id = String(team.id);
		if (!byId.has(id)) byId.set(id, team);
	}
	return [...byId.values()];
}

function mapRosterRow(r: Record<string, unknown>): MemberRosterRow {
	const email = String(r.email ?? '');
	const roleId = (r.roleId ?? r.role_id ?? null) as string | null;
	const status = (r.status as User['status']) || 'active';
	const firstName = String(r.firstName ?? r.first_name ?? r.name ?? '');
	const lastName = String(r.lastName ?? r.last_name ?? r.surname ?? '');
	const handle = String(r.handle ?? r.studentNo ?? '');
	const department = String(r.department ?? '');
	const grade = Number(r.grade ?? 1);
	const avatarUrl = (r.avatarUrl ?? r.avatar_url ?? r.profilePhoto ?? undefined) as string | undefined;
	const createdAt = Number(r.createdAt ?? r.created_at ?? r.creation ?? 0);
	const roleName = (r.roleName ?? null) as string | null;
	const roleColor = (r.roleColor ?? null) as string | null;
	return {
		id: String(r.id ?? ''),
		firstName,
		lastName,
		name: firstName,
		surname: lastName,
		email,
		passwordHash: String(r.passwordHash ?? r.password_hash ?? ''),
		handle,
		studentNo: handle,
		department,
		grade,
		roleId,
		roleName,
		roleColor,
		avatarUrl,
		profilePhoto: avatarUrl,
		bio: (r.bio ?? undefined) as string | undefined,
		xp: Number(r.xp ?? 0),
		status,
		createdAt,
		teamName: (r.teamName ?? undefined) as string | undefined,
		teams: parseRosterTeams(r.teams),
		attendanceCount: Number(r.attendanceCount ?? 0),
	};
}

async function enrichRosterRows(rows: MemberRosterRow[], isManager?: boolean): Promise<MemberRosterRow[]> {
	const ids = rows.map((row) => row.id).filter(Boolean);
	if (ids.length > 0) {
		const visibilityFilter = isManager
			? "f.directory_visibility IN ('members', 'managers', 'hidden')"
			: "f.directory_visibility = 'members'";
		const [fields, users, diskMap] = await Promise.all([
			getPgPool().query(
				`SELECT f.field_key AS "fieldKey", f.type
				 FROM form_fields f
				 WHERE f.enabled = 1
				   AND f.archived_at IS NULL
				   AND ${visibilityFilter}`
			),
			getPgPool().query(`SELECT id, custom_fields AS "customFields" FROM users WHERE id = ANY($1)`, [ids]),
			getUsersDiskUsage(ids),
		]);
		const byUser = new Map<string, Record<string, string>>();
		for (const user of users.rows) {
			const stored = (user.customFields ?? {}) as Record<string, unknown>;
			const map: Record<string, string> = {};
			for (const field of fields.rows) {
				const key = String(field.fieldKey);
				if (stored[key] === undefined || stored[key] === null) continue;
				map[key] = String(field.type) === 'password' ? '••••••••' : String(stored[key]);
			}
			byUser.set(String(user.id), map);
		}
		for (const row of rows) {
			row.customFields = byUser.get(row.id) ?? {};
			const disk = diskMap.get(row.id);
			row.diskUsageBytes = disk?.bytes ?? 0;
			row.fileCount = disk?.count ?? 0;
		}
	}
	return rows;
}

export async function getMemberRoster(options: MemberRosterOptions & { page: number }): Promise<PaginatedMemberRoster>;
export async function getMemberRoster(options: MemberRosterOptions & { limit: number }): Promise<PaginatedMemberRoster>;
export async function getMemberRoster(options?: { isManager?: boolean; search?: string }): Promise<MemberRosterRow[]>;
export async function getMemberRoster(options?: MemberRosterOptions): Promise<MemberRosterRow[] | PaginatedMemberRoster> {
	const isPaginated = options?.page !== undefined || options?.limit !== undefined;
	if (!isDatabaseConfigured()) {
		return isPaginated
			? { members: [], totalCount: 0, page: options?.page ?? 1, limit: options?.limit ?? 20 }
			: [];
	}

	try {
		await ensurePostgresInit();
		if (isPaginated) {
			const page = Math.max(1, options?.page ?? 1);
			const limit = Math.max(1, Math.min(200, options?.limit ?? 20));
			const offset = (page - 1) * limit;
			const conditions: string[] = ['1=1'];
			const params: unknown[] = [];

			if (!options?.isManager) conditions.push("(status = 'active' OR status = 'alumni')");
			if (options?.search?.trim()) {
				params.push(`%${options.search.trim()}%`);
				conditions.push(
					`("firstName" ILIKE $${params.length} OR "lastName" ILIKE $${params.length} OR ` +
						`("firstName" || ' ' || "lastName") ILIKE $${params.length} OR email ILIKE $${params.length} ` +
						`OR handle ILIKE $${params.length} OR department ILIKE $${params.length})`
				);
			}

			const whereClause = conditions.join(' AND ');
			const dataParams = [...params, limit, offset];
			const [countRes, dataRes] = await Promise.all([
				getPgPool().query(
					`SELECT COUNT(*)::int AS count FROM (${MEMBER_ROSTER_SQL}) sub WHERE ${whereClause}`,
					params
				),
				getPgPool().query(
					`SELECT * FROM (${MEMBER_ROSTER_SQL}) sub WHERE ${whereClause} LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
					dataParams
				),
			]);
			const totalCount = Number(countRes.rows[0]?.count ?? 0);
			const rows = await enrichRosterRows(dataRes.rows.map(mapRosterRow), options?.isManager);
			return { members: rows, totalCount, page, limit };
		}

		if (options?.search?.trim()) {
			const conditions: string[] = ['1=1'];
			const params: unknown[] = [];
			if (!options?.isManager) conditions.push("(status = 'active' OR status = 'alumni')");
			params.push(`%${options.search.trim()}%`);
			conditions.push(
				`("firstName" ILIKE $${params.length} OR "lastName" ILIKE $${params.length} OR ` +
					`("firstName" || ' ' || "lastName") ILIKE $${params.length} OR email ILIKE $${params.length} ` +
					`OR handle ILIKE $${params.length} OR department ILIKE $${params.length})`
			);
			const res = await getPgPool().query(
				`SELECT * FROM (${MEMBER_ROSTER_SQL}) sub WHERE ${conditions.join(' AND ')}`,
				params
			);
			return await enrichRosterRows(res.rows.map(mapRosterRow), options?.isManager);
		}

		const res = await getPgPool().query(MEMBER_ROSTER_SQL);
		if (!res.rows?.length) return [];
		return await enrichRosterRows(res.rows.map(mapRosterRow), options?.isManager);
	} catch (err) {
		console.warn('[members.repo] getMemberRoster read warning:', err);
		return isPaginated
			? { members: [], totalCount: 0, page: options?.page ?? 1, limit: options?.limit ?? 20 }
			: [];
	}
}
