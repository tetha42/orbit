/**
 * Team vocabulary and input rules, shared by the API and the Teams app.
 *
 * Kept free of imports so `scripts/check-pure.mjs` can load it directly.
 */

/** The categories a team can be filed under; the seed data and the form use the same list. */
export const TAKIM_KATEGORILERI = [
	'Havacılık & İHA',
	'Yapay Zeka',
	'Web & Mobil',
	'Siber Güvenlik',
	'Robotik & Gömülü',
	'Ar-Ge & Diğer',
] as const;
export type TakimKategorisi = (typeof TAKIM_KATEGORILERI)[number];

/** `acik`: joining is immediate. `onayli`: joining is an application the captain approves. */
export const KATILIM_TURLERI = ['acik', 'onayli'] as const;
export type KatilimTuru = (typeof KATILIM_TURLERI)[number];

/** `askida` (paused) and `tamamlandi` (finished) teams take no new members. */
export const TAKIM_DURUMLARI = ['aktif', 'askida', 'tamamlandi'] as const;
export type TakimDurumu = (typeof TAKIM_DURUMLARI)[number];

/** How many teams a member may be active in at once. */
export const TAKIM_SINIRI = 3;
export const KONTENJAN_MIN = 1;
export const KONTENJAN_MAX = 30;
export const TAKIM_ADI_MAX = 90;
export const TAKIM_ACIKLAMA_MAX = 1200;
export const ROL_MAX = 40;
export const BASVURU_NOTU_MAX = 500;
export const KAPTAN_ROLU = 'Takım Kaptanı';
/** Applications a member may have waiting at once; keeps captains' queues from being flooded. */
export const BEKLEYEN_BASVURU_MAX = 5;
/** Skills offered as one-tap chips in the onboarding application; anything else is typed into the note. */
export const UZMANLIK_ONERILERI = ['C++', 'Python', 'ROS2', 'PCB Tasarımı', '3D Modelleme', 'Flutter', 'React / Next.js', 'Gömülü Sistemler', 'Makine Öğrenmesi', 'Siber Güvenlik'] as const;
export const UZMANLIK_MAX_ADET = 8;
export const UZMANLIK_MAX_UZUNLUK = 30;

export const isKategori = (v: unknown): v is TakimKategorisi =>
	typeof v === 'string' && (TAKIM_KATEGORILERI as readonly string[]).includes(v);
export const isKatilimTuru = (v: unknown): v is KatilimTuru =>
	typeof v === 'string' && (KATILIM_TURLERI as readonly string[]).includes(v);
export const isTakimDurumu = (v: unknown): v is TakimDurumu =>
	typeof v === 'string' && (TAKIM_DURUMLARI as readonly string[]).includes(v);

/** A role title as members type it: trimmed, inner whitespace collapsed, capped. Empty → null. */
export function normalizeRol(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const role = value.trim().replace(/\s+/g, ' ').slice(0, ROL_MAX);
	return role || null;
}

/** A quota the team can live with: within bounds and not below the members it already has. */
export function kontenjanHatasi(kontenjan: unknown, aktifUye: number): string | null {
	const n = Number(kontenjan);
	if (!Number.isInteger(n) || n < KONTENJAN_MIN || n > KONTENJAN_MAX) {
		return `Kontenjan ${KONTENJAN_MIN} ile ${KONTENJAN_MAX} arasında olmalıdır.`;
	}
	if (n < aktifUye) return `Takımda ${aktifUye} aktif üye var; kontenjan bundan az olamaz.`;
	return null;
}

/**
 * The note stored with an application: the skills the applicant ticked on a first
 * line, then their free text, capped at `BASVURU_NOTU_MAX`. Skills are trimmed,
 * de-duplicated (case-insensitively), and anything that is not text is dropped.
 */
export function basvuruNotuOlustur(uzmanliklar: unknown, not: unknown): string | null {
	const seen = new Set<string>();
	const skills: string[] = [];
	for (const raw of Array.isArray(uzmanliklar) ? uzmanliklar : []) {
		if (typeof raw !== 'string') continue;
		const skill = raw.trim().replace(/\s+/g, ' ').slice(0, UZMANLIK_MAX_UZUNLUK);
		const key = skill.toLocaleLowerCase('tr');
		if (!skill || seen.has(key)) continue;
		seen.add(key);
		skills.push(skill);
		if (skills.length >= UZMANLIK_MAX_ADET) break;
	}
	const text = typeof not === 'string' ? not.trim() : '';
	const note = [skills.length ? `Uzmanlık: ${skills.join(', ')}` : '', text].filter(Boolean).join('\n');
	return note ? note.slice(0, BASVURU_NOTU_MAX) : null;
}
