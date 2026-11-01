/**
 * Badges, earned from what a member has actually done. Pure, so the rules are
 * tested in `scripts/check-pure.mjs` and the app only draws them.
 */

export interface BadgeInput {
	xp: number;
	takim: number;
	kaptan: boolean;
	katilinanEtkinlik: number;
	tamamlananGorev: number;
	sertifika: number;
	proje: number;
}
export type RozetGirdisi = BadgeInput;

export interface Badge {
	id: string;
	/** Translation keys for the name and the "how to earn it" line. */
	ad: string;
	aciklama: string;
	renk: string;
	ikon: 'rocket' | 'users' | 'crown' | 'calendar' | 'check' | 'award' | 'folder' | 'star';
	hedef: number;
	deger: number;
	kazanildi: boolean;
}
export type Rozet = Badge;

type Tanim = Omit<Badge, 'deger' | 'kazanildi'> & { olc: (g: BadgeInput) => number };

const TANIMLAR: Tanim[] = [
	{ id: 'ilk-adim', ad: 'bdgFirstStep', aciklama: 'bdgFirstStepHow', renk: '#0a84ff', ikon: 'rocket', hedef: 1, olc: (g) => g.katilinanEtkinlik },
	{ id: 'mudavim', ad: 'bdgRegular', aciklama: 'bdgRegularHow', renk: '#30d158', ikon: 'calendar', hedef: 5, olc: (g) => g.katilinanEtkinlik },
	{ id: 'takim-oyuncusu', ad: 'bdgTeamPlayer', aciklama: 'bdgTeamPlayerHow', renk: '#5e5ce6', ikon: 'users', hedef: 1, olc: (g) => g.takim },
	{ id: 'kaptan', ad: 'bdgCaptain', aciklama: 'bdgCaptainHow', renk: '#ff9f0a', ikon: 'crown', hedef: 1, olc: (g) => (g.kaptan ? 1 : 0) },
	{ id: 'task-avcisi', ad: 'bdgTaskHunter', aciklama: 'bdgTaskHunterHow', renk: '#bf5af2', ikon: 'check', hedef: 10, olc: (g) => g.tamamlananGorev },
	{ id: 'belgeli', ad: 'bdgCertified', aciklama: 'bdgCertifiedHow', renk: '#ff375f', ikon: 'award', hedef: 1, olc: (g) => g.sertifika },
	{ id: 'yapimci', ad: 'bdgMaker', aciklama: 'bdgMakerHow', renk: '#64d2ff', ikon: 'folder', hedef: 1, olc: (g) => g.proje },
	{ id: 'yildiz', ad: 'bdgStar', aciklama: 'bdgStarHow', renk: '#ffd60a', ikon: 'star', hedef: 1000, olc: (g) => g.xp },
];

/** Every badge with progress; earned ones first, then the closest to being earned. */
export function computeBadges(g: BadgeInput): Badge[] {
	return TANIMLAR.map(({ olc, ...t }) => {
		const deger = Math.max(0, Math.floor(olc(g)));
		return { ...t, deger: Math.min(deger, t.hedef), kazanildi: deger >= t.hedef };
	}).sort((a, b) => Number(b.kazanildi) - Number(a.kazanildi) || b.deger / b.hedef - a.deger / a.hedef);
}
export const rozetler = computeBadges;
