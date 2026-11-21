'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from '@/core/session';
import { useIsMounted } from '@/lib/client/useClientValue';
import { DialogView } from './dialog/DialogView';
import type {
	DialogApi,
	DialogKind,
	DialogOptions,
	DialogRequest,
	PromptDialogOptions,
	SelectDialogOptions,
} from './dialog/types';

export type {
	DialogApi,
	DialogOptions,
	DialogTone,
	PromptDialogOptions,
	SelectDialogOption,
	SelectDialogOptions,
} from './dialog/types';

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
	const ctx = useContext(DialogContext);
	if (!ctx) throw new Error('useDialog must be used within a DialogProvider');
	return ctx;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
	const { isLocked } = useSession();
	const isMounted = useIsMounted();
	const [queue, setQueue] = useState<DialogRequest[]>([]);
	const nextId = useRef(1);

	const enqueue = useCallback(
		(
			kind: DialogKind,
			options: (DialogOptions & Partial<PromptDialogOptions> & Partial<SelectDialogOptions>) | string
		) =>
			new Promise<{ accepted: boolean; value?: string }>((resolve) => {
				const normalized = typeof options === 'string' ? { message: options } : options;
				setQueue((current) => [
					...current,
					{ id: nextId.current++, kind, options: normalized, resolve },
				]);
			}),
		[]
	);

	const api = useMemo<DialogApi>(
		() => ({
			alert: async (options) => {
				await enqueue('alert', options);
			},
			confirm: async (options) => {
				const res = await enqueue('confirm', options);
				return res.accepted;
			},
			prompt: async (options) => {
				const res = await enqueue('prompt', options);
				return res.accepted ? (res.value ?? '') : null;
			},
			select: async (options) => {
				const res = await enqueue('select', options);
				return res.accepted ? (res.value ?? null) : null;
			},
		}),
		[enqueue]
	);

	const current = queue[0];

	const settle = useCallback(
		(accepted: boolean, value?: string) => {
			if (!current) return;
			current.resolve({ accepted, value });
			setQueue((items) => items.filter((item) => item.id !== current.id));
		},
		[current]
	);

	return (
		<DialogContext.Provider value={api}>
			{children}
			{isMounted && current && !isLocked
				? createPortal(<DialogView key={current.id} request={current} onSettle={settle} />, document.body)
				: null}
		</DialogContext.Provider>
	);
}
