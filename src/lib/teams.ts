/**
 * Team vocabulary and input rules, shared by the API and the Teams app.
 *
 * Kept free of imports so `scripts/check-pure.mjs` can load it directly.
 */

/** The categories a team can be filed under; the seed data and the form use the same list. */
export const TEAM_CATEGORIES = [
	'Aviation & UAV',
	'Artificial Intelligence',
	'Web & Mobile',
	'Cybersecurity',
	'Robotics & Embedded',
	'R&D & Other',
] as const;
export type TeamCategory = (typeof TEAM_CATEGORIES)[number];

/** `acik`: joining is immediate. `onayli`: joining is an application the captain approves. */
export const PARTICIPATION_TYPES = ['acik', 'onayli'] as const;
export type ParticipationType = (typeof PARTICIPATION_TYPES)[number];

/** `askida` (paused) and `tamamlandi` (finished) teams take no new members. */
export const TEAM_STATUSES = ['aktif', 'askida', 'tamamlandi'] as const;
export type TeamStatus = (typeof TEAM_STATUSES)[number];

/** How many teams a member may be active in at once. */
export const TEAM_LIMIT = 3;
export const CAPACITY_MIN = 1;
export const CAPACITY_MAX = 30;
export const TEAM_NAME_MAX = 90;
export const TEAM_DESCRIPTION_MAX = 1200;
export const ROLE_MAX = 40;
export const APPLICATION_NOTE_MAX = 500;
export const CAPTAIN_ROLE = 'Team Captain';
/** Applications a member may have waiting at once; keeps captains' queues from being flooded. */
export const PENDING_APPLICATION_MAX = 5;
/** Skills offered as one-tap chips in the onboarding application; anything else is typed into the note. */
export const EXPERTISE_SUGGESTIONS = ['C++', 'Python', 'ROS2', 'PCB Tasarımı', '3D Modelleme', 'Flutter', 'React / Next.js', 'Gömülü Sistemler', 'Makine Öğrenmesi', 'Siber Güvenlik'] as const;
export const EXPERTISE_MAX = 8;
export const EXPERTISE_MAX_LENGTH = 30;

export const isCategory = (v: unknown): v is TeamCategory =>
	typeof v === 'string' && (TEAM_CATEGORIES as readonly string[]).includes(v);
export const isKategori = isCategory;
export const isParticipationType = (v: unknown): v is ParticipationType =>
	typeof v === 'string' && (PARTICIPATION_TYPES as readonly string[]).includes(v);
export const isTeamStatus = (v: unknown): v is TeamStatus =>
	typeof v === 'string' && (TEAM_STATUSES as readonly string[]).includes(v);

/** A role title as members type it: trimmed, inner whitespace collapsed, capped. Empty → null. */
export function normalizeRole(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const role = value.trim().replace(/\s+/g, ' ').slice(0, ROLE_MAX);
	return role || null;
}

/** A quota the team can live with: within bounds and not below the members it already has. */
export function capacityProblem(kontenjan: unknown, aktifUye: number): string | null {
	const n = Number(kontenjan);
	if (!Number.isInteger(n) || n < CAPACITY_MIN || n > CAPACITY_MAX) {
		return `Kontenjan ${CAPACITY_MIN} ile ${CAPACITY_MAX} arasında olmalıdır.`;
	}
	if (n < aktifUye) return `Takımda ${aktifUye} aktif üye var; kontenjan bundan az olamaz.`;
	return null;
}

/**
 * The note stored with an application: the skills the applicant ticked on a first
 * line, then their free text, capped at `BASVURU_NOTU_MAX`. Skills are trimmed,
 * de-duplicated (case-insensitively), and anything that is not text is dropped.
 */
export function buildApplicationNote(uzmanliklar: unknown, not: unknown): string | null {
	const seen = new Set<string>();
	const skills: string[] = [];
	for (const raw of Array.isArray(uzmanliklar) ? uzmanliklar : []) {
		if (typeof raw !== 'string') continue;
		const skill = raw.trim().replace(/\s+/g, ' ').slice(0, EXPERTISE_MAX_LENGTH);
		const key = skill.toLocaleLowerCase('tr');
		if (!skill || seen.has(key)) continue;
		seen.add(key);
		skills.push(skill);
		if (skills.length >= EXPERTISE_MAX) break;
	}
	const text = typeof not === 'string' ? not.trim() : '';
	const note = [skills.length ? `Uzmanlık: ${skills.join(', ')}` : '', text].filter(Boolean).join('\n');
	return note ? note.slice(0, APPLICATION_NOTE_MAX) : null;
}
