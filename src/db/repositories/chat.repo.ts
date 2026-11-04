import { randomUUID } from 'crypto';
import { getPgPool, ensurePostgresInit, withTransaction } from '@/db';
import { notificationEvents, publishEventQuiet } from '@/db/events';
import { getChatAudience, invalidateChatAudience } from '@/server/chat/chatAudience';
import type { ChatPollItem, ChatPollOptionItem } from '@/apps/chat/types';

export interface ChatOda {
	id: string;
	tur: 'genel' | 'takim' | 'ozel';
	teamId: string | null;
	ad: string;
	olusturma: number;
	avatar?: string | null;
	peerUserId?: string | null;
	memberCount?: number;
	sonMesaj?: ChatMessageRecord | null;
	okunmamisSayisi?: number;
}

export interface QuotedMessageSnapshot {
	id: string;
	gonderenAd: string;
	icerik: string;
}

export interface ChatMessageRecord {
	id: string;
	roomId: string;
	gonderenId: string;
	gonderenAd: string;
	gonderenFoto: string | null;
	icerik: string;
	ekler: Array<{ ad: string; url: string; boyut?: number; tip?: string; pollId?: string }>;
	date: number;
	silinmeTarihi?: number | null;
	duzenlenmeTarihi?: number | null;
	anket?: ChatPollItem | null;
	yanitlananMesajId?: string | null;
	yanitlananMesaj?: QuotedMessageSnapshot | null;
	iletildiMi?: boolean;
}

export interface UnreadChatRoomSummary {
	id: string;
	konu: string;
	at: number;
	okunmamis: number;
	messageId: string;
	gonderen: { ad: string; soyad: string };
}

/**
 * Emits a `notification` event on the global `orbit_events` SSE bus for all members
 * of `roomId` (except `excludeUserId`), so their TopBar Notification Center,
 * Dock badge, and background PWA/OS notifications update even when the Chat window is closed.
 */
async function notifyChatRoomParticipants(roomId: string, excludeUserId?: string): Promise<void> {
	const p = getPgPool();
	try {
		// The audience is cached for a few seconds, so this no longer adds a
		// room + membership query to every single message.
		const audience = await getChatAudience(roomId);
		if (!audience) return;

		if (audience.all) {
			// Broadcast to all connected members
			await publishEventQuiet(p, { k: 'notification' });
			return;
		}

		const targetIds = [...audience.memberIds].filter((id) => id !== excludeUserId);
		if (targetIds.length > 0) {
			await publishEventQuiet(p, notificationEvents(targetIds));
		}
	} catch (err) {
		console.warn('[Chat bildirim notify warning]:', err);
	}
}

export async function canUserAccessChatRoom(
	roomId: string,
	userId: string,
	isAdmin = false
): Promise<boolean> {
	if (!roomId || !userId) return false;
	await ensurePostgresInit();
	const p = getPgPool();
	const res = await p.query(
		`SELECT 1
		 FROM chat_rooms o
		 WHERE o.id = $1
		   AND o.room_type <> 'mail_thread'
		   AND (
		     o.room_type = 'genel'
		     OR ($3 = true AND o.room_type = 'takim')
		     OR (o.room_type = 'takim' AND (
		       EXISTS (SELECT 1 FROM team_members tu WHERE tu.team_id = o.team_id AND tu.user_id = $2 AND tu.status = 'aktif')
		       OR EXISTS (SELECT 1 FROM chat_members su WHERE su.room_id = o.id AND su.user_id = $2)
		     ))
		     OR (o.room_type = 'ozel' AND EXISTS (SELECT 1 FROM chat_members su WHERE su.room_id = o.id AND su.user_id = $2))
		   )
		 LIMIT 1`,
		[roomId, userId, isAdmin]
	);
	return res.rows.length > 0;
}

