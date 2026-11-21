import { NextResponse } from 'next/server';
import { deleteUser, getMemberRoster, getUserById } from '@/db';
import { auditContext } from '@/db/audit';
import { countActiveAdmins } from '@/db/roles';
import { can, requireApp } from '@/lib/auth/access';
import { ADMIN_ROLE_ID } from '@/core/permissions';
import { roleLimitProblem } from '@/server/members/access';
import membersContract from '@/apps/members/members.contract.json';
import { contractErrorResponse } from '@/contracts/helpers';
import {
	badMember,
	createMemberHandler,
	readOnlyAlumni,
	updateMemberHandler,
} from './handlers';

export async function GET(request: Request) {
	const auth = await requireApp(request, 'members', 'use');
	if (!auth.authorized) return auth.response;
	try {
		const isManager = can(auth.user, 'members', 'manage');
		const url = new URL(request.url);
		const pageParam = url.searchParams.get('page');
		const limitParam = url.searchParams.get('limit');
		const qParam = url.searchParams.get('q') || url.searchParams.get('search') || undefined;

		const isPaginated = pageParam !== null || limitParam !== null;

		if (isPaginated) {
			const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
			const limit = Math.max(1, Math.min(200, parseInt(limitParam || '20', 10) || 20));
			const result = await getMemberRoster({ isManager, page, limit, search: qParam });
			const members = isManager
				? result.members
				: result.members.filter((m) => m.status === 'active' || m.status === 'alumni');
			return NextResponse.json({
				success: true,
				members,
				count: members.length,
				totalCount: result.totalCount,
				page: result.page,
				limit: result.limit,
				totalPages: Math.ceil(result.totalCount / result.limit),
				...(members.length === 0 ? { message: 'No registered members found yet.' } : {}),
			});
		}

		const rows = await getMemberRoster({ isManager, search: qParam });
		// Applications and rejected accounts are for those who manage members.
		const members = isManager
			? rows
			: rows.filter((m) => m.status === 'active' || m.status === 'alumni');
		return NextResponse.json({
			success: true,
			members,
			count: members.length,
			...(members.length === 0 ? { message: 'No registered members found yet.' } : {}),
		});
	} catch (error) {
		console.error('API /api/members GET error:', error);
		return NextResponse.json({
			success: true,
			members: [],
			count: 0,
			message: 'No registered members found yet.',
		});
	}
}

export async function POST(request: Request) {
	const auth = await requireApp(request, 'members', 'manage');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'alumni') return readOnlyAlumni();
	try {
		return await createMemberHandler(request, auth.user, auditContext(request, auth.user));
	} catch (error) {
		console.error('API /api/members POST error:', error);
		return badMember('Operation could not be completed.', 500);
	}
}

export async function PATCH(request: Request) {
	const auth = await requireApp(request, 'members', 'manage');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'alumni') return readOnlyAlumni();
	try {
		return await updateMemberHandler(request, auth.user, auditContext(request, auth.user));
	} catch (error) {
		console.error('API /api/members PATCH error:', error);
		return badMember('Operation could not be completed.', 500);
	}
}

export async function DELETE(request: Request) {
	const auth = await requireApp(request, 'members', 'manage');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'alumni') return readOnlyAlumni();
	try {
		const id = new URL(request.url).searchParams.get('id');
		if (!id) return badMember('User ID is required.');
		if (id === auth.user.id) return badMember('You cannot delete yourself.');
		const target = await getUserById(id);
		if (!target) return contractErrorResponse(membersContract, 'MEMBER_NOT_FOUND');
		if (await roleLimitProblem(auth.user, target.roleId)) {
			return badMember('You cannot delete a member with higher authority than yourself.', 403);
		}
		if (target.roleId === ADMIN_ROLE_ID && (await countActiveAdmins()) <= 1) {
			return badMember('The last active admin cannot be deleted.', 409);
		}
		if (!(await deleteUser(id, auditContext(request, auth.user)))) {
			return contractErrorResponse(membersContract, 'MEMBER_NOT_FOUND', 'Member not found or could not be deleted.', undefined, 400);
		}
		return NextResponse.json({ success: true, message: 'Member record deleted.' });
	} catch (error) {
		console.error('API /api/members DELETE error:', error);
		return badMember('Operation could not be completed.', 500);
	}
}
