import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { requireApp } from '@/lib/auth/access';
import {
	canUserAccessChatRoom,
	getChatRooms,
	markRoomAsRead,
	ensureTeamChatRoom,
	getChatContacts,
	getRoomMembers,
	getOrCreateDmRoom,
	createGroupDm,
	addMembersToRoom,
} from '@/db/repositories/chat.repo';

export const dynamic = 'force-dynamic';

const NO_CACHE = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
	const auth = await requireApp(request, 'chat', 'kullan');
	if (!auth.authorized) return auth.response;

	const { searchParams } = new URL(request.url);
	const action = searchParams.get('action');

	try {
		if (action === 'contacts') {
			const contacts = await getChatContacts(auth.user.id);
			return NextResponse.json({ ok: true, contacts }, { headers: NO_CACHE });
		}

		if (action === 'members') {
			const odaId = searchParams.get('odaId');
			if (!odaId) {
				return NextResponse.json({ error: 'Oda ID belirtilmedi.' }, { status: 400, headers: NO_CACHE });
			}
			const hasAccess = await canUserAccessChatRoom(odaId, auth.user.id, auth.user.permission.admin);
			if (!hasAccess) {
				return NextResponse.json({ error: 'Bu odaya erişim yetkiniz yok.' }, { status: 403, headers: NO_CACHE });
			}
			const members = await getRoomMembers(odaId);
			return NextResponse.json({ ok: true, members }, { headers: NO_CACHE });
		}

		const rooms = await getChatRooms(auth.user.id, auth.user.permission.admin);
		return NextResponse.json({ ok: true, rooms }, { headers: NO_CACHE });
	} catch (err) {
		console.error('[Chat rooms error]:', err);
		return NextResponse.json({ error: 'Sohbet verileri yüklenemedi.' }, { status: 500, headers: NO_CACHE });
	}
}

async function handlePOST(request: Request) {
	const auth = await requireApp(request, 'chat', 'kullan');
	if (!auth.authorized) return auth.response;

	try {
		const body = await request.json();
		const { action, odaId, teamId, takimAd, targetUserId, memberIds, title } = body;

		if (action === 'read' && odaId) {
			const hasAccess = await canUserAccessChatRoom(String(odaId), auth.user.id, auth.user.permission.admin);
			if (!hasAccess) {
				return NextResponse.json({ error: 'Bu odaya erişim yetkiniz yok.' }, { status: 403, headers: NO_CACHE });
			}
			await markRoomAsRead(String(odaId), auth.user.id);
			return NextResponse.json({ ok: true }, { headers: NO_CACHE });
		}

		if (action === 'ensure_team' && teamId && takimAd) {
			const roomId = await ensureTeamChatRoom(teamId, takimAd);
			return NextResponse.json({ ok: true, roomId }, { headers: NO_CACHE });
		}

		if (action === 'create_dm' && targetUserId) {
			const result = await getOrCreateDmRoom(auth.user.id, targetUserId);
			return NextResponse.json({ ok: true, ...result }, { headers: NO_CACHE });
		}

		if (action === 'create_group_dm' && Array.isArray(memberIds)) {
			const result = await createGroupDm(
				{ id: auth.user.id, ad: auth.user.ad, soyad: auth.user.soyad },
				memberIds,
				title
			);
			return NextResponse.json({ ok: true, ...result }, { headers: NO_CACHE });
		}

		if (action === 'add_members' && odaId && Array.isArray(memberIds)) {
			const hasAccess = await canUserAccessChatRoom(String(odaId), auth.user.id, auth.user.permission.admin);
			if (!hasAccess) {
				return NextResponse.json({ error: 'Bu odaya üye ekleme yetkiniz yok.' }, { status: 403, headers: NO_CACHE });
			}
			const result = await addMembersToRoom(
				String(odaId),
				{ id: auth.user.id, ad: auth.user.ad, soyad: auth.user.soyad },
				memberIds
			);
			return NextResponse.json({ ok: true, ...result }, { headers: NO_CACHE });
		}

		return NextResponse.json({ error: 'Geçersiz işlem.' }, { status: 400, headers: NO_CACHE });
	} catch (err) {
		console.error('[Chat rooms POST error]:', err);
		return NextResponse.json({ error: 'İşlem gerçekleştirilemedi.' }, { status: 500, headers: NO_CACHE });
	}
}

export const POST = withAudit(handlePOST, { action: 'chat.rooms.create', target: 'chat.rooms' });