export async function getChatRooms(userId: string, isAdmin = false): Promise<ChatOda[]> {
	await ensurePostgresInit();
	const p = getPgPool();

	// Return public/general rooms + team rooms the user belongs to (or all if admin), excluding internal mail_thread rooms
	const res = await p.query(
		`SELECT o.id, o.room_type AS tur, o.team_id AS "teamId", o.name AS ad, o.created_at AS olusturma,
		        (SELECT COUNT(*)::int FROM chat_members su_count WHERE su_count.room_id = o.id) as "memberCount",
		        (SELECT json_build_object(
		            'id', k.id,
		            'ad', (k.first_name || ' ' || k.last_name),
		            'profilFoto', k.avatar_url
		         )
		         FROM chat_members su2
		         JOIN users k ON k.id = su2.user_id
		         WHERE su2.room_id = o.id AND su2.user_id <> $1
		         LIMIT 1
		        ) as "karsiKullanici",
		        (SELECT json_build_object(
		            'id', m.id, 'roomId', m.room_id, 'gonderenId', m.sender_id,
		            'gonderenAd', m.sender_name, 'gonderenFoto', m.sender_avatar,
		            'icerik', m.content, 'ekler', m.attachments, 'date', m.date,
		            'silinmeTarihi', m.deleted_at, 'duzenlenmeTarihi', m.edited_at,
		            'yanitlananMesajId', m.reply_to_id, 'yanitlananMesaj', m.reply_snapshot,
		            'iletildiMi', m.is_delivered
		         ) FROM chat_messages m WHERE m.room_id = o.id AND ($2 = true OR m.deleted_at IS NULL) ORDER BY m.date DESC LIMIT 1) as "sonMesaj",
		        (SELECT COUNT(*)::int FROM chat_messages m2
		         WHERE m2.room_id = o.id
		           AND m2.sender_id <> $1
		           AND m2.deleted_at IS NULL
		           AND m2.date > COALESCE(
		             (SELECT u.last_read_at FROM chat_members u WHERE u.room_id = o.id AND u.user_id = $1), 0
		         )) as "okunmamisSayisi"
		 FROM chat_rooms o
		 WHERE o.room_type <> 'mail_thread'
		   AND (
		     o.room_type = 'genel'
		     OR ($2 = true AND o.room_type = 'takim')
		     OR (o.room_type = 'takim' AND EXISTS (SELECT 1 FROM team_members tu WHERE tu.team_id = o.team_id AND tu.user_id = $1 AND tu.status = 'aktif'))
		     OR (o.room_type = 'ozel' AND EXISTS (SELECT 1 FROM chat_members su WHERE su.room_id = o.id AND su.user_id = $1))
		   )
		 ORDER BY o.room_type = 'genel' DESC, COALESCE((SELECT m3.date FROM chat_messages m3 WHERE m3.room_id = o.id AND ($2 = true OR m3.deleted_at IS NULL) ORDER BY m3.date DESC LIMIT 1), o.created_at) DESC`,
		[userId, isAdmin]
	);

	return res.rows.map((row) => {
		const memberCount = Number(row.memberCount || 0);
		let ad = String(row.ad || 'Sohbet');
		let avatar: string | null = null;
		let peerUserId: string | null = null;

		if (row.tur === 'ozel' && memberCount === 2 && row.karsiKullanici) {
			const k = typeof row.karsiKullanici === 'string' ? JSON.parse(row.karsiKullanici) : row.karsiKullanici;
			if (k && k.ad) {
				ad = String(k.ad);
				avatar = k.profilFoto || null;
				peerUserId = k.id || null;
			}
		}

		const rawSon = row.sonMesaj
			? typeof row.sonMesaj === 'string'
				? JSON.parse(row.sonMesaj)
				: row.sonMesaj
			: null;

		return {
			id: String(row.id),
			tur: row.tur,
			teamId: row.teamId ? String(row.teamId) : null,
			ad,
			avatar,
			peerUserId,
			memberCount,
			olusturma: Number(row.olusturma),
			sonMesaj: rawSon
				? {
						id: String(rawSon.id ?? ''),
						roomId: String(rawSon.roomId ?? rawSon.odaid ?? row.id),
						gonderenId: String(rawSon.gonderenId ?? rawSon.gonderenid ?? ''),
						gonderenAd: String(rawSon.gonderenAd ?? rawSon.gonderenad ?? 'Üye'),
						gonderenFoto: rawSon.gonderenFoto ?? rawSon.gonderenfoto ?? null,
						icerik: String(rawSon.icerik ?? ''),
						ekler: Array.isArray(rawSon.ekler)
							? rawSon.ekler
							: typeof rawSon.ekler === 'string'
							? JSON.parse(rawSon.ekler)
							: [],
						date: Number(rawSon.date ?? 0),
						silinmeTarihi: rawSon.silinmeTarihi ? Number(rawSon.silinmeTarihi) : null,
						duzenlenmeTarihi: rawSon.duzenlenmeTarihi ? Number(rawSon.duzenlenmeTarihi) : null,
						yanitlananMesajId: rawSon.yanitlananMesajId ? String(rawSon.yanitlananMesajId) : null,
						yanitlananMesaj: rawSon.yanitlananMesaj
							? typeof rawSon.yanitlananMesaj === 'string'
								? JSON.parse(rawSon.yanitlananMesaj)
								: rawSon.yanitlananMesaj
							: null,
						iletildiMi: Boolean(rawSon.iletildiMi && Number(rawSon.iletildiMi) > 0),
				  }
				: null,
			okunmamisSayisi: Number(row.okunmamisSayisi || 0),
		};
	});
}

interface RawPollOption {
	id: string;
	text: string;
	sortOrder?: number;
}

interface RawPollVote {
	optionId: string;
	userId: string;
	userName?: string;
	userAvatar?: string | null;
	votedAt?: number;
}

export async function getPollDetails(pollId: string, currentUserId?: string): Promise<ChatPollItem | null> {
	await ensurePostgresInit();
	const p = getPgPool();

	const pollRes = await p.query(
		`SELECT id, room_id AS "roomId", created_by AS "olusturanId", question AS soru,
		        allow_multiple AS "cokluSecim", options, votes, ends_at AS "endsAt", created_at AS olusturma
		 FROM chat_polls
		 WHERE id = $1`,
		[pollId]
	);

	if (pollRes.rows.length === 0) return null;
	const row = pollRes.rows[0];
	const roomId = String(row.roomId ?? '');
	const creatorId = String(row.olusturanId ?? '');

	let creatorName = 'Yönetici';
	try {
		const uRes = await p.query(
			`SELECT first_name AS ad, last_name AS soyad FROM users WHERE id = $1`,
			[creatorId]
		);
		if (uRes.rows.length > 0) {
			creatorName = `${uRes.rows[0].ad} ${uRes.rows[0].soyad}`.trim();
		}
	} catch {}

	let mesajId = '';
	let isAnon = true;
	try {
		const msgRes = await p.query(
			`SELECT id, attachments FROM chat_messages WHERE room_id = $1 AND attachments LIKE $2 LIMIT 1`,
			[roomId, `%${pollId}%`]
		);
		if (msgRes.rows.length > 0) {
			mesajId = String(msgRes.rows[0].id ?? '');
			const rawAtt = msgRes.rows[0].attachments;
			const parsedAtt = Array.isArray(rawAtt)
				? rawAtt
				: typeof rawAtt === 'string'
				? JSON.parse(rawAtt)
				: [];
			const pollAtt = Array.isArray(parsedAtt)
				? parsedAtt.find((a: Record<string, unknown>) => a && (a.pollId === pollId || a.tip === 'anket'))
				: null;
			if (pollAtt && typeof pollAtt.anonim === 'boolean') {
				isAnon = pollAtt.anonim;
			}
		}
	} catch {}

	const rawOptions: RawPollOption[] = Array.isArray(row.options)
		? row.options
		: typeof row.options === 'string'
		? JSON.parse(row.options)
		: [];
	const sortedOptions = [...rawOptions].sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0));

	const rawVotes: RawPollVote[] = Array.isArray(row.votes)
		? row.votes
		: typeof row.votes === 'string'
		? JSON.parse(row.votes)
		: [];

	const totalVotes = rawVotes.length;
	const userVotes: string[] = [];

	const options: ChatPollOptionItem[] = sortedOptions.map((opt, idx) => {
		const optId = String(opt.id);
		const optVotes = rawVotes.filter((v) => String(v.optionId) === optId);
		const count = optVotes.length;
		const yuzde = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

		const hasUserVoted = currentUserId
			? optVotes.some((v) => String(v.userId) === currentUserId)
			: false;
		if (hasUserVoted) {
			userVotes.push(optId);
		}

		return {
			id: optId,
			pollId,
			sira: Number(opt.sortOrder ?? idx),
			metin: String(opt.text ?? ''),
			oySayisi: count,
			yuzde,
			oyVerenler: !isAnon
				? optVotes.map((v) => ({
						id: String(v.userId),
						ad: String(v.userName ?? 'Üye'),
						foto: (v.userAvatar ?? null) as string | null,
				  }))
				: undefined,
		};
	});

	const endsAt = row.endsAt !== null && row.endsAt !== undefined ? Number(row.endsAt) : null;
	const isExpired = endsAt !== null ? Date.now() >= endsAt : false;

	return {
		id: String(row.id),
		mesajId,
		roomId,
		olusturanId: creatorId,
		olusturanAd: creatorName,
		soru: String(row.soru ?? ''),
		cokluSecim: Boolean(row.cokluSecim),
		anonim: isAnon,
		endsAt,
		kapali: isExpired,
		olusturma: Number(row.olusturma ?? 0),
		secenekler: options,
		toplamOy: totalVotes,
		kullaniciOylari: userVotes,
	};
}

