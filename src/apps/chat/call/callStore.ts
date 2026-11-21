'use client';

import { useSyncExternalStore } from 'react';
import type { ChatCallRecord } from '@/domains/webrtc/types';
import {
	acquireLocalMic,
	cleanupMediaAndPeers,
	getOrCreatePeer,
	pollAndApplySignals,
	setLocalAudioMuted,
} from './peerSession';

export interface ActiveCallUiState {
	call: ChatCallRecord | null;
	incomingRing: { callId: string; roomId: string; fromUserId: string; fromName: string } | null;
	inCall: boolean;
	connecting: boolean;
	muted: boolean;
	errorKey: string | null;
	startedAt: number | null;
}

type Listener = () => void;

let state: ActiveCallUiState = {
	call: null, incomingRing: null, inCall: false, connecting: false,
	muted: false, errorKey: null, startedAt: null,
};

const listeners = new Set<Listener>();
let signalPollTimer: ReturnType<typeof setInterval> | null = null;
let lastSignalAt = 0;
let currentUserId = '';

function emit() {
	for (const l of listeners) l();
}

function setState(patch: Partial<ActiveCallUiState>) {
	state = { ...state, ...patch };
	emit();
}

export function useVoiceCallState(): ActiveCallUiState {
	return useSyncExternalStore(
		(cb) => {
			listeners.add(cb);
			return () => listeners.delete(cb);
		},
		() => state,
		() => state
	);
}

function stopLoopAndCleanup() {
	if (signalPollTimer) {
		clearInterval(signalPollTimer);
		signalPollTimer = null;
	}
	cleanupMediaAndPeers();
}

async function syncSignalsNow(callId: string) {
	lastSignalAt = await pollAndApplySignals(callId, lastSignalAt);
}

function startSignalLoop(call: ChatCallRecord, myUserId: string) {
	currentUserId = myUserId;
	if (signalPollTimer) clearInterval(signalPollTimer);
	for (const p of call.participants) {
		if (p.userId !== myUserId && myUserId < p.userId) {
			void getOrCreatePeer(call.id, p.userId, true);
		}
	}
	void syncSignalsNow(call.id);
	signalPollTimer = setInterval(() => {
		if (state.call?.id) void syncSignalsNow(state.call.id);
	}, 1500);
}

export async function startRoomVoiceCall(roomId: string, myUserId: string) {
	setState({ connecting: true, errorKey: null });
	const mic = await acquireLocalMic();
	if (!mic.ok) {
		setState({ connecting: false, errorKey: mic.errorKey });
		return;
	}
	const res = await fetch('/api/chat/call', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ action: 'start', roomId }),
	});
	const data = (await res.json().catch(() => ({}))) as { ok?: boolean; call?: ChatCallRecord; code?: string };
	if (!res.ok || !data.call) {
		stopLoopAndCleanup();
		const errorKey =
			data.code === 'CALL_LOCKDOWN'
				? 'chatCallLockdown'
				: data.code === 'CALL_FULL'
				? 'chatCallFull'
				: 'chatCallFailed';
		setState({ connecting: false, errorKey });
		return;
	}
	lastSignalAt = Date.now() - 5000;
	setState({
		call: data.call,
		inCall: true,
		connecting: false,
		muted: false,
		startedAt: data.call.answeredAt || Date.now(),
	});
	startSignalLoop(data.call, myUserId);
}

export async function acceptIncomingVoiceCall(callId: string, myUserId: string) {
	setState({ connecting: true, errorKey: null });
	const mic = await acquireLocalMic();
	if (!mic.ok) {
		setState({ connecting: false, errorKey: mic.errorKey });
		return;
	}
	const res = await fetch('/api/chat/call', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ action: 'accept', callId }),
	});
	const data = (await res.json().catch(() => ({}))) as { ok?: boolean; call?: ChatCallRecord; code?: string };
	if (!res.ok || !data.call) {
		stopLoopAndCleanup();
		setState({
			connecting: false,
			incomingRing: null,
			errorKey: data.code === 'CALL_FULL' ? 'chatCallFull' : 'chatCallFailed',
		});
		return;
	}
	lastSignalAt = Date.now() - 10_000;
	setState({
		call: data.call,
		incomingRing: null,
		inCall: true,
		connecting: false,
		muted: false,
		startedAt: data.call.answeredAt || Date.now(),
	});
	startSignalLoop(data.call, myUserId);
}

export async function declineOrHangupVoiceCall(callId?: string) {
	const id = callId || state.call?.id || state.incomingRing?.callId;
	const action = state.inCall ? 'hangup' : 'reject';
	stopLoopAndCleanup();
	setState({
		call: null,
		incomingRing: null,
		inCall: false,
		connecting: false,
		muted: false,
		startedAt: null,
	});
	if (id) {
		await fetch('/api/chat/call', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action, callId: id }),
		}).catch((err) => {
			console.warn('[WebRTC] Hangup request failed:', err);
		});
	}
}

export function toggleVoiceCallMute() {
	const nextMuted = !state.muted;
	setLocalAudioMuted(nextMuted);
	setState({ muted: nextMuted });
	if (state.call?.id) {
		void fetch('/api/chat/call', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'mute_state', callId: state.call.id, muted: nextMuted }),
		});
	}
}

export function handleRealtimeCallEvent(event: Record<string, unknown>, myUserId: string) {
	if (event.k === 'call_ring' && typeof event.callId === 'string') {
		if (event.fromUserId === myUserId || state.inCall) return;
		setState({
			incomingRing: {
				callId: String(event.callId),
				roomId: String(event.roomId ?? ''),
				fromUserId: String(event.fromUserId ?? ''),
				fromName: String(event.fromName ?? 'Member'),
			},
		});
	} else if (event.type === 'call_state' && event.call) {
		const updated = event.call as ChatCallRecord;
		if (state.call?.id === updated.id) {
			setState({ call: updated });
			if (currentUserId) startSignalLoop(updated, currentUserId);
		}
	} else if (event.type === 'call_ended') {
		const endedId = String(event.callId ?? '');
		if (state.call?.id === endedId || state.incomingRing?.callId === endedId) {
			stopLoopAndCleanup();
			setState({
				call: null,
				incomingRing: null,
				inCall: false,
				connecting: false,
				muted: false,
				startedAt: null,
			});
		}
	} else if ((event.k === 'call_signal' || event.type === 'call_signal') && state.call?.id) {
		void syncSignalsNow(state.call.id);
	}
}

export function dismissCallError() {
	setState({ errorKey: null });
}

if (typeof window !== 'undefined') {
	const globalStore = window as unknown as { __orbitCallUnloadBound?: boolean };
	if (!globalStore.__orbitCallUnloadBound) {
		globalStore.__orbitCallUnloadBound = true;
		window.addEventListener('pagehide', () => {
			const callId = state.call?.id;
			if (!state.inCall || !callId) return;
			stopLoopAndCleanup();
			void fetch('/api/chat/call', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'hangup', callId }),
				keepalive: true,
			}).catch(() => {
				// Best-effort unload hangup
			});
		});
	}
}
