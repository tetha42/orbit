import { Client } from 'pg';
import type { SystemLog } from './types';

type LogListener = (log: SystemLog) => void;
const liveLogListeners = new Set<LogListener>();
const recentlyDispatchedLogIds = new Set<number>();

export function dispatchLog(log: SystemLog): void {
	if (recentlyDispatchedLogIds.has(log.id)) return;
	recentlyDispatchedLogIds.add(log.id);
	if (recentlyDispatchedLogIds.size > 1000) {
		const it = recentlyDispatchedLogIds.values();
		for (let i = 0; i < 500; i++) {
			const val = it.next().value;
			if (val !== undefined) recentlyDispatchedLogIds.delete(val);
		}
	}
	for (const listener of liveLogListeners) {
		try {
			listener(log);
		} catch {
			// ignore listener failures
		}
	}
}

interface SocLogGlobal {
	__socPgListening?: boolean;
	__socPgClient?: Client;
}
const globalSocStore = globalThis as typeof globalThis & SocLogGlobal;

function ensureSocPgListener(): void {
	if (globalSocStore.__socPgListening) return;
	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) return;
	globalSocStore.__socPgListening = true;

	const client = new Client({ connectionString });
	globalSocStore.__socPgClient = client;
	let retryScheduled = false;

	const scheduleRetry = (delayMs: number) => {
		if (retryScheduled) return;
		retryScheduled = true;
		globalSocStore.__socPgListening = false;
		if (globalSocStore.__socPgClient === client) globalSocStore.__socPgClient = undefined;
		client.removeAllListeners();
		client.on('error', () => {});
		client.end().catch(() => {});
		const timer = setTimeout(() => {
			void ensureSocPgListener();
		}, delayMs);
		timer.unref?.();
	};

	client.on('notification', (msg) => {
		if (msg.channel !== 'soc_live_logs' || !msg.payload) return;
		try {
			const parsed = JSON.parse(msg.payload) as SystemLog;
			if (parsed && typeof parsed === 'object' && typeof parsed.id === 'number') {
				dispatchLog(parsed);
			}
		} catch {
			// ignore malformed payload
		}
	});

	client.on('error', () => scheduleRetry(3000));
	client.on('end', () => scheduleRetry(3000));

	client
		.connect()
		.then(() => client.query('LISTEN soc_live_logs'))
		.catch(() => scheduleRetry(5000));
}

export function subscribeToLiveLogs(listener: LogListener): () => void {
	ensureSocPgListener();
	liveLogListeners.add(listener);
	return () => {
		liveLogListeners.delete(listener);
	};
}
