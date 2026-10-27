'use client';

import { useEffect, type RefObject } from 'react';
import type { Terminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';
import { DARK_XTERM_THEME, LIGHT_XTERM_THEME } from '../components/themes';

interface UseTerminalLifecycleProps {
	isAllowed: boolean;
	is2FaVerified: boolean;
	twoFactorCode?: string;
	isMinimized: boolean;
	isActive: boolean;
	isLight: boolean;
	containerRef: RefObject<HTMLDivElement | null>;
	terminalInstanceRef: RefObject<Terminal | null>;
	fitAddonRef: RefObject<FitAddon | null>;
	sessionIdRef: RefObject<string | null>;
	resizeTimerRef: RefObject<NodeJS.Timeout | null>;
	lastGeometryRef: RefObject<{ cols: number; rows: number }>;
	setDimensions: (dim: { cols: number; rows: number }) => void;
	initTerminal: (code?: string) => Promise<void>;
	cleanupSession: () => void;
}

export function useTerminalLifecycle({
	isAllowed,
	is2FaVerified,
	twoFactorCode,
	isMinimized,
	isActive,
	isLight,
	containerRef,
	terminalInstanceRef,
	fitAddonRef,
	sessionIdRef,
	resizeTimerRef,
	lastGeometryRef,
	setDimensions,
	initTerminal,
	cleanupSession,
}: UseTerminalLifecycleProps) {
	useEffect(() => {
		if (!isAllowed || !is2FaVerified) return;

		void initTerminal(twoFactorCode);

		const handleResize = () => {
			if (!fitAddonRef.current || !terminalInstanceRef.current) return;
			try {
				fitAddonRef.current.fit();
				const term = terminalInstanceRef.current;
				const newCols = term.cols;
				const newRows = term.rows;

				if (
					newCols > 10 &&
					newRows > 4 &&
					(newCols !== lastGeometryRef.current.cols || newRows !== lastGeometryRef.current.rows)
				) {
					lastGeometryRef.current = { cols: newCols, rows: newRows };
					setDimensions({ cols: newCols, rows: newRows });

					if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);

					resizeTimerRef.current = setTimeout(() => {
						if (sessionIdRef.current) {
							fetch('/api/terminal/resize', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({ sessionId: sessionIdRef.current, cols: newCols, rows: newRows }),
							}).catch((err) => {
								console.error('[Terminal] Failed to post resize:', err);
							});
						}
					}, 50);
				}
			} catch {}
		};

		const resizeObserver = new ResizeObserver(handleResize);
		if (containerRef.current) resizeObserver.observe(containerRef.current);
		window.addEventListener('resize', handleResize);

		return () => {
			resizeObserver.disconnect();
			window.removeEventListener('resize', handleResize);
			cleanupSession();
		};
	}, [
		isAllowed,
		is2FaVerified,
		twoFactorCode,
		initTerminal,
		cleanupSession,
		fitAddonRef,
		terminalInstanceRef,
		lastGeometryRef,
		resizeTimerRef,
		sessionIdRef,
		setDimensions,
		containerRef,
	]);

	useEffect(() => {
		if (!isMinimized && terminalInstanceRef.current && fitAddonRef.current) {
			const timer = setTimeout(() => {
				try {
					fitAddonRef.current?.fit();
					terminalInstanceRef.current?.focus();
				} catch {}
			}, 60);
			return () => clearTimeout(timer);
		}
	}, [isMinimized, terminalInstanceRef, fitAddonRef]);

	useEffect(() => {
		if (isActive && !isMinimized && terminalInstanceRef.current) {
			const timer = setTimeout(() => {
				try {
					terminalInstanceRef.current?.focus();
				} catch {}
			}, 30);
			return () => clearTimeout(timer);
		}
	}, [isActive, isMinimized, terminalInstanceRef]);

	useEffect(() => {
		if (terminalInstanceRef.current) {
			terminalInstanceRef.current.options.theme = isLight ? LIGHT_XTERM_THEME : DARK_XTERM_THEME;
		}
	}, [isLight, terminalInstanceRef]);
}