async function enrichMessagesWithPolls(messages: ChatMessageRecord[], currentUserId?: string): Promise<ChatMessageRecord[]> {
	if (messages.length === 0) return messages;

	const pollMessageMap = new Map<string, string>(); // mesajId -> pollId
	for (const m of messages) {
		if (Array.isArray(m.ekler)) {
			const addPoll = m.ekler.find((e) => e && (e.tip === 'anket' || (e as { pollId?: string }).pollId));
			if (addPoll) {
				const aId = (addPoll as { pollId?: string }).pollId || (addPoll as { id?: string }).id;
				if (aId) pollMessageMap.set(m.id, aId);
			}
		}
	}

	if (pollMessageMap.size === 0) return messages;

	const pollDetailsMap = new Map<string, ChatPollItem>();
	await Promise.all(
		Array.from(pollMessageMap.entries()).map(async ([mesajId, pollId]) => {
			const poll = await getPollDetails(pollId, currentUserId);
			if (poll) {
				pollDetailsMap.set(mesajId, { ...poll, mesajId: poll.mesajId || mesajId });
			}
		})
	);

	return messages.map((m) => {
		const poll = pollDetailsMap.get(m.id);
		return poll ? { ...m, anket: poll } : m;
	});
}

export interface ChatMessageCursor {
	date: number;
	id: string;
}

export async function getChatRoomMessages(
	roomId: string,
	limit = 60,
	isAdmin = false,
	currentUserId?: string,
	before?: ChatMessageCursor | null
): Promise<ChatMessageRecord[]> {
	await ensurePostgresInit();
	const p = getPgPool();
	const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Math.trunc(limit), 200)) : 60;

	// The window is the *latest* `safeLimit` messages, then re-sorted oldest →
	// newest for rendering. Ordering the outer query ascending with the limit
	// inside it (the previous shape) returned the oldest page of the room.
	// `before` walks backwards: only rows strictly older than the cursor.
	const res = await p.query(
		`SELECT *
		 FROM (
		   SELECT id,
		          room_id AS "roomId",
		          sender_id AS "gonderenId",
		          sender_name AS "gonderenAd",
		          sender_avatar AS "gonderenFoto",
		          content AS icerik,
		          attachments AS ekler,
		          date,
		          deleted_at AS "silinmeTarihi",
		          edited_at AS "duzenlenmeTarihi",
		          reply_to_id AS "yanitlananMesajId",
		          reply_snapshot AS "yanitlananMesaj",
		          COALESCE(is_delivered, 0) AS "iletildiMi"
		   FROM chat_messages
		   WHERE room_id = $1
		     AND ($3 = true OR deleted_at IS NULL)
		     AND ($4::bigint IS NULL OR date < $4 OR (date = $4 AND id < $5))
		   ORDER BY date DESC, id DESC
		   LIMIT $2
		 ) AS latest
		 ORDER BY date ASC, id ASC`,
		[roomId, safeLimit, isAdmin, before?.date ?? null, before?.id ?? null]
	);

	const rawMessages: ChatMessageRecord[] = res.rows.map((row) => {
		const r = row as Record<string, unknown>;
		let yanitlananMesaj: QuotedMessageSnapshot | null = null;
		if (r.yanitlananMesaj) {
			if (typeof r.yanitlananMesaj === 'string') {
				try {
					yanitlananMesaj = JSON.parse(r.yanitlananMesaj);
				} catch {}
			} else if (typeof r.yanitlananMesaj === 'object') {
				yanitlananMesaj = r.yanitlananMesaj as QuotedMessageSnapshot;
			}
		}

		return {
			id: String(r.id ?? ''),
			roomId: String(r.roomId ?? r.odaid ?? roomId),
			gonderenId: String(r.gonderenId ?? r.gonderenid ?? ''),
			gonderenAd: String(r.gonderenAd ?? r.gonderenad ?? 'Üye'),
			gonderenFoto: (r.gonderenFoto ?? r.gonderenfoto ?? null) as string | null,
			icerik: String(r.icerik ?? ''),
			ekler: Array.isArray(r.ekler)
				? r.ekler
				: typeof r.ekler === 'string'
				? JSON.parse(r.ekler)
				: [],
			date: Number(r.date ?? 0),
			silinmeTarihi: r.silinmeTarihi ? Number(r.silinmeTarihi) : null,
			duzenlenmeTarihi: r.duzenlenmeTarihi ? Number(r.duzenlenmeTarihi) : null,
			yanitlananMesajId: r.yanitlananMesajId ? String(r.yanitlananMesajId) : null,
			yanitlananMesaj,
			iletildiMi: Boolean(r.iletildiMi && Number(r.iletildiMi) > 0),
		};
	});

	return await enrichMessagesWithPolls(rawMessages, currentUserId);
}

