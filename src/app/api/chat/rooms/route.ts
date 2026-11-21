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
	const auth = await requireApp(request, 'chat', 'use');
	if (!auth.authorized) return auth.response;

	const { searchParams } = new URL(request.url);
	const action = searchParams.get('action');

	try {
		if (action === 'contacts') {
			const contacts = await getChatContacts(auth.user.id);
			return NextResponse.json({ ok: true, contacts }, { headers: NO_CACHE });
		}

		if (action === 'members') {
			const roomId = searchParams.get('roomId');
			if (!roomId) {
				return NextResponse.json({ error: 'Room ID is missing.' }, { status: 400, headers: NO_CACHE });
			}
			const hasAccess = await canUserAccessChatRoom(roomId, auth.user.id, auth.user.permission.admin);
			if (!hasAccess) {
				return NextResponse.json({ error: 'You do not have permission to access this room.' }, { status: 403, headers: NO_CACHE });
			}
			const members = await getRoomMembers(roomId);
			return NextResponse.json({ ok: true, members }, { headers: NO_CACHE });
		}

		const rooms = await getChatRooms(auth.user.id, auth.user.permission.admin);
		return NextResponse.json({ ok: true, rooms }, { headers: NO_CACHE });
	} catch (err) {
		console.error('[Chat rooms error]:', err);
		return NextResponse.json({ error: 'Failed to load chat data.' }, { status: 500, headers: NO_CACHE });
	}
}

async function handlePOST(request: Request) {
	const auth = await requireApp(request, 'chat', 'use');
	if (!auth.authorized) return auth.response;

	try {
		const body = await request.json();
		const { action, roomId, teamId, teamName, targetUserId, memberIds, title } = body;

		if (action === 'read' && roomId) {
			const hasAccess = await canUserAccessChatRoom(String(roomId), auth.user.id, auth.user.permission.admin);
			if (!hasAccess) {
				return NextResponse.json({ error: 'You do not have permission to access this room.' }, { status: 403, headers: NO_CACHE });
			}
			await markRoomAsRead(String(roomId), auth.user.id);
			return NextResponse.json({ ok: true }, { headers: NO_CACHE });
		}

		if (action === 'ensure_team' && teamId && teamName) {
			const roomId = await ensureTeamChatRoom(teamId, teamName);
			return NextResponse.json({ ok: true, roomId }, { headers: NO_CACHE });
		}

		if (action === 'create_dm' && targetUserId) {
			const result = await getOrCreateDmRoom(auth.user.id, targetUserId);
			return NextResponse.json({ ok: true, ...result }, { headers: NO_CACHE });
		}

		if (action === 'create_group_dm' && Array.isArray(memberIds)) {
			const result = await createGroupDm(
				{ id: auth.user.id, name: auth.user.firstName || auth.user.name || '', surname: auth.user.lastName || auth.user.surname || '' },
				memberIds,
				title
			);
			return NextResponse.json({ ok: true, ...result }, { headers: NO_CACHE });
		}

		if (action === 'add_members' && roomId && Array.isArray(memberIds)) {
			const hasAccess = await canUserAccessChatRoom(String(roomId), auth.user.id, auth.user.permission.admin);
			if (!hasAccess) {
				return NextResponse.json({ error: 'You do not have permission to add members to this room.' }, { status: 403, headers: NO_CACHE });
			}
			const result = await addMembersToRoom(
				String(roomId),
				{ id: auth.user.id, name: auth.user.firstName || auth.user.name || '', surname: auth.user.lastName || auth.user.surname || '' },
				memberIds
			);
			return NextResponse.json({ ok: true, ...result }, { headers: NO_CACHE });
		}

		return NextResponse.json({ error: 'Invalid action.' }, { status: 400, headers: NO_CACHE });
	} catch (err) {
		console.error('[Chat rooms POST error]:', err);
		return NextResponse.json({ error: 'Failed to process request.' }, { status: 500, headers: NO_CACHE });
	}
}

export const POST = withAudit(handlePOST, { action: 'chat.rooms.create', target: 'chat.rooms' });
