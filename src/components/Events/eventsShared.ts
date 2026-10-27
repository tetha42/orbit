import type { EventStatus, EventType, AttendanceMethod } from '@/lib/events';

/** An event as `/api/events` returns it to one member. */
export interface EventView {
	id: string;
	slug: string;
	baslik: string;
	tur: EventType;
	aciklama: string;
	konum: string;
	baslangic: number;
	endTime: number;
	kapasite: number;
	status: EventStatus;
	yoklamaAcik: number;
	kayitliSayisi: number;
	katilimciSayisi: number;
	benimKaydim: boolean;
	benimYoklamam: { yontem: AttendanceMethod; katilimZamani: number } | null;
	biletKodu: string | null;
}

export interface EventsResponse {
	etkinlikler: EventView[];
	izinler: { manage: boolean };
	sunucuZamani: number;
}

export const TYPE_META: Record<EventType, { color: string; key: string }> = {
	atolye: { color: 'var(--ev-atolye)', key: 'evTypeAtolye' },
	seminer: { color: 'var(--ev-seminer)', key: 'evTypeSeminer' },
	yarisma: { color: 'var(--ev-yarisma)', key: 'evTypeYarisma' },
	toplanti: { color: 'var(--ev-toplanti)', key: 'evTypeToplanti' },
};

export const typeMeta = (tur: string) => TYPE_META[tur as EventType] ?? TYPE_META.atolye;

export function isLive(e: Pick<EventView, 'baslangic' | 'endTime' | 'status'>, now: number): boolean {
	return e.status === 'yayinda' && now >= e.baslangic && now <= e.endTime;
}

/** "12 Eki Pzt · 14:00–17:00", or with both dates when it spans days. */
export function formatRange(start: number, end: number, locale: string): string {
	const s = new Date(start);
	const e = new Date(end);
	const day = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short', weekday: 'short' });
	const time = (d: Date) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
	return s.toDateString() === e.toDateString()
		? `${day(s)} · ${time(s)}–${time(e)}`
		: `${day(s)} ${time(s)} – ${day(e)} ${time(e)}`;
}
