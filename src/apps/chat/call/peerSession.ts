'use client';

let localStream: MediaStream | null = null;
const peerConnections = new Map<string, RTCPeerConnection>();
const remoteAudioEls = new Map<string, HTMLAudioElement>();

export function getLocalAudioStream(): MediaStream | null {
	return localStream;
}

export function setLocalAudioMuted(muted: boolean) {
	if (!localStream) return;
	for (const track of localStream.getAudioTracks()) {
		track.enabled = !muted;
	}
}

export function cleanupMediaAndPeers() {
	for (const pc of peerConnections.values()) {
		try {
			pc.close();
		} catch {
			// Ignore close error
		}
	}
	peerConnections.clear();
	for (const audio of remoteAudioEls.values()) {
		try {
			audio.pause();
			audio.srcObject = null;
			audio.remove();
		} catch {
			// Ignore audio cleanup error
		}
	}
	remoteAudioEls.clear();
	if (localStream) {
		for (const track of localStream.getTracks()) track.stop();
		localStream = null;
	}
}

export async function acquireLocalMic(): Promise<{ ok: true } | { ok: false; errorKey: string }> {
	if (localStream) return { ok: true };
	if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
		return { ok: false, errorKey: 'chatVoiceInsecureContext' };
	}
	try {
		localStream = await navigator.mediaDevices.getUserMedia({
			audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
		});
		return { ok: true };
	} catch {
		return { ok: false, errorKey: 'chatCallMicError' };
	}
}

async function fetchIceServers(): Promise<RTCIceServer[]> {
	try {
		const res = await fetch('/api/chat/call/ice', { cache: 'no-store' });
		if (!res.ok) return [{ urls: 'stun:stun.l.google.com:19302' }];
		const data = (await res.json()) as { iceServers?: RTCIceServer[] };
		return Array.isArray(data.iceServers) && data.iceServers.length > 0
			? data.iceServers
			: [{ urls: 'stun:stun.l.google.com:19302' }];
	} catch {
		return [{ urls: 'stun:stun.l.google.com:19302' }];
	}
}

export async function postCallSignal(
	callId: string,
	toUserId: string,
	kind: 'offer' | 'answer' | 'ice',
	payload: unknown
) {
	await fetch('/api/chat/call/signal', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ callId, toUserId, kind, payload }),
	}).catch((err) => {
		console.warn('[WebRTC] Failed to post signal:', err);
	});
}

export async function getOrCreatePeer(
	callId: string,
	peerUserId: string,
	initiator: boolean
): Promise<RTCPeerConnection> {
	const existing = peerConnections.get(peerUserId);
	if (existing) return existing;

	const iceServers = await fetchIceServers();
	const pc = new RTCPeerConnection({ iceServers });
	peerConnections.set(peerUserId, pc);

	if (localStream) {
		for (const track of localStream.getTracks()) {
			pc.addTrack(track, localStream);
		}
	}

	pc.onicecandidate = (ev) => {
		if (ev.candidate) {
			void postCallSignal(callId, peerUserId, 'ice', ev.candidate.toJSON());
		}
	};

	pc.ontrack = (ev) => {
		const stream = ev.streams[0];
		if (!stream || typeof document === 'undefined') return;
		let audio = remoteAudioEls.get(peerUserId);
		if (!audio) {
			audio = document.createElement('audio');
			audio.autoplay = true;
			audio.style.display = 'none';
			document.body.appendChild(audio);
			remoteAudioEls.set(peerUserId, audio);
		}
		audio.srcObject = stream;
		void audio.play().catch((err) => {
			console.warn('[WebRTC] Remote audio playback blocked:', err);
		});
	};

	if (initiator) {
		const offer = await pc.createOffer();
		await pc.setLocalDescription(offer);
		await postCallSignal(callId, peerUserId, 'offer', offer);
	}
	return pc;
}

export async function pollAndApplySignals(callId: string, sinceTimestamp: number): Promise<number> {
	let maxAt = sinceTimestamp;
	try {
		const res = await fetch(
			`/api/chat/call/signal?callId=${encodeURIComponent(callId)}&since=${sinceTimestamp}`,
			{ cache: 'no-store' }
		);
		if (!res.ok) return maxAt;
		const data = (await res.json()) as {
			signals?: Array<{
				fromUserId: string;
				kind: 'offer' | 'answer' | 'ice';
				payload: RTCSessionDescriptionInit & RTCIceCandidateInit;
				createdAt: number;
			}>;
		};
		for (const sig of data.signals || []) {
			if (sig.createdAt > maxAt) maxAt = sig.createdAt;
			const pc = await getOrCreatePeer(callId, sig.fromUserId, false);
			if (sig.kind === 'offer') {
				await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
				const ans = await pc.createAnswer();
				await pc.setLocalDescription(ans);
				await postCallSignal(callId, sig.fromUserId, 'answer', ans);
			} else if (sig.kind === 'answer') {
				if (pc.signalingState === 'have-local-offer') {
					await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
				}
			} else if (sig.kind === 'ice' && sig.payload) {
				await pc.addIceCandidate(new RTCIceCandidate(sig.payload)).catch((err) => {
					console.warn('[WebRTC] ICE candidate error:', err);
				});
			}
		}
	} catch (err) {
		console.warn('[WebRTC] Signal poll error:', err);
	}
	return maxAt;
}
