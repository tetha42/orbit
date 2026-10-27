'use client';

import React, { useRef, useState, useCallback } from 'react';
import '@xterm/xterm/css/xterm.css';
import { useIsActive, useWindow } from '@/core/windows';
import { useSession } from '@/core/session';
import { useTheme } from '@/core/theme';
import { useI18n } from '@/core/i18n';
import { TerminalRestricted } from './components/TerminalRestricted';
import { TerminalHeader } from './components/TerminalHeader';
import { TerminalTwoFactorPrompt } from './components/TerminalTwoFactorPrompt';
import { useTerminalSession } from './hooks/useTerminalSession';
import { useTerminalShortcuts } from './hooks/useTerminalShortcuts';
import { useTerminalLifecycle } from './hooks/useTerminalLifecycle';

/**
 * Interactive SSH & Native PTY Terminal Workspace Application.
 * Modular entry component with 2FA SUDO-gate and 60m inactivity timeout.
 */
export function TerminalApp() {
	const { t } = useI18n();
	const { currentUser, canUseApp } = useSession();
	const isMinimized = useWindow('terminal').isMinimized;
	const isActive = useIsActive('terminal');
	const isLight = !useTheme().isDark;

	const containerRef = useRef<HTMLDivElement>(null);
	const isAllowed = canUseApp('terminal');

	const [is2FaVerified, setIs2FaVerified] = useState(false);
	const [twoFactorCode, setTwoFactorCode] = useState<string>('');
	const [idleExpired, setIdleExpired] = useState(false);
	// The gate is shown again when the shell cannot start (wrong/reused TOTP,
	// rate limit, disabled terminal…). Carrying the server message into the
	// prompt stops a failed start from looking like a silent 2FA lock loop.
	const [initError, setInitError] = useState<string | null>(null);

	const handleIdleTimeout = useCallback(() => {
		setIs2FaVerified(false);
		setTwoFactorCode('');
		setIdleExpired(true);
	}, []);

	const handleInitError = useCallback((err: string) => {
		setIs2FaVerified(false);
		setTwoFactorCode('');
		setInitError(err);
	}, []);

	const {
		terminalInstanceRef,
		fitAddonRef,
		sessionIdRef,
		sendInputRef,
		resizeTimerRef,
		lastGeometryRef,
		status,
		statusMessage,
		setDimensions,
		hasSelection,
		initTerminal,
		cleanupSession,
		handleCloseWindow,
	} = useTerminalSession({
		isAllowed,
		isLight,
		containerRef,
		onIdleTimeout: handleIdleTimeout,
		onInitError: handleInitError,
	});

	const handleRestartTerminal = useCallback(() => {
		void initTerminal(twoFactorCode);
	}, [initTerminal, twoFactorCode]);

	const {
		copied,
		handleClear,
		handleRestart,
		handleCopySelection,
	} = useTerminalShortcuts({
		isAllowed,
		terminalInstanceRef,
		sendInputRef,
		hasSelection,
		initTerminal: handleRestartTerminal,
		handleCloseWindow,
	});

	useTerminalLifecycle({
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
	});

	const handleVerify2Fa = async (code: string): Promise<{ ok: boolean; error?: string }> => {
		try {
			setInitError(null);
			setTwoFactorCode(code);
			setIs2FaVerified(true);
			setIdleExpired(false);
			return { ok: true };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : t('term2faError') };
		}
	};

	if (!isAllowed) {
		return <TerminalRestricted isLight={isLight} />;
	}

	if (!is2FaVerified) {
		return (
			<TerminalTwoFactorPrompt
				isLight={isLight}
				twoFactorEnabled={Boolean(currentUser?.twoFactorEnabled)}
				idleExpired={idleExpired}
				serverError={initError}
				onSubmit={handleVerify2Fa}
			/>
		);
	}

	return (
		<div
			onClick={() => terminalInstanceRef.current?.focus()}
			onMouseDown={() => terminalInstanceRef.current?.focus()}
			style={{
				display: 'flex',
				flexDirection: 'column',
				flex: 1,
				minHeight: 0,
				height: '100%',
				background: isLight ? '#ffffff' : '#080b11',
				color: isLight ? '#0f172a' : '#f1f5f9',
				fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
			}}
		>
			<TerminalHeader
				isLight={isLight}
				isActive={isActive}
				isMinimized={isMinimized}
				status={status}
				statusMessage={statusMessage}
				copied={copied}
				onCopy={handleCopySelection}
				onClear={handleClear}
				onRestart={handleRestart}
			/>

			<div
				ref={containerRef}
				onClick={() => terminalInstanceRef.current?.focus()}
				style={{
					flex: 1,
					minHeight: 0,
					padding: '8px 12px',
					overflow: 'hidden',
					position: 'relative',
					cursor: 'text',
					background: isLight ? '#ffffff' : '#080b11',
				}}
			/>
		</div>
	);
}
