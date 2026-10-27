'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Terminal as XTerm } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';
import { useI18n } from '@/core/i18n';
import { useWindowActions } from '@/core/windows';
import { errorMessage } from '@/lib/errors';
import type { TerminalDimensions, TerminalStatus } from '../types';
import { DARK_XTERM_THEME, LIGHT_XTERM_THEME } from '../components/themes';

interface UseTerminalSessionOptions {
	isAllowed: boolean;
	isLight: boolean;
	containerRef: React.RefObject<HTMLDivElement | null>;
	onIdleTimeout?: () => void;
	onInitError?: (err: string) => void;
}

const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes inactivity limit

export function useTerminalSession({ isAllowed, isLight, containerRef, onIdleTimeout, onInitError }: UseTerminalSessionOptions) {
	const { t } = useI18n();
	const { closeApp } = useWindowActions();

	const isLightRef = useRef(isLight);
	useEffect(() => {
		isLightRef.current = isLight;
	}, [isLight]);

	const onIdleTimeoutRef = useRef(onIdleTimeout);
	useEffect(() => {
		onIdleTimeoutRef.current = onIdleTimeout;
	}, [onIdleTimeout]);

	const onInitErrorRef = useRef(onInitError);
	useEffect(() => {
		onInitErrorRef.current = onInitError;
	}, [onInitError]);

	const terminalInstanceRef = useRef<XTerm | null>(null);
	const fitAddonRef = useRef<FitAddon | null>(null);
	const eventSourceRef = useRef<EventSource | null>(null);
	const sessionIdRef = useRef<string | null>(null);
	const sendInputRef = useRef<(data: string) => void>(() => {});
	const resizeTimerRef = useRef<NodeJS.Timeout | null>(null);
	const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
	const lastGeometryRef = useRef<{ cols: number; rows: number }>({ cols: 80, rows: 24 });
	const hasConnectedRef = useRef(false);
	const isClosingWindowRef = useRef(false);
	const initCounterRef = useRef(0);

	const [status, setStatus] = useState<TerminalStatus>('connecting');
	const [statusMessage, setStatusMessage] = useState<string>(() => t('termStarting'));
	const [dimensions, setDimensions] = useState<TerminalDimensions>({ cols: 80, rows: 24 });
	const [hasSelection, setHasSelection] = useState(false);

	const cleanupSession = useCallback(() => {
		initCounterRef.current++;
		if (resizeTimerRef.current) {
			clearTimeout(resizeTimerRef.current);
			resizeTimerRef.current = null;
		}
		if (idleTimerRef.current) {
			clearTimeout(idleTimerRef.current);
			idleTimerRef.current = null;
		}
		if (eventSourceRef.current) {
			try {
				eventSourceRef.current.close();
			} catch {}
			eventSourceRef.current = null;
		}
		if (sessionIdRef.current) {
			const sid = sessionIdRef.current;
			sessionIdRef.current = null;
			fetch(`/api/terminal/session?sessionId=${sid}`, {
				method: 'DELETE',
			}).catch(() => {});
		}
		if (terminalInstanceRef.current) {
			try {
				terminalInstanceRef.current.dispose();
			} catch {}
			terminalInstanceRef.current = null;
		}
		sendInputRef.current = () => {};
		fitAddonRef.current = null;
	}, []);

	const resetIdleTimer = useCallback(() => {
		if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
		idleTimerRef.current = setTimeout(() => {
			cleanupSession();
			onIdleTimeoutRef.current?.();
		}, IDLE_TIMEOUT_MS);
	}, [cleanupSession]);

	const handleCloseWindow = useCallback(() => {
		if (isClosingWindowRef.current) return;
		isClosingWindowRef.current = true;
		cleanupSession();
		setTimeout(() => {
			closeApp('terminal');
		}, 80);
	}, [cleanupSession, closeApp]);

	const initTerminal = useCallback(async (twoFactorCode?: string) => {
		if (!isAllowed || !containerRef.current) return;

		cleanupSession();
		const currentInit = ++initCounterRef.current;
		isClosingWindowRef.current = false;

		try {
			setStatus('connecting');
			setStatusMessage(t('termStarting'));

			const { Terminal } = await import('@xterm/xterm');
			const { FitAddon } = await import('@xterm/addon-fit');

			if (currentInit !== initCounterRef.current || isClosingWindowRef.current || !containerRef.current) return;

			containerRef.current.innerHTML = '';

			const term = new Terminal({
				cursorBlink: true,
				cursorStyle: 'block',
				fontFamily: 'Menlo, Monaco, "Courier New", monospace, Consolas',
				fontSize: 13,
				fontWeight: '500',
				fontWeightBold: '700',
				lineHeight: 1.25,
				letterSpacing: 0.5,
				drawBoldTextInBrightColors: true,
				minimumContrastRatio: 4.5,
				macOptionIsMeta: true,
				altClickMovesCursor: false,
				scrollback: 10000,
				convertEol: false,
				smoothScrollDuration: 0,
				theme: isLightRef.current ? LIGHT_XTERM_THEME : DARK_XTERM_THEME,
				allowProposedApi: true,
			});

			term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
				if (event.type !== 'keydown') return true;

				if (
					(event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'c' && term.hasSelection()) ||
					(!event.metaKey && event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'c' && term.hasSelection())
				) {
					return true;
				}

				if (
					(event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'v') ||
					(!event.metaKey && event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'v')
				) {
					return true;
				}

				if (event.ctrlKey && !event.metaKey) {
					event.preventDefault();
					event.stopPropagation();
					return true;
				}

				if (event.altKey && !event.metaKey) {
					event.preventDefault();
					event.stopPropagation();
					return true;
				}

				if (event.ctrlKey && event.altKey) {
					event.preventDefault();
					event.stopPropagation();
					return true;
				}

				if (event.key === 'Tab') {
					event.preventDefault();
					event.stopPropagation();
					return true;
				}

				if (/^F\d+$/.test(event.key)) {
					event.preventDefault();
					event.stopPropagation();
					return true;
				}

				if (event.key === 'Escape') {
					event.stopPropagation();
					return true;
				}

				return true;
			});

			const fitAddon = new FitAddon();
			term.loadAddon(fitAddon);
			term.open(containerRef.current);

			try {
				fitAddon.fit();
			} catch {}

			const initialCols = term.cols > 10 ? term.cols : 80;
			const initialRows = term.rows > 4 ? term.rows : 24;

			lastGeometryRef.current = { cols: initialCols, rows: initialRows };
			setDimensions({ cols: initialCols, rows: initialRows });

			terminalInstanceRef.current = term;
			fitAddonRef.current = fitAddon;

			const sessionRes = await fetch('/api/terminal/session', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ cols: initialCols, rows: initialRows, code: twoFactorCode }),
			});

			if (!sessionRes.ok) {
				const errData = await sessionRes.json().catch(() => ({}));
				throw new Error(errData.error || t('termFailed'));
			}

			const { sessionId } = await sessionRes.json();
			if (currentInit !== initCounterRef.current || isClosingWindowRef.current) {
				if (sessionId) {
					fetch(`/api/terminal/session?sessionId=${sessionId}`, { method: 'DELETE' }).catch(() => {});
				}
				return;
			}
			sessionIdRef.current = sessionId;

			const es = new EventSource(`/api/terminal/stream?sessionId=${sessionId}`);
			eventSourceRef.current = es;

			es.onopen = () => {
				if (currentInit !== initCounterRef.current) {
					try {
						es.close();
					} catch {}
					return;
				}
				hasConnectedRef.current = true;
				setStatus('connected');
				setStatusMessage(t('termConnected'));
				resetIdleTimer();
			};

			es.onmessage = (event) => {
				if (currentInit !== initCounterRef.current) return;
				try {
					const chunk = JSON.parse(event.data);
					term.write(chunk);
				} catch {
					term.write(event.data);
				}
			};

			es.addEventListener('exit', () => {
				try {
					es.close();
				} catch {}
				if (eventSourceRef.current === es) eventSourceRef.current = null;
				handleCloseWindow();
			});

			es.onerror = () => {
				try {
					es.close();
				} catch {}
				if (eventSourceRef.current === es) eventSourceRef.current = null;
				if (hasConnectedRef.current) {
					handleCloseWindow();
				} else {
					setStatus('disconnected');
					setStatusMessage(t('termDisconnected'));
				}
			};

			const inputQueue: string[] = [];
			let isFlushing = false;

			const flushQueue = async () => {
				if (isFlushing || inputQueue.length === 0 || !sessionIdRef.current) return;
				isFlushing = true;
				const currentSid = sessionIdRef.current;
				const data = inputQueue.join('');
				inputQueue.length = 0;

				try {
					const res = await fetch('/api/terminal/input', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ sessionId: currentSid, data }),
					});
					if (res.status === 404) {
						handleCloseWindow();
						return;
					}
				} catch (err) {
					console.error('Failed to send keystroke to terminal:', err);
				} finally {
					isFlushing = false;
					if (inputQueue.length > 0 && sessionIdRef.current) {
						void flushQueue();
					}
				}
			};

			const sendData = (data: string) => {
				if (!sessionIdRef.current) return;
				resetIdleTimer();
				inputQueue.push(data);
				void flushQueue();
			};

			sendInputRef.current = sendData;
			term.onData((data) => sendData(data));
			term.onSelectionChange(() => setHasSelection(term.hasSelection()));
		} catch (err) {
			const msg = errorMessage(err, t('termGeneralError'));
			setStatus('error');
			setStatusMessage(msg);
			onInitErrorRef.current?.(msg);
		}
	}, [isAllowed, t, cleanupSession, handleCloseWindow, containerRef, resetIdleTimer]);

	return {
		terminalInstanceRef,
		fitAddonRef,
		sessionIdRef,
		sendInputRef,
		resizeTimerRef,
		lastGeometryRef,
		status,
		statusMessage,
		dimensions,
		setDimensions,
		hasSelection,
		initTerminal,
		cleanupSession,
		handleCloseWindow,
	};
}
