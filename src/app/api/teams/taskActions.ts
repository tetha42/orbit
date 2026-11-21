import { NextResponse } from 'next/server';
import {
	getTeamCategories,
	getTeamTasks,
	createTeamTask,
	updateTeamTaskStatus,
	createTeam,
	deleteTeam,
	deleteTeamTask,
	getPgPool,
} from '@/db';
import { publishEventQuiet } from '@/db/events';
import { isParticipationType, capacityProblem } from '@/lib/teams';
import { normalizeHttpUrl } from '@/lib/projects';
import { can } from '@/lib/auth/access';
import {
	DESCRIPTION_MAX,
	TITLE_MAX,
	TASK_STATUSES,
	RANKING_MAX,
	normalizeStatus,
	normalizeTags,
	normalizePriority,
	normalizeDueDate,
} from '@/lib/kanban';
import { getBoardAccess, getTaskAccess, isAssignable } from '@/server/taskAccess';
import teamsContract from '@/apps/teams/teams.contract.json';
import { contractErrorResponse } from '@/contracts/helpers';
import type { TeamsAuthUser } from './memberActions';

const MAX_TEAM_CAPACITY = teamsContract.limits.maxTeamCapacity;
const MAX_TASKS_PER_TEAM = teamsContract.limits.maxTasksPerTeam;

