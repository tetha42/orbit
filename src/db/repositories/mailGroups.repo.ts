import { ensurePostgresInit, getPgPool } from '@/db';

export type MailRecipientGroupKind = 'members' | 'role' | 'team' | 'committee';

export interface MailRecipientGroup {
	id: string;
	kind: MailRecipientGroupKind;
	label: string;
	count: number;
	emails: string[];
}

/**
 * The single source for "who gets this mail": active members, a global role, a
 * working group or a committee. Callers only send e-mail addresses to the SMTP
 * layer; this resolver never leaks non-address profile data.
 */
export async function getMailRecipientGroups(): Promise<MailRecipientGroup[]> {
	await ensurePostgresInit();
	const db = getPgPool();
	const [members, roles, teams] = await Promise.all([
		db.query(
			`SELECT email FROM users
			 WHERE status = 'aktif' AND email IS NOT NULL AND email <> ''
			 ORDER BY email`
		),
		db.query(
			`SELECT r.id, r.ad, u.email
			 FROM roles r JOIN users u ON u.role_id = r.id
			 WHERE u.status = 'aktif' AND u.email IS NOT NULL AND u.email <> ''
			 ORDER BY r.ad, u.email`
		),
		db.query(
			`SELECT t.id, t.ad, t.type, u.email
			 FROM teams t
			 JOIN team_members tm ON tm.teamId = t.id AND tm.status = 'aktif'
			 JOIN users u ON u.id = tm.userId
			 WHERE t.status = 'aktif' AND u.status = 'aktif'
			   AND u.email IS NOT NULL AND u.email <> ''
			 ORDER BY t.ad, u.email`
		),
	]);

	const memberEmails = members.rows.map((row) => String(row.email));
	const groups: MailRecipientGroup[] = [
		{
			id: 'all-members',
			kind: 'members',
			label: 'All active members',
			count: new Set(memberEmails).size,
			emails: [...new Set(memberEmails)],
		},
	];

	const roleMap = new Map<string, { id: string; label: string; emails: Set<string> }>();
	for (const row of roles.rows) {
		const id = String(row.id);
		if (!roleMap.has(id)) roleMap.set(id, { id, label: String(row.ad), emails: new Set() });
		roleMap.get(id)!.emails.add(String(row.email));
	}
	for (const group of roleMap.values()) {
		groups.push({
			id: `role:${group.id}`,
			kind: 'role',
			label: group.label,
			count: group.emails.size,
			emails: [...group.emails],
		});
	}

	const teamMap = new Map<string, { id: string; label: string; type: string; emails: Set<string> }>();
	for (const row of teams.rows) {
		const id = String(row.id);
		if (!teamMap.has(id)) {
			teamMap.set(id, {
				id,
				label: String(row.ad),
				type: String(row.type ?? 'working_group'),
				emails: new Set(),
			});
		}
		teamMap.get(id)!.emails.add(String(row.email));
	}
	for (const group of teamMap.values()) {
		groups.push({
			id: `${group.type === 'committee' ? 'committee' : 'team'}:${group.id}`,
			kind: group.type === 'committee' ? 'committee' : 'team',
			label: group.label,
			count: group.emails.size,
			emails: [...group.emails],
		});
	}

	return groups.sort((a, b) => {
		const order: Record<MailRecipientGroupKind, number> = { members: 0, role: 1, team: 2, committee: 3 };
		return order[a.kind] - order[b.kind] || a.label.localeCompare(b.label);
	});
}
