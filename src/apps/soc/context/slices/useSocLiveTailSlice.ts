'use client';

import { useEffect, useRef } from 'react';
import { parseSseJson } from '@/lib/sse/protocol';
import type { SystemLog } from '../../types';

interface LiveTailSliceDeps {
	liveTail: boolean;
	canView: boolean;
	forensicLog: SystemLog | null;
	expandedLogIds: Set<number>;
	siemPage: number;
	siemLimit: number;
	setSiemLogs: React.Dispatch<React.SetStateAction<SystemLog[]>>;
}

export function useSocLiveTailSlice({
	liveTail,
	canView,
	forensicLog,
	expandedLogIds,
	siemPage,
	siemLimit,
	setSiemLogs,
}: LiveTailSliceDeps) {
	const forensicLogRef = useRef(forensicLog);
	const expandedLogIdsRef = useRef(expandedLogIds);
	const siemPageRef = useRef(siemPage);
	const siemLimitRef = useRef(siemLimit);

	useEffect(() => {
		forensicLogRef.current = forensicLog;
		expandedLogIdsRef.current = expandedLogIds;
		siemPageRef.current = siemPage;
		siemLimitRef.current = siemLimit;
	}, [forensicLog, expandedLogIds, siemPage, siemLimit]);

	useEffect(() => {
		if (!liveTail || !canView) return;
		let stopped = false;
		let es: EventSource | null = null;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
		const incomingBuffer: SystemLog[] = [];
		let rafId: number | null = null;

		const clearReconnect = () => {
			if (reconnectTimer) {
				clearTimeout(reconnectTimer);
				reconnectTimer = null;
			}
		};

		const closeStream = () => {
			clearReconnect();
			if (es) {
				es.close();
				es = null;
			}
		};

		const flushBuffer = () => {
			rafId = null;
			if (incomingBuffer.length === 0) return;
			const batch = incomingBuffer.splice(0, incomingBuffer.length);

			setSiemLogs((prev) => {
				const existingIds = new Set(prev.map((l) => l.id));
				const novel = batch.filter((l) => !existingIds.has(l.id));
				if (novel.length === 0) return prev;
				const limit = siemLimitRef.current || 50;
				return [...novel.reverse(), ...prev].slice(0, limit);
			});
		};

		const connect = () => {
			if (stopped || es !== null) return;
			if (typeof document !== 'undefined' && document.hidden) return;
			try {
				es = new EventSource('/api/soc/stream');
				const handleLogMessage = (event: MessageEvent) => {
					if (typeof document !== 'undefined' && document.hidden) return;
					const raw = parseSseJson<{ log?: SystemLog } | SystemLog>(event.data);
					const log = (
						raw && typeof raw === 'object' && 'log' in raw ? raw.log : raw
					) as SystemLog | null | undefined;
					if (log && typeof log.id === 'number') {
						if (
							forensicLogRef.current !== null ||
							expandedLogIdsRef.current.size > 0 ||
							siemPageRef.current > 1
						) {
							return;
						}
						incomingBuffer.push(log);
						if (rafId === null) {
							rafId = requestAnimationFrame(flushBuffer);
						}
					}
				};

				es.addEventListener('log', handleLogMessage);
				es.onmessage = handleLogMessage;

				es.onerror = () => {
					if (es) {
						es.close();
						es = null;
					}
					if (stopped || (typeof document !== 'undefined' && document.hidden)) return;
					if (!reconnectTimer) {
						reconnectTimer = setTimeout(() => {
							reconnectTimer = null;
							connect();
						}, 5000);
					}
				};
			} catch (err) {
				console.warn('[SoC] Failed to initialize live tail stream:', err);
			}
		};

		const onVisibilityChange = () => {
			if (typeof document === 'undefined') return;
			if (document.hidden) {
				closeStream();
			} else {
				connect();
			}
		};

		if (typeof document !== 'undefined') {
			document.addEventListener('visibilitychange', onVisibilityChange);
		}
		connect();

		return () => {
			stopped = true;
			if (typeof document !== 'undefined') {
				document.removeEventListener('visibilitychange', onVisibilityChange);
			}
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
			}
			incomingBuffer.length = 0;
			closeStream();
		};
	}, [liveTail, canView, setSiemLogs]);
}