export async function getChatMessageById(mesajId: string): Promise<ChatMessageRecord | null> {
	await ensurePostgresInit();
	const p = getPgPool();
	const res = await p.query(
		`SELECT id,
		        room_id AS "roomId",
		        sender_id AS "gonderenId",
		        sender_name AS "gonderenAd",
		        sender_avatar AS "gonderenFoto",
		        content AS icerik,
		        attachments AS ekler,
		        date,
		        deleted_at AS "silinmeTarihi",
		        edited_at AS "duzenlenmeTarihi",
		        reply_to_id AS "yanitlananMesajId",
		        reply_snapshot AS "yanitlananMesaj",
		        COALESCE(is_delivered, 0) AS "iletildiMi"
		 FROM chat_messages
		 WHERE id = $1
		 LIMIT 1`,
		[mesajId]
	);

	if (res.rows.length === 0) return null;
	const r = res.rows[0] as Record<string, unknown>;

	let yanitlananMesaj: QuotedMessageSnapshot | null = null;
	if (r.yanitlananMesaj) {
		if (typeof r.yanitlananMesaj === 'string') {
			try {
				yanitlananMesaj = JSON.parse(r.yanitlananMesaj);
			} catch {}
		} else if (typeof r.yanitlananMesaj === 'object') {
			yanitlananMesaj = r.yanitlananMesaj as QuotedMessageSnapshot;
		}
	}

	return {
		id: String(r.id ?? ''),
		roomId: String(r.roomId ?? r.odaid ?? ''),
		gonderenId: String(r.gonderenId ?? r.gonderenid ?? ''),
		gonderenAd: String(r.gonderenAd ?? r.gonderenad ?? 'Üye'),
		gonderenFoto: (r.gonderenFoto ?? r.gonderenfoto ?? null) as string | null,
		icerik: String(r.icerik ?? ''),
		ekler: Array.isArray(r.ekler)
			? r.ekler
			: typeof r.ekler === 'string'
			? JSON.parse(r.ekler)
			: [],
		date: Number(r.date ?? 0),
		silinmeTarihi: r.silinmeTarihi ? Number(r.silinmeTarihi) : null,
		duzenlenmeTarihi: r.duzenlenmeTarihi ? Number(r.duzenlenmeTarihi) : null,
		yanitlananMesajId: r.yanitlananMesajId ? String(r.yanitlananMesajId) : null,
		yanitlananMesaj,
		iletildiMi: Boolean(r.iletildiMi && Number(r.iletildiMi) > 0),
	};
}

