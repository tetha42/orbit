'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Terminal as XTerm } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';
import { useI18n } from '@/core/i18n';
import { useWindowActions } from '@/core/windows';
import { errorMessage } from '@/lib/errors';
import contract from '../terminal.contract.json';
import type { TerminalDimensions, TerminalStatus } from '../types';
import { attachTerminalKeyHandlers, buildXTermOptions } from '../utils/xtermConfig';
import { connectTerminalStream } from '../utils/terminalStream';

interface UseTerminalSessionOptions {
	isAllowed: boolean;
	isLight: boolean;
	containerRef: React.RefObject<HTMLDivElement | null>;
	onIdleTimeout?: () => void;
	onInitError?: (err: string) => void;
}

const IDLE_TIMEOUT_MS = contract.limits.sessionTimeoutSeconds * 1000;

export function useTerminalSession({
	isAllowed,
	isLight,
	containerRef,
	onIdleTimeout,
	onInitError,
}: UseTerminalSessionOptions) {
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
			} catch {
				// EventSource may already be closed during cleanup.
			}
			eventSourceRef.current = null;
		}
		if (sessionIdRef.current) {
			const sid = sessionIdRef.current;
			sessionIdRef.current = null;
			fetch(`/api/terminal/session?sessionId=${sid}`, { method: 'DELETE' }).catch(() => {});
		}
		if (terminalInstanceRef.current) {
			try {
				terminalInstanceRef.current.dispose();
			} catch {
				// Terminal instance may already be disposed during unmount.
			}
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
		setTimeout(() => closeApp('terminal'), 80);
	}, [cleanupSession, closeApp]);

	const initTerminal = useCallback(
		async (twoFactorCode?: string) => {
			if (!isAllowed || !containerRef.current) return;
			cleanupSession();
			const currentInit = ++initCounterRef.current;
			isClosingWindowRef.current = false;

			try {
				setStatus('connecting');
				setStatusMessage(t('termStarting'));
				const [{ Terminal }, { FitAddon }] = await Promise.all([
					import('@xterm/xterm'),
					import('@xterm/addon-fit'),
				]);

				if (currentInit !== initCounterRef.current || isClosingWindowRef.current || !containerRef.current) return;
				containerRef.current.innerHTML = '';

				const term = new Terminal(buildXTermOptions(isLightRef.current));
				attachTerminalKeyHandlers(term);

				const fitAddon = new FitAddon();
				term.loadAddon(fitAddon);
				term.open(containerRef.current);
				try {
					fitAddon.fit();
				} catch {
					// Initial fit can throw before container layout completes; ResizeObserver re-fits.
				}

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
					const contractErr = contract.errorCodes.find((e) => e.code === errData?.errorCode);
					throw new Error(contractErr ? t(contractErr.i18nKey) : errData.error || t('termFailed'));
				}

				const { sessionId } = await sessionRes.json();
				if (currentInit !== initCounterRef.current || isClosingWindowRef.current) {
					if (sessionId) fetch(`/api/terminal/session?sessionId=${sessionId}`, { method: 'DELETE' }).catch(() => {});
					return;
				}
				sessionIdRef.current = sessionId;

				const sendData = connectTerminalStream({
					sessionId,
					currentInit,
					initCounterRef,
					eventSourceRef,
					sessionIdRef,
					hasConnectedRef,
					term,
					onConnected: () => {
						setStatus('connected');
						setStatusMessage(t('termConnected'));
						resetIdleTimer();
					},
					onDisconnected: () => {
						setStatus('disconnected');
						setStatusMessage(t('termDisconnected'));
					},
					onCloseWindow: handleCloseWindow,
					onActivity: resetIdleTimer,
				});

				sendInputRef.current = sendData;
				term.onData((data) => sendData(data));
				term.onSelectionChange(() => setHasSelection(term.hasSelection()));
			} catch (err) {
				const msg = errorMessage(err, t('termGeneralError'));
				setStatus('error');
				setStatusMessage(msg);
				onInitErrorRef.current?.(msg);
			}
		},
		[isAllowed, t, cleanupSession, handleCloseWindow, containerRef, resetIdleTimer]
	);

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
