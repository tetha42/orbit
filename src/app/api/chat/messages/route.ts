import { NextResponse } from 'next/server';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import { requireApp } from '@/lib/auth/access';
import {
	canUserAccessChatRoom,
	getChatRoomMessages,
	getChatMessageById,
	createChatMessage,
	softDeleteChatMessage,
	softDeleteChatMessagesBatch,
	editChatMessage,
} from '@/db/repositories/chat.repo';
import { addStoredFile, getStoredFile } from '@/db';
import { UPLOAD_NAME_RE, mimeForName, uploadDir } from '@/lib/uploads';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { recordSecurityStrike } from '@/db/repositories/security.repo';
import { clientAddress } from '@/lib/http';
import { consumeRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

const NO_CACHE = { 'Cache-Control': 'no-store' };
const MAX_CHAT_MESSAGE_LENGTH = 4000;

export async function GET(request: Request) {
	const auth = await requireApp(request, 'chat', 'kullan');
	if (!auth.authorized) return auth.response;

	const { searchParams } = new URL(request.url);
	const odaId = searchParams.get('odaId');
	const rawLimit = Number(searchParams.get('limit') || '50');
	const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(Math.trunc(rawLimit), 100)) : 50;
	const beforeDate = Number(searchParams.get('before'));
	const beforeId = searchParams.get('beforeId');
	const before =
		Number.isFinite(beforeDate) && beforeDate > 0 && beforeId
			? { date: beforeDate, id: beforeId }
			: null;

	if (!odaId) {
		return NextResponse.json({ error: 'Oda ID belirtilmedi.' }, { status: 400, headers: NO_CACHE });
	}

	try {
		const isAdmin = Boolean(auth.user.permission?.admin || auth.user.roleId === 'admin');
		const hasAccess = await canUserAccessChatRoom(odaId, auth.user.id, isAdmin);
		if (!hasAccess) {
			const ip = clientAddress(request);
			void logSystemEvent({
				servis: 'security',
				seviye: 'WARN',
				mesaj: `Unauthorized chat room read attempt (IDOR: ${odaId}): ${auth.user.email}`,
				detay: { odaId },
				userId: auth.user.id,
				ip,
			});
			void recordSecurityStrike({
				ip,
				points: 25,
				reason: `Private chat IDOR read attempt (${odaId})`,
				path: '/api/chat/messages',
				userId: auth.user.id,
			});
			return NextResponse.json(
				{ error: 'Bu sohbet odasına erişim yetkiniz bulunmuyor.' },
				{ status: 403, headers: NO_CACHE }
			);
		}
		// Ask for one extra row to know whether older messages remain without a
		// second query. The repo returns the window oldest → newest, so the extra
		// (oldest) row is dropped and the next page starts before the first
		// returned message.
		const page = await getChatRoomMessages(odaId, limit + 1, isAdmin, auth.user.id, before);
		const hasMore = page.length > limit;
		const messages = hasMore ? page.slice(1) : page;
		return NextResponse.json({ ok: true, messages, hasMore }, { headers: NO_CACHE });
	} catch (err) {
		console.error('[Chat messages GET error]:', err);
		return NextResponse.json({ error: 'Mesajlar alınamadı.' }, { status: 500, headers: NO_CACHE });
	}
}


/**
 * Forwarding an attachment must not link the target room to a file that only
 * source-room members may read. The bytes are copied and registered under the
 * target room, so forwarded media is exactly as private as its new message.
 */
async function cloneAttachmentsForRoom(
	attachments: Array<{ ad: string; url: string; boyut?: number; tip?: string }>,
	roomId: string,
	userId: string
): Promise<Array<{ ad: string; url: string; boyut?: number; tip?: string }>> {
	const cloned: Array<{ ad: string; url: string; boyut?: number; tip?: string }> = [];
	const dir = uploadDir();
	await mkdir(dir, { recursive: true });
	for (const attachment of attachments) {
		const sourceName = attachment.url.replace('/api/uploads/', '');
		if (!UPLOAD_NAME_RE.test(sourceName)) continue;
		try {
			const buffer = await readFile(path.join(dir, sourceName));
			const extension = sourceName.slice(sourceName.lastIndexOf('.'));
			const name = `${Date.now()}_${randomBytes(9).toString('hex')}${extension}`;
			await writeFile(path.join(dir, name), buffer, { flag: 'wx' });
			const mime = attachment.tip || mimeForName(name);
			await addStoredFile({
				ad: name,
				yukleyenId: userId,
				mime,
				boyut: buffer.length,
				sohbetOdaId: roomId,
			});
			cloned.push({
				ad: attachment.ad,
				url: `/api/uploads/${name}`,
				boyut: buffer.length,
				tip: mime,
			});
		} catch {
			// A missing source file is skipped rather than breaking the forward.
		}
	}
	return cloned;
}

