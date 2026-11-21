import { getPgPool, ensurePostgresInit } from '@/db';
import type { ChatContactItem, ChatRoomMemberItem } from './types';

export async function getRoomMembers(roomId: string): Promise<ChatRoomMemberItem[]> {
	await ensurePostgresInit();
	const p = getPgPool();
	const res = await p.query(
		`SELECT k.id, k.first_name AS name, k.last_name AS surname, k.avatar_url AS "profilePhoto", k.department AS department, r.name AS "roleName"
		 FROM chat_members su
		 JOIN users k ON k.id = su.user_id
		 LEFT JOIN roles r ON r.id = k.role_id
		 WHERE su.room_id = $1
		 ORDER BY k.first_name ASC, k.last_name ASC`,
		[roomId]
	);

	return res.rows.map((r) => {
		const firstName = String(r.name ?? '');
		const lastName = String(r.surname ?? '');
		const avatarUrl = r.profilePhoto ? String(r.profilePhoto) : null;
		const roleName = r.roleName ? String(r.roleName) : null;
		const department = r.department ? String(r.department) : '';
		return {
			id: String(r.id),
			firstName,
			lastName,
			avatarUrl,
			roleName,
			department,
			name: firstName,
			surname: lastName,
			profilePhoto: avatarUrl,
		};
	});
}

export async function getChatContacts(excludeUserId: string): Promise<ChatContactItem[]> {
	await ensurePostgresInit();
	const p = getPgPool();
	const res = await p.query(
		`SELECT k.id, k.first_name AS name, k.last_name AS surname, k.avatar_url AS "profilePhoto", k.department AS department, r.name AS "roleName"
		 FROM users k
		 LEFT JOIN roles r ON r.id = k.role_id
		 WHERE k.status = 'active' AND k.id <> $1
		 ORDER BY k.first_name ASC, k.last_name ASC`,
		[excludeUserId]
	);

	return res.rows.map((r) => ({
		id: String(r.id),
		name: String(r.name),
		surname: String(r.surname),
		profilePhoto: r.profilePhoto ? String(r.profilePhoto) : null,
		roleName: r.roleName ? String(r.roleName) : null,
		department: r.department ? String(r.department) : '',
	}));
}
