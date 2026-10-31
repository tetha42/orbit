'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceRecorderError = 'unsupported' | 'permission' | 'failed' | null;

function voiceExtension(mime: string): string {
	if (mime.includes('mp4')) return '.m4a';
	if (mime.includes('ogg')) return '.ogg';
	return '.weba';
}

function chooseMimeType(): string {
	if (typeof MediaRecorder === 'undefined') return '';
	const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
	return candidates.find((type) => {
		try {
			return MediaRecorder.isTypeSupported(type);
		} catch {
			return false;
		}
	}) ?? '';
}

function stopStream(stream: MediaStream | null): void {
	stream?.getTracks().forEach((track) => track.stop());
}

/**
 * Small MediaRecorder wrapper shared by the desktop and mobile composers.
 * `stop()` resolves with a File ready for the normal chat upload endpoint;
 * `cancel()` stops and discards the current take.
 */
export function useVoiceRecorder() {
	const [isRecording, setIsRecording] = useState(false);
	const [seconds, setSeconds] = useState(0);
	const [error, setError] = useState<VoiceRecorderError>(null);
	const recorderRef = useRef<MediaRecorder | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const discardRef = useRef(false);
	const mountedRef = useRef(true);

	const cleanup = useCallback(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
		stopStream(streamRef.current);
		streamRef.current = null;
		recorderRef.current = null;
		chunksRef.current = [];
		setIsRecording(false);
		setSeconds(0);
	}, []);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			discardRef.current = true;
			try {
				if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
			} catch {
				// A recorder that has already stopped is fine.
			}
			cleanup();
		};
	}, [cleanup]);

	const start = useCallback(async (): Promise<boolean> => {
		setError(null);
		if (
			typeof navigator === 'undefined' ||
			!navigator.mediaDevices?.getUserMedia ||
			typeof MediaRecorder === 'undefined'
		) {
			setError('unsupported');
			return false;
		}
		if (recorderRef.current) return false;
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			if (!mountedRef.current) {
				stopStream(stream);
				return false;
			}
			const mimeType = chooseMimeType();
			const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
			recorderRef.current = recorder;
			recorder.onerror = () => setError('failed');
			streamRef.current = stream;
			chunksRef.current = [];
			discardRef.current = false;
			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) chunksRef.current.push(event.data);
			};
			recorder.start(250);
			setIsRecording(true);
			setSeconds(0);
			const startedAt = Date.now();
			timerRef.current = setInterval(() => {
				if (mountedRef.current) setSeconds(Math.floor((Date.now() - startedAt) / 1000));
			}, 250);
			return true;
		} catch (err) {
			const denied = typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'NotAllowedError';
			setError(denied ? 'permission' : 'failed');
			cleanup();
			return false;
		}
	}, [cleanup]);

	const stop = useCallback(async (): Promise<File | null> => {
		const recorder = recorderRef.current;
		if (!recorder) return null;
		if (recorder.state === 'inactive') {
			cleanup();
			return null;
		}
		const mimeType = recorder.mimeType || 'audio/webm';
		return new Promise((resolve) => {
			let settled = false;
			const finish = (file: File | null) => {
				if (settled) return;
				settled = true;
				resolve(file);
			};
			const timeout = setTimeout(() => {
				cleanup();
				finish(null);
			}, 2500);
			recorder.onstop = () => {
				clearTimeout(timeout);
				const shouldDiscard = discardRef.current;
				const chunks = chunksRef.current;
				cleanup();
				if (shouldDiscard || chunks.length === 0) {
					finish(null);
					return;
				}
				const blob = new Blob(chunks, { type: mimeType });
				finish(
					new File([blob], `voice-${Date.now()}${voiceExtension(mimeType)}`, {
						type: mimeType,
					})
				);
			};
			try {
				if (recorder.state === 'recording') recorder.requestData();
				recorder.stop();
			} catch {
				clearTimeout(timeout);
				cleanup();
				finish(null);
			}
		});
	}, [cleanup]);

	const cancel = useCallback(async (): Promise<void> => {
		discardRef.current = true;
		await stop();
		discardRef.current = false;
	}, [stop]);

	return { isRecording, seconds, error, start, stop, cancel };
}
