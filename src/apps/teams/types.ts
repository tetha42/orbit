import type { TaskStatus, TaskPriority } from '@/lib/kanban';
export type { TaskStatus, TaskPriority };

export interface TeamMember {
	id: string;
	teamId: string;
	userId: string;
	takimRolu: string;
	status: string;
	kullaniciAdSoyad: string;
	kullaniciBolum: string;
}

export interface TeamTask {
	id: string;
	teamId: string;
	baslik: string;
	aciklama: string | null;
	status: TaskStatus;
	oncelik: TaskPriority;
	atananUyeId: string | null;
	atananAdSoyad: string | null;
	teslimTarihi: number | null;
	sira: number;
	etiketler: string[];
	olusturanId?: string | null;
	olusturanAdSoyad?: string | null;
	guncellenme?: number | null;
	tamamlanma?: number | null;
	maddeSayisi?: number;
	tamamMaddeSayisi?: number;
	yorumSayisi?: number;
	olusturma: number;
}

export interface TeamApplication extends TeamMember {
	basvuruNotu?: string | null;
	katilimTarihi: number;
}

/** A team as `/api/teams` returns it to one member. */
export interface Team {
	id: string;
	ad: string;
	slug: string;
	aciklama: string;
	kategori: string;
	liderId: string;
	liderAdSoyad: string;
	kontenjan: number;
	repoUrl: string | null;
	status: 'aktif' | 'askida' | 'tamamlandi';
	katilimTuru: 'acik' | 'onayli';
	doluKontenjan: number;
	kalanKontenjan: number;
	dolulukOrani: number;
	uyeler: (TeamMember & { katilimTarihi?: number })[];
	basvurular: TeamApplication[];
	benimDurumum: 'aktif' | 'basvurdu' | null;
	izinler: { manage: boolean; editAll: boolean };
	gorevler: TeamTask[];
	yonetebilir?: boolean;
}

export const COLUMNS: { id: TaskStatus; color: string; key: string }[] = [
	{ id: 'yapilacak', color: 'var(--kb-todo)', key: 'kbColTodo' },
	{ id: 'suruyor', color: 'var(--kb-doing)', key: 'kbColDoing' },
	{ id: 'inceleme', color: 'var(--kb-review)', key: 'kbColReview' },
	{ id: 'tamamlandi', color: 'var(--kb-done)', key: 'kbColDone' },
];

export const PRIORITIES: { id: TaskPriority; color: string; key: string }[] = [
	{ id: 'dusuk', color: 'var(--kb-low)', key: 'kbPrioLow' },
	{ id: 'orta', color: 'var(--kb-medium)', key: 'kbPrioMedium' },
	{ id: 'yuksek', color: 'var(--kb-high)', key: 'kbPrioHigh' },
	{ id: 'kritik', color: 'var(--kb-critical)', key: 'kbPrioCritical' },
];

export const priorityMeta = (id: TaskPriority) => PRIORITIES.find((p) => p.id === id) ?? PRIORITIES[1];
export const columnMeta = (id: TaskStatus) => COLUMNS.find((c) => c.id === id) ?? COLUMNS[0];

const LABEL_HUES = ['#0a84ff', '#30d158', '#ff9f0a', '#bf5af2', '#ff375f', '#64d2ff', '#ac8e68', '#5e5ce6'];

export function labelHue(label: string): string {
	let h = 0;
	for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
	return LABEL_HUES[h % LABEL_HUES.length];
}

export function sortTasks(tasks: TeamTask[], mode: 'manual' | 'priority' | 'due'): TeamTask[] {
	const list = [...tasks];
	const byManual = (a: TeamTask, b: TeamTask) => a.sira - b.sira || b.olusturma - a.olusturma;
	if (mode === 'manual') return list.sort(byManual);
	if (mode === 'priority') {
		return list.sort(
			(a, b) =>
				(b.oncelik === 'kritik' ? 4 : b.oncelik === 'yuksek' ? 3 : b.oncelik === 'orta' ? 2 : 1) -
				(a.oncelik === 'kritik' ? 4 : a.oncelik === 'yuksek' ? 3 : a.oncelik === 'orta' ? 2 : 1) ||
				(a.teslimTarihi ?? Infinity) - (b.teslimTarihi ?? Infinity) ||
				byManual(a, b)
		);
	}
	return list.sort(
		(a, b) =>
			(a.teslimTarihi ?? Infinity) - (b.teslimTarihi ?? Infinity) ||
			(b.oncelik === 'kritik' ? 4 : b.oncelik === 'yuksek' ? 3 : b.oncelik === 'orta' ? 2 : 1) -
			(a.oncelik === 'kritik' ? 4 : a.oncelik === 'yuksek' ? 3 : a.oncelik === 'orta' ? 2 : 1) ||
			byManual(a, b)
	);
}
