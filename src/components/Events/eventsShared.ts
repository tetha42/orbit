import type { EventStatus, EventType, AttendanceMethod } from '@/lib/events';

/** An event as `/api/events` returns it to one member. */
export interface EventView {
	id: string;
	slug: string;
	title: string;
	typeValue: EventType;
	description: string;
	location: string;
	start: number;
	endTime: number;
	capacity: number;
	status: EventStatus;
	attendanceOpen: number;
	registeredCount: number;
	participantCount: number;
	myMyRecord: boolean;
	myMyAttendance: { method: AttendanceMethod; participationTime: number } | null;
	ticketCode: string | null;
}

export interface EventsResponse {
	events: EventView[];
	permissions: { manage: boolean };
	serverTime: number;
}

export const TYPE_META: Record<EventType, { color: string; key: string }> = {
	atolye: { color: 'var(--ev-atolye)', key: 'evTypeAtolye' },
	seminer: { color: 'var(--ev-seminer)', key: 'evTypeSeminer' },
	yarisma: { color: 'var(--ev-yarisma)', key: 'evTypeYarisma' },
	toplanti: { color: 'var(--ev-toplanti)', key: 'evTypeToplanti' },
};

export const typeMeta = (typeValue: string) => TYPE_META[typeValue as EventType] ?? TYPE_META.atolye;

export function isLive(e: Pick<EventView, 'start' | 'endTime' | 'status'>, now: number): boolean {
	return e.status === 'yayinda' && now >= e.start && now <= e.endTime;
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
