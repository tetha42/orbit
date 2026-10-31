import { randomUUID } from 'crypto';
import { getPgPool, ensurePostgresInit, withTransaction } from '@/db';
import { notificationEvents, publishEventQuiet } from '@/db/olaylar';
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
	odaId: string;
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
 * Emits a `bildirim` event on the global `beu_olaylar` SSE bus for all members
 * of `odaId` (except `excludeUserId`), so their TopBar Notification Center,
 * Dock badge, and background PWA/OS notifications update even when the Chat window is closed.
 */
async function notifyChatRoomParticipants(odaId: string, excludeUserId?: string): Promise<void> {
	const p = getPgPool();
	try {
		// The audience is cached for a few seconds, so this no longer adds a
		// room + membership query to every single message.
		const audience = await getChatAudience(odaId);
		if (!audience) return;

		if (audience.all) {
			// Broadcast to all connected members
			await publishEventQuiet(p, { k: 'bildirim' });
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
	odaId: string,
	userId: string,
	isAdmin = false
): Promise<boolean> {
	if (!odaId || !userId) return false;
	await ensurePostgresInit();
	const p = getPgPool();
	const res = await p.query(
		`SELECT 1
		 FROM chat_rooms o
		 WHERE o.id = $1
		   AND (
		     o.tur = 'genel'
		     OR ($3 = true AND o.tur = 'takim')
		     OR (o.tur = 'takim' AND (
		       EXISTS (SELECT 1 FROM team_members tu WHERE tu.teamId = o.teamId AND tu.userId = $2 AND tu.status = 'aktif')
		       OR EXISTS (SELECT 1 FROM chat_members su WHERE su.odaId = o.id AND su.userId = $2)
		     ))
		     OR (o.tur = 'ozel' AND EXISTS (SELECT 1 FROM chat_members su WHERE su.odaId = o.id AND su.userId = $2))
		   )
		 LIMIT 1`,
		[odaId, userId, isAdmin]
	);
	return res.rows.length > 0;
}

export async function getChatRooms(userId: string, isAdmin = false): Promise<ChatOda[]> {
	await ensurePostgresInit();
	const p = getPgPool();

	// Return public/general rooms + team rooms the user belongs to (or all if admin)
	const res = await p.query(
		`SELECT o.id, o.tur, o.teamId AS "teamId", o.ad, o.olusturma,
		        (SELECT COUNT(*)::int FROM chat_members su_count WHERE su_count.odaId = o.id) as "memberCount",
		        (SELECT json_build_object(
		            'id', k.id,
		            'ad', (k.first_name || ' ' || k.last_name),
		            'profilFoto', k.avatar_url
		         )
		         FROM chat_members su2
		         JOIN users k ON k.id = su2.userId
		         WHERE su2.odaId = o.id AND su2.userId <> $1
		         LIMIT 1
		        ) as "karsiKullanici",
		        (SELECT json_build_object(
		            'id', m.id, 'odaId', m.odaId, 'gonderenId', m.gonderenId,
		            'gonderenAd', m.gonderenAd, 'gonderenFoto', m.gonderenFoto,
		            'icerik', m.icerik, 'ekler', m.ekler, 'date', m.date,
		            'silinmeTarihi', m.silinmeTarihi, 'duzenlenmeTarihi', m.duzenlenmeTarihi,
		            'yanitlananMesajId', m.yanitlananMesajId, 'yanitlananMesaj', m.yanitlananMesaj,
		            'iletildiMi', m.iletildiMi
		         ) FROM chat_messages m WHERE m.odaId = o.id AND ($2 = true OR m.silinmeTarihi IS NULL) ORDER BY m.date DESC LIMIT 1) as "sonMesaj",
		        (SELECT COUNT(*)::int FROM chat_messages m2
		         WHERE m2.odaId = o.id
		           AND m2.gonderenId <> $1
		           AND m2.silinmeTarihi IS NULL
		           AND m2.date > COALESCE(
		             (SELECT u.sonOkuma FROM chat_members u WHERE u.odaId = o.id AND u.userId = $1), 0
		         )) as "okunmamisSayisi"
		 FROM chat_rooms o
		 WHERE o.tur = 'genel'
		    OR ($2 = true AND o.tur = 'takim')
		    OR (o.tur = 'takim' AND EXISTS (SELECT 1 FROM team_members tu WHERE tu.teamId = o.teamId AND tu.userId = $1 AND tu.status = 'aktif'))
		    OR (o.tur = 'ozel' AND EXISTS (SELECT 1 FROM chat_members su WHERE su.odaId = o.id AND su.userId = $1))
		 ORDER BY o.tur = 'genel' DESC, COALESCE((SELECT m3.date FROM chat_messages m3 WHERE m3.odaId = o.id AND ($2 = true OR m3.silinmeTarihi IS NULL) ORDER BY m3.date DESC LIMIT 1), o.olusturma) DESC`,
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
						odaId: String(rawSon.odaId ?? rawSon.odaid ?? row.id),
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

export async function getPollDetails(pollId: string, currentUserId?: string): Promise<ChatPollItem | null> {
	await ensurePostgresInit();
	const p = getPgPool();

	const pollRes = await p.query(
		`SELECT id, mesajId, odaId, olusturanId, soru, cokluSecim, anonim, endsAt, kapali, olusturma
		 FROM chat_polls
		 WHERE id = $1`,
		[pollId]
	);

	if (pollRes.rows.length === 0) return null;
	const row = pollRes.rows[0];

	let creatorName = 'Yönetici';
	try {
		const uRes = await p.query(
			`SELECT first_name AS ad, last_name AS soyad FROM users WHERE id = $1`,
			[row.olusturanid ?? row.olusturanId]
		);
		if (uRes.rows.length > 0) {
			creatorName = `${uRes.rows[0].ad} ${uRes.rows[0].soyad}`.trim();
		}
	} catch {}

	const optRes = await p.query(
		`SELECT id, pollId, sira, metin
		 FROM chat_poll_options
		 WHERE pollId = $1
		 ORDER BY sira ASC`,
		[pollId]
	);

	const votesRes = await p.query(
		`SELECT id, secenekId, userId, userFirstName, userAvatar
		 FROM chat_poll_votes
		 WHERE pollId = $1`,
		[pollId]
	);

	const totalVotes = votesRes.rows.length;
	const isAnon = Boolean(row.anonim ?? row.anonim);
	const userVotes: string[] = [];

	const options: ChatPollOptionItem[] = optRes.rows.map((opt) => {
		const optId = String(opt.id);
		const optVotes = votesRes.rows.filter((v) => String(v.secenekid ?? v.secenekId) === optId);
		const count = optVotes.length;
		const yuzde = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

		const hasUserVoted = currentUserId
			? optVotes.some((v) => String(v.kullaniciid ?? v.userId) === currentUserId)
			: false;
		if (hasUserVoted) {
			userVotes.push(optId);
		}

		return {
			id: optId,
			pollId: String(opt.anketid ?? opt.pollId ?? pollId),
			sira: Number(opt.sira ?? 0),
			metin: String(opt.metin ?? ''),
			oySayisi: count,
			yuzde,
			oyVerenler: !isAnon
				? optVotes.map((v) => ({
						id: String(v.kullaniciid ?? v.userId),
						ad: String(v.kullaniciad ?? v.userFirstName),
						foto: (v.kullanicifoto ?? v.userAvatar ?? null) as string | null,
				  }))
				: undefined,
		};
	});

	const endsAt = row.sonlanmatarihi ?? row.endsAt ? Number(row.sonlanmatarihi ?? row.endsAt) : null;
	const isExpired = endsAt ? Date.now() > endsAt : false;
	const isClosed = Boolean(row.kapali) || isExpired;

	return {
		id: String(row.id),
		mesajId: String(row.mesajid ?? row.mesajId),
		odaId: String(row.odaid ?? row.odaId),
		olusturanId: String(row.olusturanid ?? row.olusturanId),
		olusturanAd: creatorName,
		soru: String(row.soru ?? ''),
		cokluSecim: Boolean(row.coklusecim ?? row.cokluSecim),
		anonim: isAnon,
		endsAt,
		kapali: isClosed,
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

	if (pollMessageMap.size === 0) {
		try {
			await ensurePostgresInit();
			const p = getPgPool();
			const mIds = messages.map((m) => m.id);
			const foundPolls = await p.query(
				`SELECT id, mesajId FROM chat_polls WHERE mesajId = ANY($1)`,
				[mIds]
			);
			for (const r of foundPolls.rows) {
				pollMessageMap.set(String(r.mesajid ?? r.mesajId), String(r.id));
			}
		} catch {}
	}

	if (pollMessageMap.size === 0) return messages;

	const pollDetailsMap = new Map<string, ChatPollItem>();
	await Promise.all(
		Array.from(pollMessageMap.entries()).map(async ([mesajId, pollId]) => {
			const poll = await getPollDetails(pollId, currentUserId);
			if (poll) pollDetailsMap.set(mesajId, poll);
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
	odaId: string,
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
		          odaId AS "odaId",
		          gonderenId AS "gonderenId",
		          gonderenAd AS "gonderenAd",
		          gonderenFoto AS "gonderenFoto",
		          icerik,
		          ekler,
		          date,
		          silinmeTarihi AS "silinmeTarihi",
		          duzenlenmeTarihi AS "duzenlenmeTarihi",
		          yanitlananMesajId AS "yanitlananMesajId",
		          yanitlananMesaj AS "yanitlananMesaj",
		          COALESCE(iletildiMi, 0) AS "iletildiMi"
		   FROM chat_messages
		   WHERE odaId = $1
		     AND ($3 = true OR silinmeTarihi IS NULL)
		     AND ($4::bigint IS NULL OR date < $4 OR (date = $4 AND id < $5))
		   ORDER BY date DESC, id DESC
		   LIMIT $2
		 ) AS latest
		 ORDER BY date ASC, id ASC`,
		[odaId, safeLimit, isAdmin, before?.date ?? null, before?.id ?? null]
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
			odaId: String(r.odaId ?? r.odaid ?? odaId),
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
		        odaId AS "odaId",
		        gonderenId AS "gonderenId",
		        gonderenAd AS "gonderenAd",
		        gonderenFoto AS "gonderenFoto",
		        icerik,
		        ekler,
		        date,
		        silinmeTarihi AS "silinmeTarihi",
		        duzenlenmeTarihi AS "duzenlenmeTarihi",
		        yanitlananMesajId AS "yanitlananMesajId",
		        yanitlananMesaj AS "yanitlananMesaj",
		        COALESCE(iletildiMi, 0) AS "iletildiMi"
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
		odaId: String(r.odaId ?? r.odaid ?? ''),
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
	odaId: string,
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
		`INSERT INTO chat_messages (id, odaId, gonderenId, gonderenAd, gonderenFoto, icerik, ekler, date, yanitlananMesajId, yanitlananMesaj, iletildiMi)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		[
			id,
			odaId,
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
		`INSERT INTO chat_members (odaId, userId, sonOkuma)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (odaId, userId) DO UPDATE SET sonOkuma = $3`,
		[odaId, gonderen.id, date]
	);

	const createdMsg: ChatMessageRecord = {
		id,
		odaId,
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
			[JSON.stringify({ type: 'new_message', odaId, message: createdMsg })]
		);
	} catch (err) {
		console.warn('[Chat notify warning]:', err);
	}

	// 2. Notify global Notification Center & Dock Badge SSE stream (`beu_olaylar`)
	void notifyChatRoomParticipants(odaId, gonderen.id);

	return createdMsg;
}

export async function softDeleteChatMessage(
	mesajId: string,
	userId: string,
	isAdmin = false
): Promise<{ ok: boolean; odaId?: string; messageId?: string; silinmeTarihi?: number }> {
	await ensurePostgresInit();
	const p = getPgPool();

	const checkRes = await p.query(
		`SELECT id, odaId, gonderenId FROM chat_messages WHERE id = $1 LIMIT 1`,
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
		`UPDATE chat_messages SET silinmeTarihi = $1 WHERE id = $2`,
		[now, mesajId]
	);

	try {
		await p.query(
			`SELECT pg_notify('club_chat_events', $1)`,
			[
				JSON.stringify({
					type: 'message_deleted',
					odaId: msg.odaId,
					messageId: mesajId,
					silinmeTarihi: now,
				}),
			]
		);
	} catch (e) {
		console.warn('[Chat notify delete error]:', e);
	}

	return { ok: true, odaId: msg.odaId, messageId: mesajId, silinmeTarihi: now };
}

export async function softDeleteChatMessagesBatch(
	odaId: string,
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
		 WHERE odaId = $1 AND silinmeTarihi IS NULL
		 ORDER BY date DESC
		 LIMIT $2`,
		[odaId, limit]
	);

	const deletedIds = selectRes.rows.map((r) => String(r.id));
	if (deletedIds.length === 0) {
		return { ok: true, count: 0, deletedIds: [], silinmeTarihi: now };
	}

	await p.query(
		`UPDATE chat_messages
		 SET silinmeTarihi = $1
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
					odaId,
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
		`SELECT id, odaId, gonderenId, gonderenAd, gonderenFoto, ekler, date, silinmeTarihi
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
		`UPDATE chat_messages SET icerik = $1, duzenlenmeTarihi = $2 WHERE id = $3`,
		[trimmed, now, mesajId]
	);

	const updatedMsg: ChatMessageRecord = {
		id: String(existing.id),
		odaId: String(existing.odaId),
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
					odaId: updatedMsg.odaId,
					message: updatedMsg,
				}),
			]
		);
	} catch (e) {
		console.warn('[Chat notify edit error]:', e);
	}

	return { ok: true, message: updatedMsg };
}

export async function markRoomAsRead(odaId: string, userId: string): Promise<void> {
	await ensurePostgresInit();
	const p = getPgPool();
	const now = Date.now();
	await p.query(
		`INSERT INTO chat_members (odaId, userId, sonOkuma)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (odaId, userId) DO UPDATE SET sonOkuma = $3`,
		[odaId, userId, now]
	);
	// Refresh the reader's Notification Center & Dock badge
	void publishEventQuiet(p, { k: 'bildirim', userId });
}

export async function ensureTeamChatRoom(teamId: string, takimAd: string): Promise<string> {
	await ensurePostgresInit();
	const p = getPgPool();
	const roomId = `oda_takim_${teamId}`;
	await p.query(
		`INSERT INTO chat_rooms (id, tur, teamId, ad, olusturma)
		 VALUES ($1, 'takim', $2, $3, $4)
		 ON CONFLICT (id) DO UPDATE SET ad = $3`,
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
): Promise<{ odaId: string; isNew: boolean }> {
	await ensurePostgresInit();
	// Serialize the check-then-create sequence for the same pair. Without this,
	// two quick clicks can both observe "no room" and create duplicate DMs.
	const lockKey = [kullanici1Id, kullanici2Id].sort().join(':');
	return withTransaction(async (client) => {
		await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [lockKey]);
		const existing = await client.query(
			`SELECT o.id FROM chat_rooms o
			 WHERE o.tur = 'ozel'
			   AND (SELECT COUNT(*) FROM chat_members WHERE odaId = o.id) = 2
			   AND EXISTS (SELECT 1 FROM chat_members WHERE odaId = o.id AND userId = $1)
			   AND EXISTS (SELECT 1 FROM chat_members WHERE odaId = o.id AND userId = $2)
			 LIMIT 1`,
			[kullanici1Id, kullanici2Id]
		);
		if (existing.rows.length > 0) {
			return { odaId: String(existing.rows[0].id), isNew: false };
		}

		const odaId = `dm_${randomUUID()}`;
		const now = Date.now();
		const usersRes = await client.query(
			`SELECT id, first_name AS ad, last_name AS soyad FROM users WHERE id IN ($1, $2)`,
			[kullanici1Id, kullanici2Id]
		);
		const names = usersRes.rows.map((u) => `${u.ad} ${u.soyad}`.trim()).join(' & ');
		const roomName = names || 'Özel Sohbet';

		await client.query(
			`INSERT INTO chat_rooms (id, tur, ad, olusturma)
			 VALUES ($1, 'ozel', $2, $3)`,
			[odaId, roomName, now]
		);
		await client.query(
			`INSERT INTO chat_members (odaId, userId, sonOkuma)
			 VALUES ($1, $2, $3), ($1, $4, $3)
			 ON CONFLICT (odaId, userId) DO NOTHING`,
			[odaId, kullanici1Id, now, kullanici2Id]
		);
		return { odaId, isNew: true };
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
): Promise<{ odaId: string; ad: string }> {
	await ensurePostgresInit();
	const p = getPgPool();
	const now = Date.now();
	const odaId = `grp_${randomUUID()}`;

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
		`INSERT INTO chat_rooms (id, tur, ad, olusturma)
		 VALUES ($1, 'ozel', $2, $3)`,
		[odaId, groupTitle, now]
	);

	for (const uid of allMemberIds) {
		// Creator has read up to `now`; invited members get `now - 1` so the creation message is unread for them
		const initialRead = uid === olusturan.id ? now : now - 1;
		await p.query(
			`INSERT INTO chat_members (odaId, userId, sonOkuma)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (odaId, userId) DO NOTHING`,
			[odaId, uid, initialRead]
		);
	}

	// Insert system message about group creation
	const sysMsgId = randomUUID();
	const creatorName = `${olusturan.ad} ${olusturan.soyad}`.trim();
	const sysContent = `${creatorName} grubu oluşturdu.`;
	await p.query(
		`INSERT INTO chat_messages (id, odaId, gonderenId, gonderenAd, gonderenFoto, icerik, ekler, date)
		 VALUES ($1, $2, 'sistem', 'Sistem', NULL, $3, '[]', $4)`,
		[sysMsgId, odaId, sysContent, now]
	);

	try {
		await p.query(
			`SELECT pg_notify('club_chat_events', $1)`,
			[
				JSON.stringify({
					type: 'new_message',
					odaId,
					message: {
						id: sysMsgId,
						odaId,
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

	void notifyChatRoomParticipants(odaId, olusturan.id);

	return { odaId, ad: groupTitle };
}

/**
 * Adds new members to an existing room and publishes a system notification.
 */
export async function addMembersToRoom(
	odaId: string,
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
		   AND id NOT IN (SELECT userId FROM chat_members WHERE odaId = $2)`,
		[yeniUyeIdleri, odaId]
	);

	if (toAddRes.rows.length === 0) return { addedCount: 0 };

	for (const row of toAddRes.rows) {
		await p.query(
			`INSERT INTO chat_members (odaId, userId, sonOkuma)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (odaId, userId) DO NOTHING`,
			[odaId, row.id, now - 1]
		);
	}
	invalidateChatAudience(odaId);

	const addedNames = toAddRes.rows.map((r) => `${r.ad} ${r.soyad}`.trim()).join(', ');
	const actorName = `${actor.ad} ${actor.soyad}`.trim();
	const sysContent = `${actorName}, ${addedNames} üyesini gruba ekledi.`;
	const sysMsgId = randomUUID();

	await p.query(
		`INSERT INTO chat_messages (id, odaId, gonderenId, gonderenAd, gonderenFoto, icerik, ekler, date)
		 VALUES ($1, $2, 'sistem', 'Sistem', NULL, $3, '[]', $4)`,
		[sysMsgId, odaId, sysContent, now]
	);

	try {
		await p.query(
			`SELECT pg_notify('club_chat_events', $1)`,
			[
				JSON.stringify({
					type: 'new_message',
					odaId,
					message: {
						id: sysMsgId,
						odaId,
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

	void notifyChatRoomParticipants(odaId, actor.id);

	return { addedCount: toAddRes.rows.length };
}

/**
 * Retrieves members of a specific chat room.
 */
export async function getRoomMembers(odaId: string): Promise<ChatRoomMemberItem[]> {
	await ensurePostgresInit();
	const p = getPgPool();
	const res = await p.query(
		`SELECT k.id, k.first_name AS ad, k.last_name AS soyad, k.avatar_url as "profilFoto", k.department as bolum, r.ad as "rolAd"
		 FROM chat_members su
		 JOIN users k ON k.id = su.userId
		 LEFT JOIN roller r ON r.id = k.role_id
		 WHERE su.odaId = $1
		 ORDER BY k.first_name ASC, k.last_name ASC`,
		[odaId]
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
 * Returns all active club members for the "New Chat" member picker.
 */
export async function getChatContacts(excludeUserId: string): Promise<ChatContactItem[]> {
	await ensurePostgresInit();
	const p = getPgPool();
	const res = await p.query(
		`SELECT k.id, k.first_name AS ad, k.last_name AS soyad, k.avatar_url as "profilFoto", k.department as bolum, r.ad as "rolAd"
		 FROM users k
		 LEFT JOIN roller r ON r.id = k.role_id
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
	odaId: string,
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
	const eklerJson = JSON.stringify([{ tip: 'anket', pollId, soru }]);

	// 1. Insert chat message
	await p.query(
		`INSERT INTO chat_messages (id, odaId, gonderenId, gonderenAd, gonderenFoto, icerik, ekler, date)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		[messageId, odaId, olusturan.id, senderName, gonderenFoto, soru, eklerJson, now]
	);

	// 2. Insert poll
	await p.query(
		`INSERT INTO chat_polls (id, mesajId, odaId, olusturanId, soru, cokluSecim, anonim, endsAt, kapali, olusturma)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, $9)`,
		[
			pollId,
			messageId,
			odaId,
			olusturan.id,
			soru,
			Boolean(data.cokluSecim),
			data.anonim !== false,
			endsAt,
			now,
		]
	);

	// 3. Insert options
	for (let i = 0; i < cleanSecenekler.length; i++) {
		const optId = `opt_${randomUUID()}`;
		await p.query(
			`INSERT INTO chat_poll_options (id, pollId, sira, metin)
			 VALUES ($1, $2, $3, $4)`,
			[optId, pollId, i, cleanSecenekler[i]]
		);
	}

	// 4. Mark sender read pointer
	await p.query(
		`INSERT INTO chat_members (odaId, userId, sonOkuma)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (odaId, userId) DO UPDATE SET sonOkuma = EXCLUDED.sonOkuma`,
		[odaId, olusturan.id, now]
	);

	// 5. Fetch complete poll details
	const pollDetails = await getPollDetails(pollId, olusturan.id);

	const createdMsg: ChatMessageRecord = {
		id: messageId,
		odaId,
		gonderenId: olusturan.id,
		gonderenAd: senderName,
		gonderenFoto,
		icerik: soru,
		ekler: [{ tip: 'anket', pollId, ad: 'Anket', url: '' }],
		date: now,
		anket: pollDetails,
	};

	// 6. Real-time broadcast
	try {
		await p.query(
			`SELECT pg_notify('club_chat_events', $1)`,
			[JSON.stringify({ type: 'new_message', odaId, message: createdMsg })]
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
		`SELECT id, odaId, cokluSecim, kapali, endsAt
		 FROM chat_polls
		 WHERE id = $1`,
		[pollId]
	);

	if (pollRes.rows.length === 0) {
		return { ok: false, error: 'Anket bulunamadı.' };
	}

	const pollRow = pollRes.rows[0];
	const pollOdaId = String(pollRow.odaid ?? pollRow.odaId ?? '');
	const hasAccess = await canUserAccessChatRoom(pollOdaId, kullanici.id, isAdmin);
	if (!hasAccess) {
		return { ok: false, error: 'Bu odadaki ankete erişim yetkiniz yok.' };
	}

	const isClosed = Boolean(pollRow.kapali);
	const endsAt = pollRow.sonlanmatarihi ?? pollRow.endsAt;
	if (isClosed || (endsAt && Date.now() > Number(endsAt))) {
		return { ok: false, error: 'Bu anket oylamaya kapatılmıştır.' };
	}

	// Verify secenekId belongs to this poll
	const optRes = await p.query(
		`SELECT 1 FROM chat_poll_options WHERE id = $1 AND pollId = $2 LIMIT 1`,
		[secenekId, pollId]
	);
	if (optRes.rows.length === 0) {
		return { ok: false, error: 'Geçersiz anket seçeneği.' };
	}

	const isMulti = Boolean(pollRow.coklusecim ?? pollRow.cokluSecim);
	const userFirstName = `${kullanici.ad} ${kullanici.soyad}`.trim() || 'Üye';
	const userAvatar = kullanici.profilFoto || null;

	// 2. Check if user already voted for this option
	const existingVoteRes = await p.query(
		`SELECT id FROM chat_poll_votes
		 WHERE pollId = $1 AND secenekId = $2 AND userId = $3`,
		[pollId, secenekId, kullanici.id]
	);

	if (existingVoteRes.rows.length > 0) {
		// Toggle off: remove vote
		await p.query(
			`DELETE FROM chat_poll_votes
			 WHERE pollId = $1 AND secenekId = $2 AND userId = $3`,
			[pollId, secenekId, kullanici.id]
		);
	} else {
		// If single-choice, remove any prior votes on this poll
		if (!isMulti) {
			await p.query(
				`DELETE FROM chat_poll_votes
				 WHERE pollId = $1 AND userId = $2`,
				[pollId, kullanici.id]
			);
		}

		// Insert vote
		const voteId = `vote_${randomUUID()}`;
		await p.query(
			`INSERT INTO chat_poll_votes (id, pollId, secenekId, userId, userFirstName, userAvatar, date)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			[voteId, pollId, secenekId, kullanici.id, userFirstName, userAvatar, Date.now()]
		);
	}

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
					odaId: pollRow.odaid ?? pollRow.odaId,
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
		`SELECT id, odaId, olusturanId, kapali FROM chat_polls WHERE id = $1`,
		[pollId]
	);

	if (pollRes.rows.length === 0) {
		return { ok: false, error: 'Anket bulunamadı.' };
	}

	const pollRow = pollRes.rows[0];
	const creatorId = String(pollRow.olusturanid ?? pollRow.olusturanId);

	if (!isAdmin && creatorId !== userId) {
		return { ok: false, error: 'Bu anketi kapatma yetkiniz yok.' };
	}

	await p.query(`UPDATE chat_polls SET kapali = true WHERE id = $1`, [pollId]);

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
					odaId: pollRow.odaid ?? pollRow.odaId,
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

