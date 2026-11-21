import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { getTeams, getTeamMembers, getTeamTasks } from '@/db';
import { can, requireApp } from '@/lib/auth/access';
import teamsContract from '@/apps/teams/teams.contract.json';
import { contractErrorResponse } from '@/contracts/helpers';
import { handleTeamMemberOrSettings } from './memberActions';
import { handleTeamTaskOrAdmin } from './taskActions';

export async function GET(request: Request) {
	// Team composition and task lists are internal to the club.
	const auth = await requireApp(request, 'teams', 'use');
	if (!auth.authorized) return auth.response;

	try {
		const { searchParams } = new URL(request.url);
		const teamId = searchParams.get('teamId');

		const teams = await getTeams();

		const enrichedTeams = await Promise.all(
			teams.map(async (team) => {
				const all = await getTeamMembers(team.id);
				const active = all.filter((u) => u.status === 'active');
				const manage = can(auth.user, 'teams', 'manage') || team.leadId === auth.user.id;
				const canSeeTasks = manage || active.some((u) => u.userId === auth.user.id);
				const tasks = canSeeTasks ? await getTeamTasks(team.id) : [];
				const my = all.find((u) => u.userId === auth.user.id);
				return {
					...team,
					participationType: team.participationType ?? 'open',
					members: active,
					applications: manage ? all.filter((u) => u.status === 'applied') : [],
					myStatus: my?.status ?? null,
					permissions: { manage, editAll: can(auth.user, 'teams', 'manage') },
					tasks,
					fullCapacity: active.length,
					remainingCapacity: Math.max(0, team.capacity - active.length),
					occupancyRatio: Math.min(100, Math.round((active.length / team.capacity) * 100)),
				};
			})
		);

		if (teamId) {
			const found = enrichedTeams.find((t) => t.id === teamId || t.slug === teamId);
			if (!found) return contractErrorResponse(teamsContract, 'TEAM_NOT_FOUND', 'Team not found.');
			return NextResponse.json(found);
		}

		return NextResponse.json(enrichedTeams);
	} catch (error) {
		console.error('API /api/teams GET error:', error);
		return NextResponse.json({ error: 'Failed to load teams.' }, { status: 500 });
	}
}

async function handlePOST(request: Request) {
	const auth = await requireApp(request, 'teams', 'use');
	if (!auth.authorized) return auth.response;

	try {
		const body = (await request.json()) as Record<string, unknown>;
		const action = String(body.action ?? '');
		const teamId = typeof body.teamId === 'string' ? body.teamId : '';

		const memberResult = await handleTeamMemberOrSettings(action, teamId, body, auth.user);
		if (memberResult) return memberResult;

		return handleTeamTaskOrAdmin(action, body, auth.user);
	} catch (error) {
		console.error('API /api/teams POST error:', error);
		return NextResponse.json({ error: 'Operation failed.' }, { status: 500 });
	}
}

export const POST = withAudit(handlePOST, { action: 'teams.create', target: 'teams' });
