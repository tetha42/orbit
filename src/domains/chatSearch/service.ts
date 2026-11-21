import { ensurePostgresInit, getPgPool } from '@/db';
import { buildSearchSnippet } from './snippet';
import type { ChatSearchHit, ChatSearchParams, ChatSearchResult } from './types';

function escapeLikePattern(raw: string): string {
	return raw.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function parseHasAttachment(raw: unknown): boolean {
	if (Array.isArray(raw)) return raw.length > 0;
	if (typeof raw !== 'string') return false;
	const trimmed = raw.trim();
	if (!trimmed || trimmed === '[]') return false;
	try {
		const parsed = JSON.parse(trimmed);
		return Array.isArray(parsed) && parsed.length > 0;
	} catch {
		return false;
	}
}

export async function searchChatMessages(params: ChatSearchParams): Promise<ChatSearchResult> {
	const query = params.q.trim();
	const safeLimit = Math.max(1, Math.min(Math.trunc(params.limit ?? 25), 50));
	const safeOffset = Math.max(0, Math.trunc(params.offset ?? 0));
	if (query.length < 2) {
		return { hits: [], hasMore: false, nextOffset: safeOffset };
	}

	await ensurePostgresInit();
	const pool = getPgPool();

	const likePattern = `%${escapeLikePattern(query)}%`;
	const values: unknown[] = [params.userId, params.isAdmin, query, likePattern];
	const clauses: string[] = [];

	if (params.roomId) {
		values.push(params.roomId);
		clauses.push(`AND m.room_id = $${values.length}`);
	}
	if (params.senderId) {
		values.push(params.senderId);
		clauses.push(`AND m.sender_id = $${values.length}`);
	}
	if (params.hasAttachment) {
		clauses.push(`AND m.attachments IS NOT NULL AND m.attachments <> '' AND m.attachments <> '[]'`);
	}
	if (typeof params.from === 'number' && Number.isFinite(params.from)) {
		values.push(Math.trunc(params.from));
		clauses.push(`AND m.date >= $${values.length}`);
	}
	if (typeof params.to === 'number' && Number.isFinite(params.to)) {
		values.push(Math.trunc(params.to));
		clauses.push(`AND m.date <= $${values.length}`);
	}

	values.push(safeLimit + 1, safeOffset);
	const limitIdx = values.length - 1;
	const offsetIdx = values.length;

	const sql = `
		SELECT m.id,
		       m.room_id AS "roomId",
		       CASE
		         WHEN r.room_type = 'private'
		           AND (SELECT COUNT(*) FROM chat_members cm_c WHERE cm_c.room_id = r.id) = 2
		         THEN COALESCE(
		           (SELECT (u.first_name || ' ' || u.last_name)
		            FROM chat_members cm2
		            JOIN users u ON u.id = cm2.user_id
		            WHERE cm2.room_id = r.id AND cm2.user_id <> $1
		            LIMIT 1),
		           r.name
		         )
		         ELSE r.name
		       END AS "roomName",
		       r.room_type AS "roomType",
		       m.sender_id AS "senderId",
		       m.sender_name AS "senderName",
		       m.sender_avatar AS "senderPhoto",
		       m.content AS content,
		       m.attachments AS attachments,
		       m.date AS date
		FROM chat_messages m
		JOIN chat_rooms r ON r.id = m.room_id
		WHERE m.deleted_at IS NULL
		  AND r.room_type <> 'mail_thread'
		  AND (
		    r.room_type = 'general'
		    OR ($2 = true AND r.room_type = 'team')
		    OR (r.room_type = 'team' AND (
		      EXISTS (SELECT 1 FROM team_members tu WHERE tu.team_id = r.team_id AND tu.user_id = $1 AND tu.status = 'active')
		      OR EXISTS (SELECT 1 FROM chat_members su WHERE su.room_id = r.id AND su.user_id = $1)
		    ))
		    OR (r.room_type = 'private' AND EXISTS (SELECT 1 FROM chat_members su WHERE su.room_id = r.id AND su.user_id = $1))
		  )
		  AND (
		    to_tsvector('simple', coalesce(m.content, '')) @@ plainto_tsquery('simple', $3)
		    OR m.content ILIKE $4 ESCAPE '\\'
		  )
		  ${clauses.join('\n\t\t  ')}
		ORDER BY m.date DESC, m.id DESC
		LIMIT $${limitIdx} OFFSET $${offsetIdx}
	`;

	const res = await pool.query(sql, values);
	const hasMore = res.rows.length > safeLimit;
	const rows = hasMore ? res.rows.slice(0, safeLimit) : res.rows;

	const hits: ChatSearchHit[] = rows.map((row) => {
		const r = row as Record<string, unknown>;
		const content = String(r.content ?? '');
		const { snippet, matches } = buildSearchSnippet(content, query);
		const roomTypeRaw = String(r.roomType ?? 'general');
		const roomType: ChatSearchHit['roomType'] =
			roomTypeRaw === 'team' || roomTypeRaw === 'private' ? roomTypeRaw : 'general';

		return {
			id: String(r.id ?? ''),
			roomId: String(r.roomId ?? ''),
			roomName: String(r.roomName ?? 'Chat'),
			roomType,
			senderId: String(r.senderId ?? ''),
			senderName: String(r.senderName ?? 'Member'),
			senderPhoto: (r.senderPhoto ?? null) as string | null,
			content,
			snippet,
			matches,
			hasAttachment: parseHasAttachment(r.attachments),
			date: Number(r.date ?? 0),
		};
	});

	return {
		hits,
		hasMore,
		nextOffset: safeOffset + hits.length,
	};
}
