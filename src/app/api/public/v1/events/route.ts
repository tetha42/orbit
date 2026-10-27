import { getPublicEvents } from '@/db';
import { isoDate, limitPublic, publicError, publicJson, publicPreflight } from '@/lib/publicApi';

export const dynamic = 'force-dynamic';

export const OPTIONS = publicPreflight;

const TYPE_LABELS: Record<string, string> = {
	atolye: 'Atölye',
	seminer: 'Seminer',
	yarisma: 'Yarışma',
	toplanti: 'Toplantı',
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
				const capacity = event.kapasite > 0 ? event.kapasite : null;
				return {
					id: event.id,
					title: event.baslik,
					type: event.tur,
					typeLabel: TYPE_LABELS[event.tur] ?? event.tur,
					description: event.aciklama,
					location: event.konum,
					startsAt: isoDate(event.baslangic),
					endsAt: isoDate(event.endTime),
					capacity,
					seatsLeft: capacity === null ? null : Math.max(0, capacity - event.katilimciSayisi),
				};
			}),
		});
	} catch (error) {
		console.error('API /api/public/v1/events error:', error);
		return publicError(request, 500, 'server_error', 'Etkinlikler şu anda getirilemedi.');
	}
}
