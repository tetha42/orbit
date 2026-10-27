/**
 * What the phone cockpit picks out of the lists the apps already load — the tasks
 * on the member and the next event. Pure and import-free so `scripts/check-pure.mjs`
 * can test the rules.
 */

export interface CockpitTask {
	id: string;
	teamId: string;
	baslik: string;
	status: string;
	atananUyeId: string | null;
	teslimTarihi: number | null;
}

export interface CockpitEvent {
	id: string;
	status: string;
	baslangic: number;
	endTime: number;
}

/**
 * Open tasks assigned to `userId` across the given teams: earliest deadline first,
 * tasks without a deadline last (in board order).
 */
export function myOpenTasks<T extends CockpitTask>(teams: { ad: string; gorevler: T[] }[], userId: string): (T & { takimAdi: string })[] {
	const mine: (T & { takimAdi: string })[] = [];
	for (const team of teams) {
		for (const task of team.gorevler) {
			if (task.atananUyeId === userId && task.status !== 'tamamlandi') mine.push({ ...task, takimAdi: team.ad });
		}
	}
	return mine
		.map((task, index) => ({ task, index }))
		.sort((a, b) => (a.task.teslimTarihi ?? Infinity) - (b.task.teslimTarihi ?? Infinity) || a.index - b.index)
		.map(({ task }) => task);
}

/**
 * The event to show first: one that is on right now, else the soonest one still to
 * come. Drafts and events that have ended never qualify.
 */
export function nextEvent<T extends CockpitEvent>(events: T[], now: number): T | null {
	const candidates = events.filter((e) => e.status === 'yayinda' && e.endTime >= now);
	const live = candidates.filter((e) => e.baslangic <= now).sort((a, b) => a.endTime - b.endTime);
	if (live.length) return live[0];
	return candidates.sort((a, b) => a.baslangic - b.baslangic)[0] ?? null;
}