export async function createChatMessage(
	roomId: string,
	gonderen: { id: string; ad: string; soyad: string; profilFoto?: string | null },
	icerik: string,
	ekler: Array<{ ad: string; url: string; boyut?: number; tip?: string }> = [],
	options?: {
		yanitlananMesajId?: string | null;
		yanitlananMesaj?: QuotedMessageSnapshot | null;
		iletildiMi?: boolean;
	}
): Promise<ChatMessageRecord> {
	await ensurePostgresInit();
	const p = getPgPool();
	const id = randomUUID();
	const date = Date.now();
	const senderName = `${gonderen.ad} ${gonderen.soyad}`.trim() || 'Üye';
	const gonderenFoto = gonderen.profilFoto || null;
	const eklerJson = JSON.stringify(ekler);

	const yanitlananMesajId = options?.yanitlananMesajId || null;
	let yanitlananMesaj = options?.yanitlananMesaj || null;
	const iletildiMi = Boolean(options?.iletildiMi);

	// If yanitlananMesajId is provided but snapshot isn't, fetch snapshot
	if (yanitlananMesajId && !yanitlananMesaj) {
		const targetMsg = await getChatMessageById(yanitlananMesajId);
		if (targetMsg) {
			yanitlananMesaj = {
				id: targetMsg.id,
				gonderenAd: targetMsg.gonderenAd,
				icerik: targetMsg.icerik.slice(0, 200),
			};
		}
	}

	const yanitlananMesajJson = yanitlananMesaj ? JSON.stringify(yanitlananMesaj) : null;

	await p.query(
		`INSERT INTO chat_messages (id, room_id, sender_id, sender_name, sender_avatar, content, attachments, date, reply_to_id, reply_snapshot, is_delivered)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		[
			id,
			roomId,
			gonderen.id,
			senderName,
			gonderenFoto,
			icerik.trim(),
			eklerJson,
			date,
			yanitlananMesajId,
			yanitlananMesajJson,
			iletildiMi ? 1 : 0,
		]
	);

	// Mark sender's read pointer
	await p.query(
		`INSERT INTO chat_members (room_id, user_id, last_read_at)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (room_id, user_id) DO UPDATE SET last_read_at = $3`,
		[roomId, gonderen.id, date]
	);

	const createdMsg: ChatMessageRecord = {
		id,
		roomId,
		gonderenId: gonderen.id,
		gonderenAd: senderName,
		gonderenFoto,
		icerik: icerik.trim(),
		ekler,
		date,
		yanitlananMesajId,
		yanitlananMesaj,
		iletildiMi,
	};

	// 1. Notify real-time Chat SSE stream
	try {
		await p.query(
			`SELECT pg_notify('club_chat_events', $1)`,
			[JSON.stringify({ type: 'new_message', roomId, message: createdMsg })]
		);
	} catch (err) {
		console.warn('[Chat notify warning]:', err);
	}

	// 2. Notify global Notification Center & Dock Badge SSE stream (`orbit_events`)
	void notifyChatRoomParticipants(roomId, gonderen.id);

	return createdMsg;
}

export async function softDeleteChatMessage(
	mesajId: string,
	userId: string,
	isAdmin = false
): Promise<{ ok: boolean; roomId?: string; messageId?: string; silinmeTarihi?: number }> {
	await ensurePostgresInit();
	const p = getPgPool();

	const checkRes = await p.query(
		`SELECT id, room_id AS "roomId", sender_id AS "gonderenId" FROM chat_messages WHERE id = $1 LIMIT 1`,
		[mesajId]
	);
	const msg = checkRes.rows[0];
	if (!msg) return { ok: false };

	// Authorization check: must be admin OR original sender
	if (!isAdmin && msg.gonderenId !== userId) {
		return { ok: false };
	}

	const now = Date.now();
	await p.query(
		`UPDATE chat_messages SET deleted_at = $1 WHERE id = $2`,
		[now, mesajId]
	);

	try {
		await p.query(
			`SELECT pg_notify('club_chat_events', $1)`,
			[
				JSON.stringify({
					type: 'message_deleted',
					roomId: msg.roomId,
					messageId: mesajId,
					silinmeTarihi: now,
				}),
			]
		);
	} catch (e) {
		console.warn('[Chat notify delete error]:', e);
	}

	return { ok: true, roomId: msg.roomId, messageId: mesajId, silinmeTarihi: now };
}

export async function softDeleteChatMessagesBatch(
	roomId: string,
	count = 50,
	isAdmin = false
): Promise<{ ok: boolean; count: number; deletedIds: string[]; silinmeTarihi: number }> {
	await ensurePostgresInit();
	const p = getPgPool();

	if (!isAdmin) {
		return { ok: false, count: 0, deletedIds: [], silinmeTarihi: 0 };
	}

	const limit = Math.max(1, Math.min(count, 200));
	const now = Date.now();

	// Select last N non-deleted messages in room
	const selectRes = await p.query(
		`SELECT id FROM chat_messages
		 WHERE room_id = $1 AND deleted_at IS NULL
		 ORDER BY date DESC
		 LIMIT $2`,
		[roomId, limit]
	);

	const deletedIds = selectRes.rows.map((r) => String(r.id));
	if (deletedIds.length === 0) {
		return { ok: true, count: 0, deletedIds: [], silinmeTarihi: now };
	}

	await p.query(
		`UPDATE chat_messages
		 SET deleted_at = $1
		 WHERE id = ANY($2)`,
		[now, deletedIds]
	);

	// Real-time broadcast
	try {
		await p.query(
			`SELECT pg_notify('club_chat_events', $1)`,
			[
				JSON.stringify({
					type: 'messages_cleared',
					roomId,
					deletedIds,
					silinmeTarihi: now,
					count: deletedIds.length,
				}),
			]
		);
	} catch (e) {
		console.warn('[Chat notify clear error]:', e);
	}

	return { ok: true, count: deletedIds.length, deletedIds, silinmeTarihi: now };
}

export async function editChatMessage(
	mesajId: string,
	yeniIcerik: string,
	userId: string
): Promise<{ ok: boolean; message?: ChatMessageRecord }> {
	await ensurePostgresInit();
	const p = getPgPool();

	const checkRes = await p.query(
		`SELECT id, room_id AS "roomId", sender_id AS "gonderenId", sender_name AS "gonderenAd", sender_avatar AS "gonderenFoto", attachments AS ekler, date, deleted_at AS "silinmeTarihi"
		 FROM chat_messages WHERE id = $1 LIMIT 1`,
		[mesajId]
	);
	const existing = checkRes.rows[0];
	if (!existing) return { ok: false };

	// Only original sender can edit, and cannot edit if already soft-deleted
	if (existing.gonderenId !== userId || existing.silinmeTarihi) {
		return { ok: false };
	}

	const trimmed = yeniIcerik.trim();
	if (!trimmed) return { ok: false };

	const now = Date.now();
	await p.query(
		`UPDATE chat_messages SET content = $1, edited_at = $2 WHERE id = $3`,
		[trimmed, now, mesajId]
	);

	const updatedMsg: ChatMessageRecord = {
		id: String(existing.id),
		roomId: String(existing.roomId),
		gonderenId: String(existing.gonderenId),
		gonderenAd: String(existing.gonderenAd),
		gonderenFoto: existing.gonderenFoto || null,
		icerik: trimmed,
		ekler: Array.isArray(existing.ekler)
			? existing.ekler
			: typeof existing.ekler === 'string'
			? JSON.parse(existing.ekler)
			: [],
		date: Number(existing.date),
		silinmeTarihi: null,
		duzenlenmeTarihi: now,
	};

	try {
		await p.query(
			`SELECT pg_notify('club_chat_events', $1)`,
			[
				JSON.stringify({
					type: 'message_edited',
					roomId: updatedMsg.roomId,
					message: updatedMsg,
				}),
			]
		);
	} catch (e) {
		console.warn('[Chat notify edit error]:', e);
	}

	return { ok: true, message: updatedMsg };
}

export async function markRoomAsRead(roomId: string, userId: string): Promise<void> {
	await ensurePostgresInit();
	const p = getPgPool();
	const now = Date.now();
	await p.query(
		`INSERT INTO chat_members (room_id, user_id, last_read_at)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (room_id, user_id) DO UPDATE SET last_read_at = $3`,
		[roomId, userId, now]
	);
	// Refresh the reader's Notification Center & Dock badge
	void publishEventQuiet(p, { k: 'notification', userId });
}

export async function ensureTeamChatRoom(teamId: string, takimAd: string): Promise<string> {
	await ensurePostgresInit();
	const p = getPgPool();
	const roomId = `oda_takim_${teamId}`;
	await p.query(
		`INSERT INTO chat_rooms (id, room_type, team_id, name, created_at)
		 VALUES ($1, 'takim', $2, $3, $4)
		 ON CONFLICT (id) DO UPDATE SET name = $3`,
		[roomId, teamId, `${takimAd} Takım Sohbeti`, Date.now()]
	);
	return roomId;
}

export interface ChatContactItem {
	id: string;
	ad: string;
	soyad: string;
	profilFoto: string | null;
	rolAd: string | null;
	bolum: string;
}

export interface ChatRoomMemberItem {
	id: string;
	firstName?: string;
	lastName?: string;
	avatarUrl?: string | null;
	roleName?: string | null;
	department?: string;
	ad: string;
	soyad: string;
	profilFoto: string | null;
	rolAd: string | null;
	bolum: string;
}

/**
 * Returns existing 1-on-1 DM room between two users if one exists,
 * or creates a new one.
 */
export async function getOrCreateDmRoom(
	kullanici1Id: string,
	kullanici2Id: string
): Promise<{ roomId: string; isNew: boolean }> {
	await ensurePostgresInit();
	// Serialize the check-then-create sequence for the same pair. Without this,
	// two quick clicks can both observe "no room" and create duplicate DMs.
	const lockKey = [kullanici1Id, kullanici2Id].sort().join(':');
	return withTransaction(async (client) => {
		await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [lockKey]);
		const existing = await client.query(
			`SELECT o.id FROM chat_rooms o
			 WHERE o.room_type = 'ozel'
			   AND (SELECT COUNT(*) FROM chat_members WHERE room_id = o.id) = 2
			   AND EXISTS (SELECT 1 FROM chat_members WHERE room_id = o.id AND user_id = $1)
			   AND EXISTS (SELECT 1 FROM chat_members WHERE room_id = o.id AND user_id = $2)
			 LIMIT 1`,
			[kullanici1Id, kullanici2Id]
		);
		if (existing.rows.length > 0) {
			return { roomId: String(existing.rows[0].id), isNew: false };
		}

		const roomId = `dm_${randomUUID()}`;
		const now = Date.now();
		const usersRes = await client.query(
			`SELECT id, first_name AS ad, last_name AS soyad FROM users WHERE id IN ($1, $2)`,
			[kullanici1Id, kullanici2Id]
		);
		const names = usersRes.rows.map((u) => `${u.ad} ${u.soyad}`.trim()).join(' & ');
		const roomName = names || 'Özel Sohbet';

		await client.query(
			`INSERT INTO chat_rooms (id, room_type, name, created_by, created_at)
			 VALUES ($1, 'ozel', $2, $3, $4)`,
			[roomId, roomName, kullanici1Id, now]
		);
		await client.query(
			`INSERT INTO chat_members (room_id, user_id, last_read_at, joined_at)
			 VALUES ($1, $2, $3, $3), ($1, $4, $3, $3)
			 ON CONFLICT (room_id, user_id) DO NOTHING`,
			[roomId, kullanici1Id, now, kullanici2Id]
		);
		return { roomId, isNew: true };
	});
}

/**
 * Creates a Group DM with multiple members and optional subject title.
 * If title is empty, auto-names with first few participant names like WhatsApp.
 */
export async function createGroupDm(
	olusturan: { id: string; ad: string; soyad: string },
	uyeIdleri: string[],
	baslik?: string
): Promise<{ roomId: string; ad: string }> {
	await ensurePostgresInit();
	const p = getPgPool();
	const now = Date.now();
	const roomId = `grp_${randomUUID()}`;

	const allMemberIds = Array.from(new Set([olusturan.id, ...uyeIdleri]));

	let groupTitle = (baslik || '').trim();
	if (!groupTitle) {
		const namesRes = await p.query(
			`SELECT first_name AS ad FROM users WHERE id = ANY($1) ORDER BY created_at ASC LIMIT 4`,
			[allMemberIds]
		);
		const names = namesRes.rows.map((r) => r.ad);
		groupTitle = names.join(', ') + (allMemberIds.length > 4 ? ` (+${allMemberIds.length - 4})` : '');
		if (!groupTitle) groupTitle = 'Yeni Grup';
	}

	await p.query(
		`INSERT INTO chat_rooms (id, room_type, name, created_by, created_at)
		 VALUES ($1, 'ozel', $2, $3, $4)`,
		[roomId, groupTitle, olusturan.id, now]
	);

	for (const uid of allMemberIds) {
		// Creator has read up to `now`; invited members get `now - 1` so the creation message is unread for them
		const initialRead = uid === olusturan.id ? now : now - 1;
		await p.query(
			`INSERT INTO chat_members (room_id, user_id, last_read_at, joined_at)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (room_id, user_id) DO NOTHING`,
			[roomId, uid, initialRead, now]
		);
	}

	// Insert system message about group creation
	const sysMsgId = randomUUID();
	const creatorName = `${olusturan.ad} ${olusturan.soyad}`.trim();
	const sysContent = `${creatorName} grubu oluşturdu.`;
	await p.query(
		`INSERT INTO chat_messages (id, room_id, sender_id, sender_name, sender_avatar, content, attachments, date)
		 VALUES ($1, $2, 'sistem', 'Sistem', NULL, $3, '[]', $4)`,
		[sysMsgId, roomId, sysContent, now]
	);

	try {
		await p.query(
			`SELECT pg_notify('club_chat_events', $1)`,
			[
				JSON.stringify({
					type: 'new_message',
					roomId,
					message: {
						id: sysMsgId,
						roomId,
						gonderenId: 'sistem',
						gonderenAd: 'Sistem',
						gonderenFoto: null,
						icerik: sysContent,
						ekler: [],
						date: now,
					},
				}),
			]
		);
	} catch (e) {
		console.warn('[Chat notify warning]:', e);
	}

	void notifyChatRoomParticipants(roomId, olusturan.id);

	return { roomId, ad: groupTitle };
}

/**
 * Adds new members to an existing room and publishes a system notification.
 */
export async function addMembersToRoom(
	roomId: string,
	actor: { id: string; ad: string; soyad: string },
	yeniUyeIdleri: string[]
): Promise<{ addedCount: number }> {
	await ensurePostgresInit();
	const p = getPgPool();
	const now = Date.now();

	if (yeniUyeIdleri.length === 0) return { addedCount: 0 };

	const toAddRes = await p.query(
		`SELECT id, first_name AS ad, last_name AS soyad FROM users
		 WHERE id = ANY($1)
		   AND id NOT IN (SELECT user_id FROM chat_members WHERE room_id = $2)`,
		[yeniUyeIdleri, roomId]
	);

	if (toAddRes.rows.length === 0) return { addedCount: 0 };

	for (const row of toAddRes.rows) {
		await p.query(
			`INSERT INTO chat_members (room_id, user_id, last_read_at, joined_at)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (room_id, user_id) DO NOTHING`,
			[roomId, row.id, now - 1, now]
		);
	}
	invalidateChatAudience(roomId);

	const addedNames = toAddRes.rows.map((r) => `${r.ad} ${r.soyad}`.trim()).join(', ');
	const actorName = `${actor.ad} ${actor.soyad}`.trim();
	const sysContent = `${actorName}, ${addedNames} üyesini gruba ekledi.`;
	const sysMsgId = randomUUID();

	await p.query(
		`INSERT INTO chat_messages (id, room_id, sender_id, sender_name, sender_avatar, content, attachments, date)
		 VALUES ($1, $2, 'sistem', 'Sistem', NULL, $3, '[]', $4)`,
		[sysMsgId, roomId, sysContent, now]
	);

	try {
		await p.query(
			`SELECT pg_notify('club_chat_events', $1)`,
			[
				JSON.stringify({
					type: 'new_message',
					roomId,
					message: {
						id: sysMsgId,
						roomId,
						gonderenId: 'sistem',
						gonderenAd: 'Sistem',
						gonderenFoto: null,
						icerik: sysContent,
						ekler: [],
						date: now,
					},
				}),
			]
		);
	} catch (e) {
		console.warn('[Chat notify warning]:', e);
	}

	void notifyChatRoomParticipants(roomId, actor.id);

	return { addedCount: toAddRes.rows.length };
}

/**
 * Retrieves members of a specific chat room.
 */
export async function getRoomMembers(roomId: string): Promise<ChatRoomMemberItem[]> {
	await ensurePostgresInit();
	const p = getPgPool();
	const res = await p.query(
		`SELECT k.id, k.first_name AS ad, k.last_name AS soyad, k.avatar_url as "profilFoto", k.department as bolum, r.name as "rolAd"
		 FROM chat_members su
		 JOIN users k ON k.id = su.user_id
		 LEFT JOIN roles r ON r.id = k.role_id
		 WHERE su.room_id = $1
		 ORDER BY k.first_name ASC, k.last_name ASC`,
		[roomId]
	);

	return res.rows.map((r) => {
		const firstName = String(r.ad ?? '');
		const lastName = String(r.soyad ?? '');
		const avatarUrl = r.profilFoto ? String(r.profilFoto) : null;
		const roleName = r.rolAd ? String(r.rolAd) : null;
		const department = r.bolum ? String(r.bolum) : '';
		return {
			id: String(r.id),
			firstName,
			lastName,
			avatarUrl,
			roleName,
			department,
			ad: firstName,
			soyad: lastName,
			profilFoto: avatarUrl,
			rolAd: roleName,
			bolum: department,
		};
	});
}

/**
 * Returns all active club members for the "New Chat" member picker.
 */
export async function getChatContacts(excludeUserId: string): Promise<ChatContactItem[]> {
	await ensurePostgresInit();
	const p = getPgPool();
	const res = await p.query(
		`SELECT k.id, k.first_name AS ad, k.last_name AS soyad, k.avatar_url as "profilFoto", k.department as bolum, r.name as "rolAd"
		 FROM users k
		 LEFT JOIN roles r ON r.id = k.role_id
		 WHERE k.status = 'aktif' AND k.id <> $1
		 ORDER BY k.first_name ASC, k.last_name ASC`,
		[excludeUserId]
	);

	return res.rows.map((r) => ({
		id: String(r.id),
		ad: String(r.ad),
		soyad: String(r.soyad),
		profilFoto: r.profilFoto ? String(r.profilFoto) : null,
		rolAd: r.rolAd ? String(r.rolAd) : null,
		bolum: r.bolum ? String(r.bolum) : '',
	}));
}

/**
 * Returns rooms with unread messages for the Notification Center feed.
 */
export async function getUnreadChatRooms(
	userId: string,
	isAdmin = false,
	limit = 5
): Promise<UnreadChatRoomSummary[]> {
	const rooms = await getChatRooms(userId, isAdmin);
	return rooms
		.filter((r) => (r.okunmamisSayisi || 0) > 0 && r.sonMesaj)
		.sort((a, b) => (b.sonMesaj?.date || 0) - (a.sonMesaj?.date || 0))
		.slice(0, limit)
		.map((r) => {
			const son = r.sonMesaj!;
			const preview = son.icerik.length > 72 ? `${son.icerik.slice(0, 72)}…` : son.icerik;
			const isDirect = r.tur === 'ozel' && (r.memberCount || 0) === 2;
			return {
				id: r.id,
				konu: isDirect ? preview : `${r.ad}: ${preview}`,
				at: son.date,
				okunmamis: r.okunmamisSayisi || 1,
				messageId: String(son.id),
				gonderen: {
					ad: son.gonderenAd || r.ad,
					soyad: '',
				},
			};
		});
}

/**
 * Returns total unread chat messages across all rooms the user belongs to (for the Chat Dock badge).
 */
export async function getUnreadChatCount(userId: string, isAdmin = false): Promise<number> {
	const rooms = await getChatRooms(userId, isAdmin);
	return rooms.reduce((sum, r) => sum + (r.okunmamisSayisi || 0), 0);
}

export async function createPollInRoom(
	roomId: string,
	olusturan: { id: string; ad: string; soyad: string; profilFoto?: string | null },
	data: {
		soru: string;
		secenekler: string[];
		cokluSecim?: boolean;
		anonim?: boolean;
		sureSaniye?: number | null;
		endsAt?: number | null;
	}
): Promise<{ ok: boolean; message?: ChatMessageRecord; error?: string }> {
	await ensurePostgresInit();
	const p = getPgPool();

	const soru = (data.soru || '').trim();
	const cleanSecenekler = (data.secenekler || []).map((s) => s.trim()).filter(Boolean);

	if (!soru) {
		return { ok: false, error: 'Lütfen anket sorusunu yazın.' };
	}
	if (cleanSecenekler.length < 2) {
		return { ok: false, error: 'En az 2 seçenek girmelisiniz.' };
	}

	const messageId = randomUUID();
	const pollId = `anket_${randomUUID()}`;
	const now = Date.now();
	const endsAt = typeof data.endsAt === 'number'
		? data.endsAt
		: data.sureSaniye
		? now + Number(data.sureSaniye) * 1000
		: null;
	const senderName = `${olusturan.ad} ${olusturan.soyad}`.trim() || 'Yönetici';
	const gonderenFoto = olusturan.profilFoto || null;
	const isAnon = data.anonim !== false;
	const eklerJson = JSON.stringify([{ tip: 'anket', pollId, soru, anonim: isAnon }]);

	// 1. Insert chat message
	await p.query(
		`INSERT INTO chat_messages (id, room_id, sender_id, sender_name, sender_avatar, content, attachments, date)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		[messageId, roomId, olusturan.id, senderName, gonderenFoto, soru, eklerJson, now]
	);

	// 2. Build options JSONB and insert poll
	const optionsList: RawPollOption[] = cleanSecenekler.map((text, idx) => ({
		id: `opt_${randomUUID()}`,
		text,
		sortOrder: idx,
	}));

	await p.query(
		`INSERT INTO chat_polls (id, room_id, created_by, question, allow_multiple, options, votes, ends_at, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6::jsonb, '[]'::jsonb, $7, $8)`,
		[
			pollId,
			roomId,
			olusturan.id,
			soru,
			Boolean(data.cokluSecim),
			JSON.stringify(optionsList),
			endsAt,
			now,
		]
	);

	// 3. Mark sender read pointer
	await p.query(
		`INSERT INTO chat_members (room_id, user_id, last_read_at)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (room_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at`,
		[roomId, olusturan.id, now]
	);

	// 4. Fetch complete poll details
	const pollDetails = await getPollDetails(pollId, olusturan.id);

	const createdMsg: ChatMessageRecord = {
		id: messageId,
		roomId,
		gonderenId: olusturan.id,
		gonderenAd: senderName,
		gonderenFoto,
		icerik: soru,
		ekler: [{ tip: 'anket', pollId, ad: 'Anket', url: '' }],
		date: now,
		anket: pollDetails ? { ...pollDetails, mesajId: messageId } : null,
	};

	// 5. Real-time broadcast
	try {
		await p.query(
			`SELECT pg_notify('club_chat_events', $1)`,
			[JSON.stringify({ type: 'new_message', roomId, message: createdMsg })]
		);
	} catch (e) {
		console.warn('[Chat notify poll create error]:', e);
	}

	return { ok: true, message: createdMsg };
}

