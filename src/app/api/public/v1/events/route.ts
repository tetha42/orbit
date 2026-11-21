import { getPublicEvents } from '@/db';
import { isoDate, limitPublic, publicError, publicJson, publicPreflight } from '@/lib/publicApi';

export const dynamic = 'force-dynamic';

export const OPTIONS = publicPreflight;

const TYPE_LABELS: Record<string, string> = {
	workshop: 'Workshop',
	seminar: 'Seminar',
	competition: 'Competition',
	meeting: 'Meeting',
};

/**
 * `GET /api/public/v1/events` — published events that have not ended, soonest first.
 * Attendee lists and organiser ids are never part of it.
 */
export async function GET(request: Request) {
	const limited = await limitPublic(request);
	if (limited) return limited;

	try {
		const events = await getPublicEvents(24);
		return publicJson(request, {
			data: events.map((event) => {
				const capacity = event.capacity > 0 ? event.capacity : null;
				return {
					id: event.id,
					title: event.title,
					type: event.typeValue,
					typeLabel: TYPE_LABELS[event.typeValue] ?? event.typeValue,
					description: event.description,
					location: event.location,
					startsAt: isoDate(event.start),
					endsAt: isoDate(event.endTime),
					capacity,
					seatsLeft: capacity === null ? null : Math.max(0, capacity - event.participantCount),
				};
			}),
		});
	} catch (error) {
		console.error('API /api/public/v1/events error:', error);
		return publicError(request, 500, 'server_error', 'Events could not be fetched right now.');
	}
}
