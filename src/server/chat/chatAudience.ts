import { getPgPool } from '@/db';

/**
 * Who may receive live events for a chat room.
 *
 * The SSE fanout used to call `canUserAccessChatRoom` once per event *per
 * connected client*. At 150 members and 150 messages/second that is ~22,500
 * access queries per second — far beyond the connection pool. The audience is
 * cheap to compute once per room and changes rarely, so it is cached briefly
 * here and reused by the SSE route and the notification helper.
 *
 * The TTL bounds how long a removed member could still receive messages. It is
 * deliberately short; membership changes through `addMembersToRoom` invalidate
 * the entry immediately. Team membership is managed elsewhere, so a team change
 * may take up to the TTL to be reflected.
 */

export interface ChatAudience {
	/** Everyone with chat access may read (the general room). */
	all: boolean;
	/** Team room: admins may read without being a member. */
	takim: boolean;
	memberIds: Set<string>;
	teamId: string | null;
	expiresAt: number;
}

const TTL_MS = 10_000;
const MAX_CACHE_ENTRIES = 500;

const GENERAL_ROOM_ID = 'oda_genel';

const GENERAL_AUDIENCE: ChatAudience = {
	all: true,
	takim: false,
	memberIds: new Set(),
	teamId: null,
	expiresAt: Number.POSITIVE_INFINITY,
};

const globalStore = globalThis as typeof globalThis & {
	__chatAudienceCache?: Map<string, ChatAudience>;
};

const cache = (globalStore.__chatAudienceCache ??= new Map<string, ChatAudience>());

/** Drop a cached audience (or the whole cache) after a membership change. */
export function invalidateChatAudience(odaId?: string): void {
	if (odaId) cache.delete(odaId);
	else cache.clear();
}

/** Synchronous lookup for a warm cache; lets the SSE path stay ordered and cheap. */
export function peekChatAudience(odaId: string): ChatAudience | null {
	if (odaId === GENERAL_ROOM_ID) return GENERAL_AUDIENCE;
	const hit = cache.get(odaId);
	if (hit && hit.expiresAt > Date.now()) return hit;
	return null;
}

export async function getChatAudience(odaId: string): Promise<ChatAudience | null> {
	const cached = peekChatAudience(odaId);
	if (cached) return cached;

	try {
		const p = getPgPool();
		const roomRes = await p.query(
			`SELECT tur, teamId AS "teamId" FROM chat_rooms WHERE id = $1 LIMIT 1`,
			[odaId]
		);
		const room = roomRes.rows[0];
		if (!room) return null;

		const tur = String(room.tur || '');
		if (tur === 'genel') {
			cache.set(odaId, GENERAL_AUDIENCE);
			return GENERAL_AUDIENCE;
		}

		const teamId = room.teamId ? String(room.teamId) : null;
		const membersRes =
			tur === 'takim' && teamId
				? await p.query(
						`SELECT DISTINCT userId AS "userId" FROM (
							SELECT userId FROM team_members WHERE teamId = $1 AND status = 'aktif'
							UNION
							SELECT userId FROM chat_members WHERE odaId = $2
						 ) t`,
						[teamId, odaId]
					)
				: await p.query(
						`SELECT userId AS "userId" FROM chat_members WHERE odaId = $1`,
						[odaId]
					);

		const audience: ChatAudience = {
			all: false,
			takim: tur === 'takim',
			memberIds: new Set(
				membersRes.rows.map((r) => String(r.userId ?? '')).filter(Boolean)
			),
			teamId,
			expiresAt: Date.now() + TTL_MS,
		};

		if (cache.size >= MAX_CACHE_ENTRIES) cache.clear();
		cache.set(odaId, audience);
		return audience;
	} catch (err) {
		// Fail closed: a live event must not leak into a room we could not verify.
		console.warn('[Chat audience] Lookup failed:', err);
		return null;
	}
}

/** Whether this member may receive a room event. */
export function audienceIncludes(
	audience: ChatAudience,
	userId: string,
	isAdmin: boolean
): boolean {
	if (audience.all) return true;
	if (audience.takim && isAdmin) return true;
	return audience.memberIds.has(userId);
}
