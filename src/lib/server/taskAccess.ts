import { NextResponse } from 'next/server';
import { getTeamById, getTeamTaskById, getTeamMembers } from '@/db';
import type { Team, TeamTask, TeamMember } from '@/db/schema';
import { can, type YetkiliKullanici } from '@/lib/auth/access';

/**
 * What the caller may do with one team's task board. Decided from stored rows
 * only — never from ids in the request body.
 *
 *  - `view`:   Teams managers, the captain and the team's active members.
 *  - `manage`: Teams managers and the captain (create, edit any field, delete).
 */
export interface TeamBoardAccess {
	team: Team;
	uyeler: TeamMember[];
	view: boolean;
	manage: boolean;
}

export async function getBoardAccess(user: YetkiliKullanici, teamId: string): Promise<TeamBoardAccess | null> {
	const team = await getTeamById(teamId);
	if (!team) return null;
	const uyeler = await getTeamMembers(teamId);
	const manage = can(user, 'teams', 'yonet') || team.liderId === user.id;
	const member = uyeler.some((u) => u.userId === user.id && u.status === 'aktif');
	return { team, uyeler, view: manage || member, manage };
}

/** `work`: whoever may move the card and tick its checklist — `manage`, or the assignee. */
export interface TaskAccess extends TeamBoardAccess {
	task: TeamTask;
	work: boolean;
}

export async function getTaskAccess(user: YetkiliKullanici, gorevId: string): Promise<TaskAccess | null> {
	const task = await getTeamTaskById(gorevId);
	if (!task) return null;
	const board = await getBoardAccess(user, task.teamId);
	if (!board) return null;
	return { ...board, task, work: board.manage || task.atananUyeId === user.id };
}

/** A task can only be assigned to someone on the team (or its captain). */
export function isAssignable(board: TeamBoardAccess, userId: string): boolean {
	return (
		board.team.liderId === userId ||
		board.uyeler.some((u) => u.userId === userId && u.status === 'aktif')
	);
}

export const notFound = () => NextResponse.json({ error: 'Görev bulunamadı.' }, { status: 404 });
export const forbidden = (error: string) => NextResponse.json({ error }, { status: 403 });
export const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 });