export async function castPollVote(
	pollId: string,
	secenekId: string,
	kullanici: { id: string; ad: string; soyad: string; profilFoto?: string | null },
	isAdmin = false
): Promise<{ ok: boolean; poll?: ChatPollItem; error?: string }> {
	await ensurePostgresInit();
	const p = getPgPool();

	// 1. Fetch poll
	const pollRes = await p.query(
		`SELECT id, room_id AS "roomId", allow_multiple AS "cokluSecim", options, votes, ends_at AS "endsAt"
		 FROM chat_polls
		 WHERE id = $1`,
		[pollId]
	);

	if (pollRes.rows.length === 0) {
		return { ok: false, error: 'Anket bulunamadı.' };
	}

	const pollRow = pollRes.rows[0];
	const pollRoomId = String(pollRow.roomId ?? '');
	const hasAccess = await canUserAccessChatRoom(pollRoomId, kullanici.id, isAdmin);
	if (!hasAccess) {
		return { ok: false, error: 'Bu odadaki ankete erişim yetkiniz yok.' };
	}

	const endsAt = pollRow.endsAt;
	if (endsAt !== null && endsAt !== undefined && Date.now() >= Number(endsAt)) {
		return { ok: false, error: 'Bu anket oylamaya kapatılmıştır.' };
	}

	const rawOptions: RawPollOption[] = Array.isArray(pollRow.options)
		? pollRow.options
		: typeof pollRow.options === 'string'
		? JSON.parse(pollRow.options)
		: [];
	if (!rawOptions.some((o) => String(o.id) === secenekId)) {
		return { ok: false, error: 'Geçersiz anket seçeneği.' };
	}

	const isMulti = Boolean(pollRow.cokluSecim);
	const userFirstName = `${kullanici.ad} ${kullanici.soyad}`.trim() || 'Üye';
	const userAvatar = kullanici.profilFoto || null;

	const rawVotes: RawPollVote[] = Array.isArray(pollRow.votes)
		? pollRow.votes
		: typeof pollRow.votes === 'string'
		? JSON.parse(pollRow.votes)
		: [];

	const alreadyVoted = rawVotes.some(
		(v) => String(v.optionId) === secenekId && String(v.userId) === kullanici.id
	);

	let nextVotes: RawPollVote[];
	if (alreadyVoted) {
		nextVotes = rawVotes.filter(
			(v) => !(String(v.optionId) === secenekId && String(v.userId) === kullanici.id)
		);
	} else {
		const baseVotes = isMulti
			? rawVotes
			: rawVotes.filter((v) => String(v.userId) !== kullanici.id);
		nextVotes = [
			...baseVotes,
			{
				optionId: secenekId,
				userId: kullanici.id,
				userName: userFirstName,
				userAvatar,
				votedAt: Date.now(),
			},
		];
	}

	await p.query(
		`UPDATE chat_polls SET votes = $2::jsonb WHERE id = $1`,
		[pollId, JSON.stringify(nextVotes)]
	);

	// 3. Get updated poll details
	const updatedPoll = await getPollDetails(pollId, kullanici.id);
	if (!updatedPoll) {
		return { ok: false, error: 'Anket bilgileri alınamadı.' };
	}

	// 4. Real-time broadcast
	try {
		await p.query(
			`SELECT pg_notify('club_chat_events', $1)`,
			[
				JSON.stringify({
					type: 'poll_updated',
					roomId: pollRoomId,
					pollId,
					poll: updatedPoll,
				}),
			]
		);
	} catch (e) {
		console.warn('[Chat notify poll vote error]:', e);
	}

	return { ok: true, poll: updatedPoll };
}

