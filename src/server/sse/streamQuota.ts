export type SseChannel = 'system' | 'soc' | 'chat' | 'terminal';

interface StreamSlotRecord {
	id: string;
	channel: SseChannel;
	userId: string;
	createdAt: number;
	evict: () => void;
}

interface QuotaRegistry {
	byChannel: Record<SseChannel, Set<StreamSlotRecord>>;
	byUserChannel: Map<string, StreamSlotRecord[]>;
}

const QUOTA_KEY = '__orbit_sse_quota_registry_v1__';

function getRegistry(): QuotaRegistry {
	const g = globalThis as unknown as Record<string, QuotaRegistry | undefined>;
	if (!g[QUOTA_KEY]) {
		g[QUOTA_KEY] = {
			byChannel: {
				system: new Set(),
				soc: new Set(),
				chat: new Set(),
				terminal: new Set(),
			},
			byUserChannel: new Map(),
		};
	}
	return g[QUOTA_KEY]!;
}

export interface AcquireStreamSlotOptions {
	channel: SseChannel;
	userId: string;
	maxPerUser: number;
	maxGlobal: number;
	onEvict: () => void;
}

export type AcquireStreamSlotResult =
	| { ok: true; release: () => void; slotId: string }
	| { ok: false; retryAfter: number; reason: string };

let slotSeq = 0;

export function acquireStreamSlot(opts: AcquireStreamSlotOptions): AcquireStreamSlotResult {
	const reg = getRegistry();
	const channelSet = reg.byChannel[opts.channel];
	const userKey = `${opts.channel}:${opts.userId}`;
	const userSlots = reg.byUserChannel.get(userKey) ?? [];

	// Evict oldest per-user stream first so reconnecting tabs do not leak descriptors.
	while (userSlots.length >= opts.maxPerUser) {
		const oldest = userSlots.shift();
		if (!oldest) break;
		channelSet.delete(oldest);
		try {
			oldest.evict();
		} catch {
			// ignore eviction cleanup error
		}
	}

	if (channelSet.size >= opts.maxGlobal) {
		return {
			ok: false,
			retryAfter: 10,
			reason: `Global SSE quota exceeded for channel "${opts.channel}" (${opts.maxGlobal} active streams).`,
		};
	}

	const slot: StreamSlotRecord = {
		id: `${opts.channel}-${Date.now()}-${++slotSeq}`,
		channel: opts.channel,
		userId: opts.userId,
		createdAt: Date.now(),
		evict: opts.onEvict,
	};

	userSlots.push(slot);
	reg.byUserChannel.set(userKey, userSlots);
	channelSet.add(slot);

	let released = false;
	const release = () => {
		if (released) return;
		released = true;
		channelSet.delete(slot);
		const currentUserSlots = reg.byUserChannel.get(userKey);
		if (currentUserSlots) {
			const idx = currentUserSlots.indexOf(slot);
			if (idx >= 0) currentUserSlots.splice(idx, 1);
			if (currentUserSlots.length === 0) reg.byUserChannel.delete(userKey);
		}
	};

	return { ok: true, release, slotId: slot.id };
}

export function getStreamQuotaSnapshot(): Record<SseChannel, number> {
	const reg = getRegistry();
	return {
		system: reg.byChannel.system.size,
		soc: reg.byChannel.soc.size,
		chat: reg.byChannel.chat.size,
		terminal: reg.byChannel.terminal.size,
	};
}
