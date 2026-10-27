'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Terminal as XTerm } from '@xterm/xterm';
import { useI18n } from '@/core/i18n';
import { useShellActions } from '@/core/shell';
import type { MenuItem } from '@/types/workspace';
import type { NavigatorWithKeyboardLock } from '../types';
import {
	ArrowRightLeft,
	ClipboardPaste,
	Columns2,
	Copy,
	Layers,
	LogOut,
	Maximize2,
	PlusSquare,
	RotateCw,
	Rows2,
	TextSelect,
	Trash2,
	XCircle,
} from 'lucide-react';

interface UseTerminalShortcutsOptions {
	isAllowed: boolean;
	terminalInstanceRef: React.RefObject<XTerm | null>;
	sendInputRef: React.RefObject<(data: string) => void>;
	hasSelection: boolean;
	initTerminal: () => void;
	handleCloseWindow: () => void;
}

export function useTerminalShortcuts({
	isAllowed,
	terminalInstanceRef,
	sendInputRef,
	hasSelection,
	initTerminal,
	handleCloseWindow,
}: UseTerminalShortcutsOptions) {
	const { t } = useI18n();
	const { registerAppContextMenu } = useShellActions();
	const [copied, setCopied] = useState(false);

	const initTerminalRef = React.useRef(initTerminal);
	React.useEffect(() => {
		initTerminalRef.current = initTerminal;
	}, [initTerminal]);

	const handleClear = useCallback(() => {
		if (terminalInstanceRef.current) {
			terminalInstanceRef.current.clear();
		}
		sendInputRef.current?.('\x0c');
		terminalInstanceRef.current?.focus();
	}, [terminalInstanceRef, sendInputRef]);

	const handleRestart = useCallback(() => {
		initTerminalRef.current();
	}, []);

	const handleCopySelection = useCallback(() => {
		if (terminalInstanceRef.current) {
			const selection = terminalInstanceRef.current.getSelection();
			if (selection) {
				navigator.clipboard.writeText(selection);
				setCopied(true);
				setTimeout(() => setCopied(false), 2000);
			}
		}
	}, [terminalInstanceRef]);

	const handlePaste = useCallback(async () => {
		try {
			const text = await navigator.clipboard.readText();
			if (text) {
				sendInputRef.current?.(text);
				terminalInstanceRef.current?.focus();
			}
		} catch (err) {
			console.error('Failed to paste to terminal:', err);
		}
	}, [terminalInstanceRef, sendInputRef]);

	const handleSelectAll = useCallback(() => {
		if (terminalInstanceRef.current) {
			terminalInstanceRef.current.selectAll();
		}
	}, [terminalInstanceRef]);

	const sendTmuxCommand = useCallback(
		(seq: string) => {
			sendInputRef.current?.(seq);
			terminalInstanceRef.current?.focus();
		},
		[terminalInstanceRef, sendInputRef]
	);

	const menuItems: MenuItem[] = useMemo(() => {
		if (!isAllowed) return [];
		return [
			{
				id: 'term-copy',
				label: t('termCopy'),
				icon: <Copy size={14} strokeWidth={1.5} />,
				shortcut: '⌘C',
				disabled: !hasSelection,
				action: handleCopySelection,
			},
			{
				id: 'term-paste',
				label: t('termPaste'),
				icon: <ClipboardPaste size={14} strokeWidth={1.5} />,
				shortcut: '⌘V',
				action: handlePaste,
			},
			{
				id: 'term-select-all',
				label: t('termSelectAll'),
				icon: <TextSelect size={14} strokeWidth={1.5} />,
				shortcut: '⌘A',
				action: handleSelectAll,
			},
			{ id: 'sep-1', label: '', separator: true },
			{
				id: 'term-clear',
				label: t('termClearScreen'),
				icon: <Trash2 size={14} strokeWidth={1.5} />,
				shortcut: '⌃L',
				action: handleClear,
			},
			{
				id: 'term-restart',
				label: t('termRestartShell'),
				icon: <RotateCw size={14} strokeWidth={1.5} />,
				shortcut: '⌃R',
				action: handleRestart,
			},
			{ id: 'sep-2', label: '', separator: true },
			{
				id: 'term-tmux',
				label: t('termTmuxShortcuts'),
				icon: <Layers size={14} strokeWidth={1.5} />,
				badge: '⌃B',
				children: [
					{
						id: 'tmux-new-window',
						label: t('termTmuxNewWindow'),
						icon: <PlusSquare size={14} strokeWidth={1.5} />,
						shortcut: '⌃B C',
						action: () => sendTmuxCommand('\x02c'),
					},
					{
						id: 'tmux-split-h',
						label: t('termSplitHorizontal'),
						icon: <Rows2 size={14} strokeWidth={1.5} />,
						shortcut: '⌃B "',
						action: () => sendTmuxCommand('\x02"'),
					},
					{
						id: 'tmux-split-v',
						label: t('termSplitVertical'),
						icon: <Columns2 size={14} strokeWidth={1.5} />,
						shortcut: '⌃B %',
						action: () => sendTmuxCommand('\x02%'),
					},
					{
						id: 'tmux-next-pane',
						label: t('termNextPane'),
						icon: <ArrowRightLeft size={14} strokeWidth={1.5} />,
						shortcut: '⌃B O',
						action: () => sendTmuxCommand('\x02o'),
					},
					{
						id: 'tmux-zoom-pane',
						label: t('termZoomPane'),
						icon: <Maximize2 size={14} strokeWidth={1.5} />,
						shortcut: '⌃B Z',
						action: () => sendTmuxCommand('\x02z'),
					},
					{ id: 'tmux-sep-1', label: '', separator: true },
					{
						id: 'tmux-detach',
						label: t('termDetach'),
						icon: <LogOut size={14} strokeWidth={1.5} />,
						shortcut: '⌃B D',
						action: () => sendTmuxCommand('\x02d'),
					},
				],
			},
			{ id: 'sep-3', label: '', separator: true },
			{
				id: 'term-close',
				label: t('termCloseWindow'),
				icon: <XCircle size={14} strokeWidth={1.5} />,
				shortcut: '⌘W',
				action: handleCloseWindow,
			},
		];
	}, [
		isAllowed,
		t,
		hasSelection,
		handleCopySelection,
		handlePaste,
		handleSelectAll,
		handleClear,
		handleRestart,
		sendTmuxCommand,
		handleCloseWindow,
	]);

	useEffect(() => {
		if (!isAllowed) return;
		registerAppContextMenu('terminal', menuItems);
	}, [isAllowed, menuItems, registerAppContextMenu]);

	useEffect(() => {
		return () => {
			registerAppContextMenu('terminal', null);
		};
	}, [registerAppContextMenu]);

	useEffect(() => {
		const keyboard = typeof navigator !== 'undefined' ? (navigator as NavigatorWithKeyboardLock).keyboard : undefined;
		if (keyboard?.lock) {
			try {
				keyboard.lock().catch(() => {});
			} catch {}
		}
		return () => {
			if (keyboard?.unlock) {
				try {
					keyboard.unlock();
				} catch {}
			}
		};
	}, []);

	return {
		copied,
		handleClear,
		handleRestart,
		handleCopySelection,
		handlePaste,
		handleSelectAll,
		sendTmuxCommand,
	};
}