export async function closePoll(
	pollId: string,
	userId: string,
	isAdmin = false
): Promise<{ ok: boolean; poll?: ChatPollItem; error?: string }> {
	await ensurePostgresInit();
	const p = getPgPool();

	const pollRes = await p.query(
		`SELECT id, room_id AS "roomId", created_by AS "olusturanId" FROM chat_polls WHERE id = $1`,
		[pollId]
	);

	if (pollRes.rows.length === 0) {
		return { ok: false, error: 'Anket bulunamadı.' };
	}

	const pollRow = pollRes.rows[0];
	const creatorId = String(pollRow.olusturanId ?? '');

	if (!isAdmin && creatorId !== userId) {
		return { ok: false, error: 'Bu anketi kapatma yetkiniz yok.' };
	}

	await p.query(`UPDATE chat_polls SET ends_at = $2 WHERE id = $1`, [pollId, Date.now() - 1]);

	const updatedPoll = await getPollDetails(pollId, userId);
	if (!updatedPoll) {
		return { ok: false, error: 'Anket güncellenemedi.' };
	}

	// Real-time broadcast
	try {
		await p.query(
			`SELECT pg_notify('club_chat_events', $1)`,
			[
				JSON.stringify({
					type: 'poll_updated',
					roomId: pollRow.roomId,
					pollId,
					poll: updatedPoll,
				}),
			]
		);
	} catch (e) {
		console.warn('[Chat notify poll close error]:', e);
	}

	return { ok: true, poll: updatedPoll };
}

