import type { AttendanceMethod, EventStatus, EventType } from '@/lib/events';
import type { CommunityEvent } from '@/db/schema';

export interface PublicEventRow {
	id: string;
	title: string;
	typeValue: string;
	description: string;
	location: string;
	start: number;
	endTime: number;
	capacity: number;
	participantCount: number;
}

/** An event as one member sees it: counts, plus their own registration and check-in. */
export interface EventView extends CommunityEvent {
	registeredCount: number;
	participantCount: number;
	attendanceOpen: number;
	update: number | null;
	myRecord: boolean;
	myAttendance: { method: AttendanceMethod; participationTime: number } | null;
}

/** One line of the organisers' list: a registration, a check-in, or both. */
export interface AttendeeRow {
	userId: string;
	nameSurname: string;
	studentNo: string | null;
	department: string | null;
	recordTime: number | null;
	participationTime: number | null;
	method: AttendanceMethod | null;
	recorderNameSurname: string | null;
}

export type RegistrationResult = 'ok' | 'already' | 'full' | 'closed' | 'not_found';

export interface EventPatch {
	title?: string;
	typeValue?: EventType;
	description?: string;
	location?: string;
	start?: number;
	endTime?: number;
	capacity?: number;
	status?: EventStatus;
	attendanceOpen?: boolean;
	ownerTeamId?: string | null;
	ownerUserId?: string | null;
}

export const EVENT_PATCH_COLUMNS: Record<string, string> = {
	title: 'title',
	typeValue: 'category',
	description: 'description',
	location: 'location',
	start: 'starts_at',
	endTime: 'ends_at',
	capacity: 'capacity',
	status: 'status',
};
