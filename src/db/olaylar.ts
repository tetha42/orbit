/**
 * Live events between server processes: PostgreSQL LISTEN/NOTIFY.
 *
 * A write that other screens must hear about (a role edited, a session ended, a
 * new notification) sends a NOTIFY on `beu_olaylar`; every server process holds
 * ONE shared LISTEN connection and passes what it hears on to
 *   - its handlers (the permission cache in db/roles drops its entries), and
 *   - the open `/api/olaylar` streams of its own members.
 *
 * The payload carries ids only — no names, no content, nothing secret. What a
 * client does with the hint (re-reading `/api/auth/me`, `/api/bildirimler`) is
 * checked against its own session and role as always.
 *
 * NOTIFY sent inside a transaction is delivered only after its COMMIT, so a
 * writer calls `publishEvent` on its transaction client, before returning.
 */
import { Client, type Pool, type PoolClient } from 'pg';

const KANAL = 'beu_olaylar';

export type AppEvent =
	/** A role's permissions changed (`roleId`), or one member's role did (`userId`); neither = everyone. */
	| { k: 'permission'; roleId?: string; userId?: string }
	/** The member's session or account state changed: the open streams re-check their own session. */
	| { k: 'oturum'; userId: string }
	/** Something new for the member (`userId`) or for everyone (absent): the feed is re-read. */
	| { k: 'bildirim'; userId?: string }
	/** A team or kanban board was modified. */
	| { k: 'takim_guncellendi'; teamId?: string; userId?: string }
	/** A budget entry or transfer was recorded or modified. */
	| { k: 'butce_guncellendi'; userId?: string }
	/** An inventory item was created, updated, loaned or returned. */
	| { k: 'envanter_guncellendi'; userId?: string }
	/** A news article was created, updated, or removed. */
	| { k: 'haber_guncellendi'; userId?: string }
	/** An event was created, updated, removed, or attendee status changed. */
	| { k: 'etkinlik_guncellendi'; userId?: string }
	/** A project was created, updated, liked, or removed. */
	| { k: 'proje_guncellendi'; userId?: string }
	/** A board decision or ECR was created, updated, approved or rejected. */
	| { k: 'karar_guncellendi'; userId?: string }
	/** A personal or shared note was created, updated, or removed. */
	| { k: 'not_guncellendi'; userId?: string }
	/** The shared connection came back after a gap: whatever was missed, re-read it. */
	| { k: 'yenile' };

/** A stream of one browser tab, as the hub sees it. */
export interface EventSubscriber {
	userId: string;
	/** Hands the event to the stream. */
	ilet: (olay: AppEvent) => void;
	/** Closes the stream (the member has too many open, or the server shuts it). */
	kapat: () => void;
}

type EventHandler = (olay: AppEvent) => void;

interface Hub {
	client: Client | null;
	baglaniyor: boolean;
	deneme: number;
	zamanlayici: ReturnType<typeof setTimeout> | null;
	aboneler: Set<EventSubscriber>;
	isleyiciler: Map<string, EventHandler>;
}

/** Kept on globalThis: dev reloads and separately bundled routes must share one connection. */
const g = globalThis as typeof globalThis & { __beuOlayHub?: Hub };
const hub: Hub = (g.__beuOlayHub ??= { client: null, baglaniyor: false, deneme: 0, zamanlayici: null, aboneler: new Set(), isleyiciler: new Map() });

/** Most simultaneous streams one member keeps (tabs, devices); the oldest is closed for a newer one. */
export const MAX_CONNECTIONS_PER_USER = 8;

type Sorgu = Pick<Pool | PoolClient, 'query'>;

/** Sends the events on `db`. On a transaction client they become visible after its COMMIT. */
export async function publishEvent(db: Sorgu, olaylar: AppEvent | AppEvent[]): Promise<void> {
	const liste = Array.isArray(olaylar) ? olaylar : [olaylar];
	if (!liste.length) return;
	await db.query(`SELECT pg_notify($1, p) FROM unnest($2::text[]) AS p`, [KANAL, liste.map((o) => JSON.stringify(o))]);
}

/** For writers that have already committed: a failed hint must not fail the request. */
export async function publishEventQuiet(db: Sorgu, olaylar: AppEvent | AppEvent[]): Promise<void> {
	try {
		await publishEvent(db, olaylar);
	} catch (err) {
		console.error('[olaylar] NOTIFY gönderilemedi:', err instanceof Error ? err.message : err);
	}
}