export async function handleTeamTaskOrAdmin(
	action: string,
	body: Record<string, unknown>,
	user: TeamsAuthUser
): Promise<NextResponse> {
	const taskWrite = ['addTask', 'updateTask', 'moveTask', 'deleteTask'].includes(action);
	if (taskWrite && user.status === 'alumni') {
		return NextResponse.json({ error: 'Alumni members have read-only access.' }, { status: 403 });
	}

	if (action === 'addTask') {
		const { teamId, title: rawTitle, description, priority: rawPriority, assigneeMemberId, dueDate, tags, status } = body;
		const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
		if (!teamId || typeof teamId !== 'string' || !title) {
			return NextResponse.json({ error: 'Team ID and Title are required.' }, { status: 400 });
		}
		if (title.length > TITLE_MAX) {
			return NextResponse.json({ error: `Title can be at most ${TITLE_MAX} characters.` }, { status: 400 });
		}
		if (typeof description === 'string' && description.length > DESCRIPTION_MAX) {
			return NextResponse.json({ error: `Description can be at most ${DESCRIPTION_MAX} characters.` }, { status: 400 });
		}
		const board = await getBoardAccess(user, teamId);
		if (!board) {
			return contractErrorResponse(teamsContract, 'TEAM_NOT_FOUND', 'Team not found.');
		}
		if (!board.manage) {
			return NextResponse.json(
				{ error: 'Community management or team captain permission is required for this action.' },
				{ status: 403 }
			);
		}
		const existingTasks = await getTeamTasks(teamId);
		if (existingTasks.length >= MAX_TASKS_PER_TEAM) {
			return NextResponse.json(
				{ error: `A team cannot exceed ${MAX_TASKS_PER_TEAM} tasks.` },
				{ status: 400 }
			);
		}
		const priority = rawPriority === undefined ? 'medium' : normalizePriority(rawPriority);
		if (!priority) {
			return NextResponse.json({ error: 'Invalid priority.' }, { status: 400 });
		}
		const column = status === undefined ? 'todo' : normalizeStatus(status);
		if (!column) {
			return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
		}
		const due = dueDate === undefined ? null : normalizeDueDate(dueDate);
		if (due === undefined) {
			return NextResponse.json({ error: 'Invalid due date.' }, { status: 400 });
		}
		const labels = tags === undefined ? [] : normalizeTags(tags);
		if (!labels) {
			return NextResponse.json({ error: 'Tags must be a list of strings.' }, { status: 400 });
		}
		const assignee = typeof assigneeMemberId === 'string' && assigneeMemberId ? assigneeMemberId : undefined;
		if (assignee && !isAssignable(board, assignee)) {
			return NextResponse.json({ error: 'Tasks can only be assigned to team members.' }, { status: 400 });
		}
		const task = await createTeamTask({
			teamId,
			title,
			description: typeof description === 'string' ? description : '',
			priority,
			assigneeMemberId: assignee,
			dueDate: due ?? undefined,
			tags: labels,
			status: column,
			creatorId: user.id,
		});
		await publishEventQuiet(getPgPool(), { k: 'team_updated', teamId });
		return NextResponse.json({ success: true, task });
	}

	if (action === 'updateTask' || action === 'moveTask') {
		const { taskId, status, order, sort } = body;
		if (!taskId || typeof taskId !== 'string') {
			return NextResponse.json({ error: 'Task ID is required.' }, { status: 400 });
		}
		const normalized = normalizeStatus(status);
		if (!normalized) {
			return NextResponse.json(
				{ error: `Invalid status. Expected: ${TASK_STATUSES.join(', ')}` },
				{ status: 400 }
			);
		}
		if (order !== undefined && (typeof order !== 'number' || !Number.isFinite(order))) {
			return NextResponse.json({ error: 'Invalid order.' }, { status: 400 });
		}
		if (
			sort !== undefined &&
			(!Array.isArray(sort) || sort.length > RANKING_MAX || !sort.every((id: unknown) => typeof id === 'string'))
		) {
			return NextResponse.json({ error: 'Invalid ordering.' }, { status: 400 });
		}
		const access = await getTaskAccess(user, taskId);
		if (!access) {
			return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
		}
		if (!access.work) {
			return NextResponse.json(
				{ error: 'Only management, the team captain, or the assignee can change the status of this task.' },
				{ status: 403 }
			);
		}
		const result = await updateTeamTaskStatus({
			taskId,
			status: normalized,
			order,
			sort,
			actorId: user.id,
		});
		await publishEventQuiet(getPgPool(), { k: 'team_updated', teamId: access.task.teamId });
		return NextResponse.json({ success: true, status: normalized, xpGiven: result.xpGiven });
	}

	if (action === 'createTeam') {
		if (!can(user, 'teams', 'manage')) {
			return NextResponse.json({ error: 'Only the board may create teams.' }, { status: 403 });
		}
		const { name, category, description, capacity, repoUrl, leadId, participationType } = body;
		if (!name || !category || !description) {
			return NextResponse.json({ error: 'Team name, category and description are required.' }, { status: 400 });
		}
		const categories = await getTeamCategories();
		if (typeof category !== 'string' || !categories.includes(category)) {
			return NextResponse.json({ error: 'Invalid category.' }, { status: 400 });
		}
		const quotaError = capacityProblem(capacity ?? 6, 0);
		if (quotaError) return NextResponse.json({ error: quotaError }, { status: 400 });
		if (Number(capacity ?? 6) > MAX_TEAM_CAPACITY) {
			return NextResponse.json({ error: `Team capacity cannot exceed ${MAX_TEAM_CAPACITY}.` }, { status: 400 });
		}
		const repo = normalizeHttpUrl(typeof repoUrl === 'string' ? repoUrl : undefined);
		if (repo === undefined) return NextResponse.json({ error: 'Enter a valid repository URL (https://...).' }, { status: 400 });
		const newTeam = await createTeam({
			name: String(name),
			category,
			description: String(description),
			capacity: Number(capacity ?? 6),
			repoUrl: repo ?? undefined,
			leadId: typeof leadId === 'string' ? leadId : undefined,
			participationType: isParticipationType(participationType) ? participationType : 'open',
		});
		await publishEventQuiet(getPgPool(), { k: 'team_updated', teamId: newTeam.id });
		return NextResponse.json({ success: true, team: newTeam });
	}

	if (action === 'deleteTeam') {
		if (!can(user, 'teams', 'manage')) {
			return NextResponse.json({ error: 'Only the board may delete teams.' }, { status: 403 });
		}
		const { teamId } = body;
		if (!teamId || typeof teamId !== 'string') {
			return NextResponse.json({ error: 'Team ID is required.' }, { status: 400 });
		}
		let deleted: boolean;
		try {
			deleted = await deleteTeam(teamId);
		} catch (err) {
			if ((err as { code?: string })?.code === '23503') {
				return NextResponse.json(
					{ error: 'This team has ledger records. Delete the ledger records first.' },
					{ status: 409 }
				);
			}
			throw err;
		}
		if (!deleted) {
			return contractErrorResponse(teamsContract, 'TEAM_NOT_FOUND', 'Team not found or could not be deleted.');
		}
		await publishEventQuiet(getPgPool(), { k: 'team_updated', teamId });
		return NextResponse.json({ success: true, message: 'Team deleted.' });
	}

	if (action === 'deleteTask') {
		const { taskId } = body;
		if (!taskId || typeof taskId !== 'string') {
			return NextResponse.json({ error: 'Task ID is required.' }, { status: 400 });
		}
		const access = await getTaskAccess(user, taskId);
		if (!access) {
			return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
		}
		if (!access.manage) {
			return NextResponse.json(
				{ error: 'You must be community management or team captain to delete a task.' },
				{ status: 403 }
			);
		}
		const deleted = await deleteTeamTask(taskId);
		if (deleted) await publishEventQuiet(getPgPool(), { k: 'team_updated', teamId: access.task.teamId });
		return NextResponse.json({ success: true, deleted });
	}

	return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
}
