import { NextResponse } from 'next/server';
import { getTeamById, getUserByHandle, getUserById, type EventPatch } from '@/db';
import type { User } from '@/db/schema';
import {
	EVENT_DESCRIPTION_MAX,
	EVENT_TITLE_MAX,
	CAPACITY_MAX,
	normalizeEventType,
	normalizeEventStatus,
} from '@/lib/events';
import eventsContract from '@/apps/events/events.contract.json';

export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Validates editable event fields; `partial` leaves absent fields out. */
export async function parseEventFields(
	body: Record<string, unknown>,
	partial: boolean
): Promise<{ ok: true; value: EventPatch; error?: undefined } | { ok: false; value?: undefined; error: string }> {
	const v: EventPatch = {};
	const has = (k: string) => body[k] !== undefined;

	if (!partial || has('title')) {
		const rawTitle = body.title;
		const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
		if (title.length < 3) return { ok: false, error: 'Event title must be at least 3 characters.' };
		const maxTitle = Math.min(EVENT_TITLE_MAX, eventsContract.limits.maxTitleLength);
		if (title.length > maxTitle) return { ok: false, error: `Title cannot exceed ${maxTitle} characters.` };
		v.title = title;
	}
	if (!partial || has('type')) {
		const rawType = (body.type ?? body.typeValue ?? 'workshop') as string;
		const typeValue = normalizeEventType(rawType);
		if (!typeValue) return { ok: false, error: 'Invalid event type.' };
		v.typeValue = typeValue;
	}
	if (!partial || has('description')) {
		const rawDesc = body.description;
		const description = typeof rawDesc === 'string' ? rawDesc.trim() : '';
		if (description.length > EVENT_DESCRIPTION_MAX) return { ok: false, error: 'Description is too long.' };
		v.description = description;
	}
	if (!partial || has('location')) {
		const rawLoc = body.location;
		const location = typeof rawLoc === 'string' ? rawLoc.trim() : '';
		if (!location) return { ok: false, error: 'Location is required.' };
		v.location = location.slice(0, 120);
	}
	if (!partial || has('start')) {
		const startNum = Number(body.start);
		if (!Number.isFinite(startNum) || startNum <= 0) {
			return { ok: false, error: 'Start and end times must be valid.' };
		}
		v.start = Math.round(startNum);
	}
	if (!partial || has('endTime') || has('end')) {
		const endNum = Number(body.endTime ?? body.end);
		if (!Number.isFinite(endNum) || endNum <= 0) {
			return { ok: false, error: 'Start and end times must be valid.' };
		}
		v.endTime = Math.round(endNum);
	}
	if (v.start && v.endTime && v.endTime <= v.start) {
		return { ok: false, error: 'End time must be after start time.' };
	}
	if (!partial || has('capacity')) {
		const rawCap = body.capacity ?? 50;
		const n = Number(rawCap);
		const maxCapacity = Math.min(CAPACITY_MAX, eventsContract.limits.maxEventCapacity);
		if (!Number.isInteger(n) || n < 0 || n > maxCapacity) {
			return { ok: false, error: `Capacity must be between 0 and ${maxCapacity} (0 = unlimited).` };
		}
		v.capacity = n;
	}
	if (has('status')) {
		const status = normalizeEventStatus(body.status);
		if (!status) return { ok: false, error: 'Invalid status.' };
		v.status = status;
	}
	if (has('ownerTeamId')) {
		const ownerTeamId = typeof body.ownerTeamId === 'string' && body.ownerTeamId ? body.ownerTeamId : null;
		if (ownerTeamId) {
			const ownerTeam = await getTeamById(ownerTeamId);
			if (!ownerTeam) return { ok: false, error: 'Owner team not found.' };
		}
		v.ownerTeamId = ownerTeamId;
	}
	if (has('ownerUserId')) {
		const ownerUserId = typeof body.ownerUserId === 'string' && body.ownerUserId ? body.ownerUserId : null;
		if (ownerUserId) {
			const owner = await getUserById(ownerUserId);
			if (!owner || owner.status !== 'active') return { ok: false, error: 'Owner member not found.' };
		}
		v.ownerUserId = ownerUserId;
	}
	return { ok: true, value: v };
}

export async function memberOf(body: Record<string, unknown>): Promise<User | null> {
	if (typeof body.userId === 'string' && body.userId) return getUserById(body.userId);
	if (typeof body.studentNo === 'string' && body.studentNo.trim()) return getUserByHandle(body.studentNo.trim());
	return null;
}