export async function POST(request: Request) {
	const auth = await requireApp(request, 'chat', 'kullan');
	if (!auth.authorized) return auth.response;

	const msgLimit = consumeRateLimit(`chat:msg:${auth.user.id}`, 40, 60_000);
	if (!msgLimit.allowed) {
		return NextResponse.json(
			{ error: 'Çok hızlı mesaj gönderiyorsunuz. Lütfen biraz bekleyin.' },
			{ status: 429, headers: { ...NO_CACHE, 'Retry-After': String(msgLimit.retryAfter) } }
		);
	}

	try {
		const body = await request.json();
		const isAdmin = Boolean(auth.user.permission?.admin || auth.user.roleId === 'admin');

		// Handle forward action
		if (body.action === 'forward') {
			const { mesajId, targetOdaIds } = body;
			if (!mesajId || !Array.isArray(targetOdaIds) || targetOdaIds.length === 0) {
				return NextResponse.json(
					{ error: 'İletilecek mesaj ve hedef odalar belirtilmelidir.' },
					{ status: 400, headers: NO_CACHE }
				);
			}

			if (targetOdaIds.length > 10) {
				return NextResponse.json(
					{ error: 'Bir seferde en fazla 10 odaya iletilebilir.' },
					{ status: 400, headers: NO_CACHE }
				);
			}

			const sourceMsg = await getChatMessageById(String(mesajId));
			if (!sourceMsg) {
				return NextResponse.json({ error: 'İletilecek mesaj bulunamadı.' }, { status: 404, headers: NO_CACHE });
			}

			const hasSourceAccess = await canUserAccessChatRoom(sourceMsg.odaId, auth.user.id, isAdmin);
			if (!hasSourceAccess) {
				return NextResponse.json({ error: 'Kaynak mesaja erişim yetkiniz yok.' }, { status: 403, headers: NO_CACHE });
			}

			const forwardedMessages = [];
			for (const targetOdaId of targetOdaIds) {
				const canSend = await canUserAccessChatRoom(String(targetOdaId), auth.user.id, isAdmin);
				if (canSend) {
					const copiedAttachments = await cloneAttachmentsForRoom(
						sourceMsg.ekler,
						String(targetOdaId),
						auth.user.id
					);
					const fMsg = await createChatMessage(
						String(targetOdaId),
						{
							id: auth.user.id,
							ad: auth.user.ad,
							soyad: auth.user.soyad,
							profilFoto: auth.user.profilFoto,
						},
						sourceMsg.icerik,
						copiedAttachments,
						{ iletildiMi: true }
					);
					forwardedMessages.push(fMsg);
				}
			}

			void logSystemEvent({
				servis: 'chat',
				seviye: 'INFO',
				mesaj: `Sohbet mesajı iletildi: ${mesajId} -> ${forwardedMessages.length} oda`,
				detay: { sourceMessageId: mesajId, targetOdaIds, forwardedCount: forwardedMessages.length },
				userId: auth.user.id,
				ip: clientAddress(request),
			});

			return NextResponse.json(
				{ ok: true, forwardedCount: forwardedMessages.length, messages: forwardedMessages },
				{ headers: NO_CACHE }
			);
		}

		const { odaId, icerik, ekler, yanitlananMesajId, yanitlananMesaj, iletildiMi } = body;

		// Attachments-only messages are valid; the text may be empty.
		const attachments = (Array.isArray(ekler) ? ekler : [])
			.slice(0, 10)
			.filter(
				(item): item is { ad: unknown; url: string; boyut?: unknown; tip?: unknown } =>
					Boolean(item) &&
					typeof item === 'object' &&
					typeof (item as { url?: unknown }).url === 'string' &&
					String((item as { url?: unknown }).url).startsWith('/api/uploads/')
			)
			.map((item) => ({
				ad: String(item.ad ?? 'attachment').slice(0, 140),
				url: String(item.url),
				...(typeof item.boyut === 'number' ? { boyut: item.boyut } : {}),
				...(typeof item.tip === 'string' ? { tip: item.tip.slice(0, 120) } : {}),
			}));

		if (typeof icerik !== 'string' || (!icerik.trim() && attachments.length === 0)) {
			return NextResponse.json({ error: 'Mesaj içeriği boş olamaz.' }, { status: 400, headers: NO_CACHE });
		}
		if (!odaId) {
			return NextResponse.json({ error: 'Oda ID belirtilmedi.' }, { status: 400, headers: NO_CACHE });
		}

		const trimmedContent = icerik.trim();
		if (trimmedContent.length > MAX_CHAT_MESSAGE_LENGTH) {
			return NextResponse.json(
				{ error: `Mesaj içeriği en fazla ${MAX_CHAT_MESSAGE_LENGTH} karakter olabilir.` },
				{ status: 400, headers: NO_CACHE }
			);
		}

		const hasAccess = await canUserAccessChatRoom(String(odaId), auth.user.id, isAdmin);
		if (!hasAccess) {
			const ip = clientAddress(request);
			void logSystemEvent({
				servis: 'security',
				seviye: 'WARN',
				mesaj: `Unauthorized chat room send attempt (IDOR: ${odaId}): ${auth.user.email}`,
				detay: { odaId },
				userId: auth.user.id,
				ip,
			});
			void recordSecurityStrike({
				ip,
				points: 25,
				reason: `Private chat IDOR write attempt (${odaId})`,
				path: '/api/chat/messages',
				userId: auth.user.id,
			});
			return NextResponse.json(
				{ error: 'Bu sohbet odasına mesaj gönderme yetkiniz bulunmuyor.' },
				{ status: 403, headers: NO_CACHE }
			);
		}

		// Only attachments that belong to this room (or were uploaded by the
		// sender) may travel with the message. Knowing another room's file URL is
		// not enough to attach it.
		const safeAttachments = (
			await Promise.all(
				attachments.map(async (attachment) => {
					const name = attachment.url.replace('/api/uploads/', '');
					const file = await getStoredFile(name);
					if (!file) return null;
					if (file.sohbetOdaId === String(odaId)) return attachment;
					return null;
				})
			)
		).filter((attachment): attachment is NonNullable<typeof attachment> => attachment !== null);

		if (!trimmedContent && safeAttachments.length === 0) {
			return NextResponse.json(
				{ error: 'Mesaj içeriği veya ek gereklidir.' },
				{ status: 400, headers: NO_CACHE }
			);
		}

		// Check for /clear command (Discord-bot style)
		if (trimmedContent.startsWith('/clear')) {
			if (!isAdmin) {
				return NextResponse.json(
					{ error: 'Yalnızca yöneticiler /clear komutunu kullanabilir.' },
					{ status: 403, headers: NO_CACHE }
				);
			}

			const parts = trimmedContent.split(/\s+/);
			let count = 50;
			if (parts.length > 1) {
				const parsed = parseInt(parts[1], 10);
				if (!isNaN(parsed) && parsed > 0) {
					count = parsed;
				}
			}

			const clearRes = await softDeleteChatMessagesBatch(odaId, count, true);

			// Post a system notification to the room
			const sysMsg = await createChatMessage(
				odaId,
				{
					id: 'sistem',
					ad: 'Sistem',
					soyad: '',
					profilFoto: null,
				},
				`🧹 ${clearRes.count} adet mesaj temizlendi.`
			);

			void logSystemEvent({
				servis: 'chat',
				seviye: 'WARN',
				mesaj: `/clear komutu çalıştırıldı: ${odaId} (${clearRes.count} mesaj)`,
				detay: { odaId, count: clearRes.count, deletedIds: clearRes.deletedIds },
				userId: auth.user.id,
				ip: clientAddress(request),
			});

			return NextResponse.json(
				{
					ok: true,
					cleared: true,
					clearedCount: clearRes.count,
					deletedIds: clearRes.deletedIds,
					message: sysMsg,
				},
				{ headers: NO_CACHE }
			);
		}

		const message = await createChatMessage(
			odaId,
			{
				id: auth.user.id,
				ad: auth.user.ad,
				soyad: auth.user.soyad,
				profilFoto: auth.user.profilFoto,
			},
			trimmedContent,
			safeAttachments,
			{
				yanitlananMesajId: yanitlananMesajId ? String(yanitlananMesajId) : null,
				yanitlananMesaj: yanitlananMesaj && typeof yanitlananMesaj === 'object' ? yanitlananMesaj : null,
				iletildiMi: Boolean(iletildiMi),
			}
		);

		// One audit row per message would mean ~13M rows/day at 150 msg/s.
		// Keep a heartbeat entry per room per minute instead; message rows are
		// already persisted in sohbet_mesajlari.
		if (consumeRateLimit(`chat:log:${odaId}`, 1, 60_000).allowed) {
			void logSystemEvent({
				servis: 'chat',
				seviye: 'INFO',
				mesaj: `Sohbet mesajı gönderildi: ${odaId}`,
				detay: { odaId, messageId: message.id },
				userId: auth.user.id,
				ip: clientAddress(request),
			});
		}

		return NextResponse.json({ ok: true, message }, { headers: NO_CACHE });
	} catch (err) {
		console.error('[Chat messages POST error]:', err);
		return NextResponse.json({ error: 'Mesaj gönderilemedi.' }, { status: 500, headers: NO_CACHE });
	}
}