/** One `bildirim` hint per member (or one for everyone when `kullaniciIds` is omitted). */
export function notificationEvents(kullaniciIds?: Iterable<string | null | undefined>): AppEvent[] {
	if (!kullaniciIds) return [{ k: 'bildirim' }];
	return [...new Set([...kullaniciIds].filter((id): id is string => !!id))].map((userId) => ({ k: 'bildirim', userId }));
}

function hedefOf(olay: AppEvent): string | undefined {
	return olay.k === 'yenile' ? undefined : olay.userId;
}

function dagit(olay: AppEvent) {
	for (const isleyici of hub.isleyiciler.values()) {
		try {
			isleyici(olay);
		} catch (err) {
			console.error('[olaylar] işleyici hatası:', err);
		}
	}
	const hedef = hedefOf(olay);
	for (const abone of [...hub.aboneler]) {
		if (hedef && hedef !== abone.userId) continue;
		try {
			abone.ilet(olay);
		} catch (err) {
			console.error('[olaylar] abone hatası:', err);
		}
	}
}

function ayrilVeYenidenDene() {
	const eski = hub.client;
	hub.client = null;
	if (eski) {
		eski.removeAllListeners();
		eski.on('error', () => {});
		eski.end().catch(() => {});
	}
	if (hub.zamanlayici) return;
	// 1 s, 2 s, 4 s … up to 30 s.
	const bekleme = Math.min(30_000, 1000 * 2 ** Math.min(hub.deneme, 5));
	hub.deneme += 1;
	hub.zamanlayici = setTimeout(() => {
		hub.zamanlayici = null;
		void dinleyiciyiBaslat();
	}, bekleme);
	hub.zamanlayici.unref?.();
}

/**
 * Starts this process's shared LISTEN connection (idempotent, fire and forget).
 * Whoever needs live events or the cross-process cache invalidation calls it.
 */
export function dinleyiciyiBaslat(): Promise<void> {
	if (hub.client || hub.baglaniyor || hub.zamanlayici) return Promise.resolve();
	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) return Promise.resolve();
	hub.baglaniyor = true;
	const client = new Client({ connectionString });
	// A dropped connection is never fatal: the permission cache falls back to its TTL and the
	// streams to the client's polling, until the connection is back.
	client.on('error', (err) => {
		console.error('[olaylar] LISTEN bağlantısı hatası:', err.message);
		if (hub.client === client) ayrilVeYenidenDene();
	});
	client.on('end', () => {
		if (hub.client === client) ayrilVeYenidenDene();
	});
	client.on('notification', (msg) => {
		if (msg.channel !== KANAL || !msg.payload) return;
		try {
			dagit(JSON.parse(msg.payload) as AppEvent);
		} catch {
			// A payload that is not ours is ignored.
		}
	});
	return client
		.connect()
		.then(() => client.query(`LISTEN ${KANAL}`))
		.then(() => {
			hub.client = client;
			const kopukluktan = hub.deneme > 0;
			hub.deneme = 0;
			// Events sent while the connection was down are lost: everyone re-reads.
			if (kopukluktan) dagit({ k: 'yenile' });
		})
		.catch((err: Error) => {
			console.error('[olaylar] LISTEN başlatılamadı:', err.message);
			hub.client = client;
			ayrilVeYenidenDene();
		})
		.finally(() => {
			hub.baglaniyor = false;
		});
}

/**
 * Adds a stream. A member's ninth stream closes their oldest one. Returns the
 * function that removes it again — every stream must call it when it ends.
 */
export function aboneOl(abone: EventSubscriber): () => void {
	void dinleyiciyiBaslat();
	const userItems = [...hub.aboneler].filter((a) => a.userId === abone.userId);
	for (const eski of userItems.slice(0, Math.max(0, userItems.length - MAX_CONNECTIONS_PER_USER + 1))) eski.kapat();
	hub.aboneler.add(abone);
	return () => {
		hub.aboneler.delete(abone);
	};
}

/** A named handler for every event this process hears (re-registering the name replaces it). */
export function registerEventHandler(ad: string, isleyici: EventHandler): void {
	hub.isleyiciler.set(ad, isleyici);
}

/** For tests and diagnostics: how many streams and whether the shared connection is up. */
export function eventStatus(): { aboneSayisi: number; dinliyor: boolean } {
	return { aboneSayisi: hub.aboneler.size, dinliyor: !!hub.client };
}
