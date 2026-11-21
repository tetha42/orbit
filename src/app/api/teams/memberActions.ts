import { NextResponse } from 'next/server';
import {
	getTeamCategories,
	joinTeam,
	leaveTeam,
	decideTeamApplication,
	getUserById,
	setTeamMemberRole,
	updateTeam,
	getPgPool,
	type TeamPatch,
} from '@/db';
import { notificationEvents, publishEventQuiet } from '@/db/events';
import {
	APPLICATION_NOTE_MAX,
	CAPTAIN_ROLE,
	TEAM_DESCRIPTION_MAX,
	TEAM_NAME_MAX,
	isParticipationType,
	isTeamStatus,
	capacityProblem,
	normalizeRole,
} from '@/lib/teams';
import { normalizeHttpUrl } from '@/lib/projects';
import { can, type requireApp } from '@/lib/auth/access';
import { getBoardAccess } from '@/server/taskAccess';
import teamsContract from '@/apps/teams/teams.contract.json';
import { contractErrorResponse } from '@/contracts/helpers';

export type TeamsAuthUser = Extract<Awaited<ReturnType<typeof requireApp>>, { authorized: true }>['user'];

const MAX_TEAM_CAPACITY = teamsContract.limits.maxTeamCapacity;

export async function handleTeamMemberOrSettings(
	action: string,
	teamId: string,
	body: Record<string, unknown>,
	user: TeamsAuthUser
): Promise<NextResponse | null> {
	const graduate = user.status === 'alumni';

	if (action === 'join') {
		if (graduate) return NextResponse.json({ error: 'Alumni members have read-only access.' }, { status: 403 });
		if (!teamId) return NextResponse.json({ error: 'Missing parameters.' }, { status: 400 });
		const note = typeof body.applicationNote === 'string' ? body.applicationNote.trim().slice(0, APPLICATION_NOTE_MAX) : null;
		const result = await joinTeam({ teamId, userId: user.id, applicationNote: note });
		if (result.ok) {
			await publishEventQuiet(getPgPool(), { k: 'team_updated', teamId });
			return NextResponse.json({ success: true, status: result.status, message: result.message });
		}
		if (result.status === 409 && /already|zaten/i.test(result.message ?? '')) {
			return contractErrorResponse(teamsContract, 'ALREADY_MEMBER', result.message);
		}
		return NextResponse.json({ error: result.message }, { status: typeof result.status === 'number' ? result.status : 400 });
	}

	if (action === 'leave') {
		if (!teamId) return NextResponse.json({ error: 'Missing parameters.' }, { status: 400 });
		const result = await leaveTeam({ teamId, userId: user.id });
		if (result.success) await publishEventQuiet(getPgPool(), { k: 'team_updated', teamId });
		return result.success
			? NextResponse.json({ success: true, message: result.message })
			: NextResponse.json({ error: result.message }, { status: result.status ?? 400 });
	}

	if (!['approve', 'reject', 'setMemberRole', 'removeMember', 'addMember', 'updateTeam'].includes(action)) {
		return null;
	}

	if (graduate) return NextResponse.json({ error: 'Alumni members have read-only access.' }, { status: 403 });
	const board = teamId ? await getBoardAccess(user, teamId) : null;
	if (!board) return contractErrorResponse(teamsContract, 'TEAM_NOT_FOUND', 'Team not found.');
	if (!board.manage) {
		return NextResponse.json({ error: 'This action is restricted to the team captain or management.' }, { status: 403 });
	}
	const userId: string = typeof body.userId === 'string' ? body.userId : '';

	if (action === 'approve' || action === 'reject') {
		if (!userId) return NextResponse.json({ error: 'Member not specified.' }, { status: 400 });
		const r = await decideTeamApplication({ teamId, userId, accept: action === 'approve' });
		if (r.success) await publishEventQuiet(getPgPool(), [{ k: 'team_updated', teamId }, ...notificationEvents([userId])]);
		return r.success
			? NextResponse.json({ success: true, message: r.message })
			: NextResponse.json({ error: r.message }, { status: r.status ?? 400 });
	}

	if (action === 'setMemberRole') {
		const role = normalizeRole(body.teamRole);
		if (!role) return NextResponse.json({ error: 'Role cannot be empty.' }, { status: 400 });
		if (userId === board.team.leadId && role !== CAPTAIN_ROLE) {
			return NextResponse.json({ error: 'Captain title can only be changed by transferring captaincy.' }, { status: 409 });
		}
		const ok = await setTeamMemberRole(teamId, userId, role);
		if (ok) await publishEventQuiet(getPgPool(), { k: 'team_updated', teamId });
		return ok
			? NextResponse.json({ success: true, message: 'Role updated.' })
			: NextResponse.json({ error: 'Active member not found.' }, { status: 404 });
	}

	if (action === 'removeMember') {
		if (!userId) return NextResponse.json({ error: 'Member not specified.' }, { status: 400 });
		const r = await leaveTeam({ teamId, userId, actorId: user.id });
		if (r.success) await publishEventQuiet(getPgPool(), { k: 'team_updated', teamId });
		return r.success
			? NextResponse.json({ success: true, message: 'Member removed from team.' })
			: NextResponse.json({ error: r.message }, { status: r.status ?? 400 });
	}

	if (action === 'addMember') {
		if (!can(user, 'teams', 'manage')) {
			return NextResponse.json({ error: 'Adding members is restricted to management.' }, { status: 403 });
		}
		if (!userId) return NextResponse.json({ error: 'Member not specified.' }, { status: 400 });
		const r = await joinTeam({ teamId, userId, direct: true, teamRole: normalizeRole(body.teamRole) ?? undefined });
		if (r.ok) {
			await publishEventQuiet(getPgPool(), { k: 'team_updated', teamId });
			return NextResponse.json({ success: true, message: 'Member added to team.' });
		}
		if (r.status === 409 && /already|zaten/i.test(r.message ?? '')) {
			return contractErrorResponse(teamsContract, 'ALREADY_MEMBER', r.message);
		}
		return NextResponse.json({ error: r.message }, { status: typeof r.status === 'number' ? r.status : 400 });
	}

	// action === 'updateTeam'
	const editAll = can(user, 'teams', 'manage');
	const patch: TeamPatch = {};
	const restricted = ['name', 'category', 'status', 'leadId'].filter((k) => body[k] !== undefined);
	if (restricted.length && !editAll) {
		return NextResponse.json({ error: 'Name, category, status and captain can only be modified by management.' }, { status: 403 });
	}
	if (body.name !== undefined) {
		const name = typeof body.name === 'string' ? body.name.trim() : '';
		if (name.length < 3 || name.length > TEAM_NAME_MAX) {
			return NextResponse.json({ error: 'Team name must be between 3 and 90 characters.' }, { status: 400 });
		}
		patch.name = name;
	}
	if (body.description !== undefined) {
		const description = typeof body.description === 'string' ? body.description.trim() : '';
		if (description.length < 10 || description.length > TEAM_DESCRIPTION_MAX) {
			return NextResponse.json({ error: 'Description must be between 10 and 1200 characters.' }, { status: 400 });
		}
		patch.description = description;
	}
	if (body.category !== undefined) {
		const categories = await getTeamCategories();
		if (typeof body.category !== 'string' || (!categories.includes(body.category) && body.category !== board.team.category)) {
			return NextResponse.json({ error: 'Invalid category.' }, { status: 400 });
		}
		patch.category = body.category;
	}
	if (body.capacity !== undefined) {
		const err = capacityProblem(body.capacity, board.members.filter((u) => u.status === 'active').length);
		if (err) return NextResponse.json({ error: err }, { status: 400 });
		if (Number(body.capacity) > MAX_TEAM_CAPACITY) {
			return NextResponse.json({ error: `Team capacity cannot exceed ${MAX_TEAM_CAPACITY}.` }, { status: 400 });
		}
		patch.capacity = Number(body.capacity);
	}
	if (body.repoUrl !== undefined) {
		const url = normalizeHttpUrl(body.repoUrl);
		if (url === undefined) return NextResponse.json({ error: 'Enter a valid repository URL (https://...).' }, { status: 400 });
		patch.repoUrl = url;
	}
	if (body.status !== undefined) {
		if (!isTeamStatus(body.status)) return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
		patch.status = body.status;
	}
	if (body.participationType !== undefined) {
		if (!isParticipationType(body.participationType)) {
			return NextResponse.json({ error: 'Invalid participation type.' }, { status: 400 });
		}
		patch.participationType = body.participationType;
	}
	if (body.leadId !== undefined) {
		const leader = typeof body.leadId === 'string' ? await getUserById(body.leadId) : null;
		if (!leader || leader.status !== 'active') {
			return NextResponse.json({ error: 'Member selected as captain not found.' }, { status: 400 });
		}
		patch.leadId = leader.id;
	}
	await updateTeam(teamId, patch);
	await publishEventQuiet(getPgPool(), { k: 'team_updated', teamId });
	return NextResponse.json({ success: true, message: 'Team updated.' });
}