export async function PATCH(request: Request) {
	const auth = await requireApp(request, 'chat', 'kullan');
	if (!auth.authorized) return auth.response;

	try {
		const body = await request.json();
		const { id, mesajId, icerik } = body;
		const targetId = String(id || mesajId || '');

		if (!targetId || typeof icerik !== 'string' || !icerik.trim()) {
			return NextResponse.json({ error: 'Geçersiz mesaj düzenleme verisi.' }, { status: 400, headers: NO_CACHE });
		}

		const res = await editChatMessage(targetId, icerik.trim(), auth.user.id);
		if (!res.ok || !res.message) {
			return NextResponse.json(
				{ error: 'Mesaj düzenlenemedi veya bu işlem için yetkiniz yok.' },
				{ status: 403, headers: NO_CACHE }
			);
		}

		void logSystemEvent({
			servis: 'chat',
			seviye: 'INFO',
			mesaj: `Sohbet mesajı düzenlendi: ${targetId}`,
			detay: { messageId: targetId },
			userId: auth.user.id,
			ip: clientAddress(request),
		});

		return NextResponse.json({ ok: true, message: res.message }, { headers: NO_CACHE });
	} catch (err) {
		console.error('[Chat messages PATCH error]:', err);
		return NextResponse.json({ error: 'Mesaj düzenlenemedi.' }, { status: 500, headers: NO_CACHE });
	}
}

