/**
 * Strongly typed discriminated Server-Sent Events (SSE) protocol definitions and
 * shared frame encoders/parsers across system, SoC, and chat event channels.
 */

export const SYSTEM_SSE_EVENTS = [
	'permission-changed',
	'session-ended',
	'notification',
	'team_updated',
	'budget_updated',
	'inventory_updated',
	'news_updated',
	'event_updated',
	'project_updated',
	'decision_updated',
	'note_updated',
	'soc_updated',
	'login_approval',
	'drive_updated',
	'call_ring',
	'call_signal',
] as const;

export type SystemSseEventName = (typeof SYSTEM_SSE_EVENTS)[number];

export interface SystemSsePayload {
	ts: number;
	targetId?: string;
}

export type SystemSseFrame = {
	channel: 'system';
	event: SystemSseEventName;
	data: SystemSsePayload;
};

export interface SocLogPayload {
	id: number;
	time: number;
	level: string;
	service: string;
	message: string;
	detail?: unknown;
	userId?: string | null;
	ip?: string | null;
}

export type SocSseFrame =
	| { channel: 'soc'; event: 'connected'; data: { status: 'active'; timestamp: number } }
	| { channel: 'soc'; event: 'log'; data: SocLogPayload };

export type ChatSsePayload =
	| { type: 'connected'; ok: true }
	| { type: 'new_message'; roomId?: string; message: Record<string, unknown> }
	| { type: 'message_deleted'; roomId: string; messageId: string; deletionDate: number }
	| { type: 'messages_cleared'; roomId: string; deletedIds: string[]; deletionDate: number }
	| { type: 'message_edited'; roomId?: string; message: Record<string, unknown> }
	| { type: 'poll_updated'; roomId: string; poll: Record<string, unknown> };

export type ChatSseFrame =
	| { channel: 'chat'; event: 'connected'; data: { ok: true } }
	| { channel: 'chat'; event: 'chat'; data: ChatSsePayload };

export type OrbitSseFrame = SystemSseFrame | SocSseFrame | ChatSseFrame;

const sharedEncoder = new TextEncoder();
const SYSTEM_SSE_EVENT_SET = new Set<string>(SYSTEM_SSE_EVENTS);
const MAX_STATIC_COMMENT_CACHE = 64;
const staticCommentCache = new Map<string, Uint8Array>();
const eventFrameCache = new WeakMap<object, { event: string; bytes: Uint8Array }>();

export function encodeSseEvent(event: string, data: unknown): Uint8Array {
	if (data !== null && typeof data === 'object') {
		const cached = eventFrameCache.get(data);
		if (cached && cached.event === event) {
			return cached.bytes;
		}
		const bytes = sharedEncoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
		eventFrameCache.set(data, { event, bytes });
		return bytes;
	}
	const serialized = typeof data === 'string' ? data : JSON.stringify(data);
	return sharedEncoder.encode(`event: ${event}\ndata: ${serialized}\n\n`);
}

export function encodeSseComment(comment: string): Uint8Array {
	if (comment.length <= 64) {
		const cached = staticCommentCache.get(comment);
		if (cached) return cached;
		const encoded = sharedEncoder.encode(`: ${comment}\n\n`);
		if (staticCommentCache.size < MAX_STATIC_COMMENT_CACHE) {
			staticCommentCache.set(comment, encoded);
		}
		return encoded;
	}
	return sharedEncoder.encode(`: ${comment}\n\n`);
}

export function parseSseJson<T>(raw: string): T | null {
	if (!raw || typeof raw !== 'string') return null;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

export function isSystemSseEventName(value: string): value is SystemSseEventName {
	return SYSTEM_SSE_EVENT_SET.has(value);
}
