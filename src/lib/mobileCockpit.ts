/**
 * What the phone cockpit picks out of the lists the apps already load — the tasks
 * on the member and the next event. Pure and import-free so `scripts/check-pure.mjs`
 * can test the rules.
 */

export interface CockpitTask {
	id: string;
	teamId: string;
	title: string;
	status: string;
	assigneeMemberId: string | null;
	dueDate: number | null;
}

export interface CockpitEvent {
	id: string;
	status: string;
	start: number;
	endTime: number;
}

/**
 * Open tasks assigned to `userId` across the given teams: earliest deadline first,
 * tasks without a deadline last (in board order).
 */
export function myOpenTasks<T extends CockpitTask>(teams: { name: string; tasks: T[] }[], userId: string): (T & { teamName: string })[] {
	const mine: (T & { teamName: string })[] = [];
	for (const team of teams) {
		for (const task of team.tasks) {
			if (task.assigneeMemberId === userId && task.status !== 'done') mine.push({ ...task, teamName: team.name });
		}
	}
	return mine
		.map((task, index) => ({ task, index }))
		.sort((a, b) => (a.task.dueDate ?? Infinity) - (b.task.dueDate ?? Infinity) || a.index - b.index)
		.map(({ task }) => task);
}

/**
 * The event to show first: one that is on right now, else the soonest one still to
 * come. Drafts and events that have ended never qualify.
 */
export function nextEvent<T extends CockpitEvent>(events: T[], now: number): T | null {
	const candidates = events.filter((e) => e.status === 'published' && e.endTime >= now);
	const live = candidates.filter((e) => e.start <= now).sort((a, b) => a.endTime - b.endTime);
	if (live.length) return live[0];
	return candidates.sort((a, b) => a.start - b.start)[0] ?? null;
}