export async function DELETE(request: Request) {
	const auth = await requireApp(request, 'chat', 'kullan');
	if (!auth.authorized) return auth.response;

	try {
		const { searchParams } = new URL(request.url);
		let targetId = searchParams.get('id') || searchParams.get('mesajId');

		if (!targetId) {
			try {
				const body = await request.json();
				targetId = body.id || body.mesajId;
			} catch {}
		}

		if (!targetId) {
			return NextResponse.json({ error: 'Silinecek mesaj ID belirtilmedi.' }, { status: 400, headers: NO_CACHE });
		}

		const isAdmin = Boolean(auth.user.permission?.admin || auth.user.roleId === 'admin');
		const res = await softDeleteChatMessage(targetId, auth.user.id, isAdmin);

		if (!res.ok) {
			return NextResponse.json(
				{ error: 'Mesaj silinemedi veya bu işlem için yetkiniz yok.' },
				{ status: 403, headers: NO_CACHE }
			);
		}

		void logSystemEvent({
			servis: 'chat',
			seviye: 'WARN',
			mesaj: `Sohbet mesajı silindi: ${targetId}`,
			detay: { messageId: targetId, odaId: res.odaId },
			userId: auth.user.id,
			ip: clientAddress(request),
		});

		return NextResponse.json({ ok: true, messageId: targetId, silinmeTarihi: res.silinmeTarihi }, { headers: NO_CACHE });
	} catch (err) {
		console.error('[Chat messages DELETE error]:', err);
		return NextResponse.json({ error: 'Mesaj silinemedi.' }, { status: 500, headers: NO_CACHE });
	}
}

