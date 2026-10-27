import { getUserBySessionToken } from '@/db';
import { aboneOl, type AppEvent } from '@/db/olaylar';
import { readSessionToken, verifyAuth } from '@/lib/auth/authGuard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** A comment line this often keeps proxies and the browser from closing an idle stream. */
const KEEPALIVE_MS = 25_000;

const HEADERS = {
	'Content-Type': 'text/event-stream; charset=utf-8',
	// no-transform keeps compression middleware from buffering the stream.
	'Cache-Control': 'no-store, no-transform',
	Connection: 'keep-alive',
	// nginx-style proxies: do not buffer.
	'X-Accel-Buffering': 'no',
};

/**
 * Live events for the signed-in member, as Server-Sent Events (one stream per tab).
 *
 *   permission-degisti   — the member's role, or a role's permissions, changed
 *   oturum-sonlandi — the session is over (signed in elsewhere, signed out, account suspended); the stream closes
 *   bildirim        — something new for the feed
 *
 * An event is only a hint, with no data: the client re-reads `/api/auth/me` or
 * `/api/bildirimler`, which apply the member's own session and role as always.
 * Events reach this process through PostgreSQL NOTIFY (db/olaylar), so a change
 * made on another server process arrives too.
 *
 * The session is checked when the stream opens (401/403 otherwise). A member
 * keeps at most `MAX_CONNECTIONS_PER_USER` streams; a newer one closes
 * their oldest. Whatever ends a stream — the client leaving, the server closing it —
 * removes it from the hub, so nothing is left behind.
 */
export async function GET(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;
	const userId = auth.user.id;
	const token = readSessionToken(request) ?? '';
	const enc = new TextEncoder();

	let bitir: () => void = () => {};
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			let kapali = false;
			let aboneligiKaldir: () => void = () => {};

			const yaz = (parca: string) => {
				if (kapali) return;
				try {
					controller.enqueue(enc.encode(parca));
				} catch {
					bitir();
				}
			};
			const gonder = (ad: string) => yaz(`event: ${ad}\ndata: {}\n\n`);

			bitir = () => {
				if (kapali) return;
				kapali = true;
				clearInterval(kalpAtisi);
				aboneligiKaldir();
				request.signal.removeEventListener('abort', bitir);
				try {
					controller.close();
				} catch {
					// already closed by the client
				}
			};

			const kalpAtisi = setInterval(() => yaz(': keepalive\n\n'), KEEPALIVE_MS);

			const oturumuDenetle = async () => {
				const user = await getUserBySessionToken(token).catch(() => undefined);
				// undefined: the check itself failed — say nothing, the client's own poll is the net.
				if (user === undefined) return;
				if (!user || (user.status !== 'aktif' && user.status !== 'mezun')) {
					gonder('oturum-sonlandi');
					bitir();
				}
			};

			const ilet = (olay: AppEvent) => {
				if (olay.k === 'oturum') void oturumuDenetle();
				else if (olay.k === 'permission') gonder('permission-degisti');
				else if (olay.k === 'bildirim') gonder('bildirim');
				else if (olay.k === 'takim_guncellendi') gonder('takim_guncellendi');
				else if (olay.k === 'butce_guncellendi') gonder('butce_guncellendi');
				else if (olay.k === 'envanter_guncellendi') gonder('envanter_guncellendi');
				else if (olay.k === 'haber_guncellendi') gonder('haber_guncellendi');
				else if (olay.k === 'etkinlik_guncellendi') gonder('etkinlik_guncellendi');
				else if (olay.k === 'proje_guncellendi') gonder('proje_guncellendi');
				else if (olay.k === 'karar_guncellendi') gonder('karar_guncellendi');
				else if (olay.k === 'not_guncellendi') gonder('not_guncellendi');
				else if (olay.k === 'yenile') {
					gonder('permission-degisti');
					gonder('bildirim');
					gonder('takim_guncellendi');
					gonder('butce_guncellendi');
					gonder('envanter_guncellendi');
					gonder('haber_guncellendi');
					gonder('etkinlik_guncellendi');
					gonder('proje_guncellendi');
					gonder('karar_guncellendi');
					gonder('not_guncellendi');
				}
			};

			request.signal.addEventListener('abort', bitir, { once: true });
			if (request.signal.aborted) {
				bitir();
				return;
			}
			aboneligiKaldir = aboneOl({ userId, ilet, kapat: bitir });
			// First bytes out at once, so the browser sees the stream open.
			yaz('retry: 3000\n: baglandi\n\n');
		},
		cancel() {
			bitir();
		},
	});

	return new Response(stream, { headers: HEADERS });
}
