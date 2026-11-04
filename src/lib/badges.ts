/**
 * Badges, earned from what a member has actually done. Pure, so the rules are
 * tested in `scripts/check-pure.mjs` and the app only draws them.
 */

export interface BadgeInput {
	xp: number;
	team: number;
	captain: boolean;
	attendedEvent: number;
	completedTask: number;
	certificate: number;
	project: number;
}

export interface Badge {
	id: string;
	/** Translation keys for the name and the "how to earn it" line. */
	name: string;
	description: string;
	color: string;
	icon: 'rocket' | 'users' | 'crown' | 'calendar' | 'check' | 'award' | 'folder' | 'star';
	target: number;
	value: number;
	earned: boolean;
}

type Definition = Omit<Badge, 'value' | 'earned'> & { measure: (g: BadgeInput) => number };

const DEFINITIONS: Definition[] = [
	{ id: 'first-step', name: 'bdgFirstStep', description: 'bdgFirstStepHow', color: '#0a84ff', icon: 'rocket', target: 1, measure: (g) => g.attendedEvent },
	{ id: 'regular', name: 'bdgRegular', description: 'bdgRegularHow', color: '#30d158', icon: 'calendar', target: 5, measure: (g) => g.attendedEvent },
	{ id: 'team-player', name: 'bdgTeamPlayer', description: 'bdgTeamPlayerHow', color: '#5e5ce6', icon: 'users', target: 1, measure: (g) => g.team },
	{ id: 'captain', name: 'bdgCaptain', description: 'bdgCaptainHow', color: '#ff9f0a', icon: 'crown', target: 1, measure: (g) => (g.captain ? 1 : 0) },
	{ id: 'task-hunter', name: 'bdgTaskHunter', description: 'bdgTaskHunterHow', color: '#bf5af2', icon: 'check', target: 10, measure: (g) => g.completedTask },
	{ id: 'certified', name: 'bdgCertified', description: 'bdgCertifiedHow', color: '#ff375f', icon: 'award', target: 1, measure: (g) => g.certificate },
	{ id: 'maker', name: 'bdgMaker', description: 'bdgMakerHow', color: '#64d2ff', icon: 'folder', target: 1, measure: (g) => g.project },
	{ id: 'star', name: 'bdgStar', description: 'bdgStarHow', color: '#ffd60a', icon: 'star', target: 1000, measure: (g) => g.xp },
];

/** Every badge with progress; earned ones first, then the closest to being earned. */
export function computeBadges(g: BadgeInput): Badge[] {
	return DEFINITIONS.map(({ measure, ...t }) => {
		const value = Math.max(0, Math.floor(measure(g)));
		return { ...t, value: Math.min(value, t.target), earned: value >= t.target };
	}).sort((a, b) => Number(b.earned) - Number(a.earned) || b.value / b.target - a.value / a.target);
}
export const badges = computeBadges;
