'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import ui from './ui.module.css';

/**
 * Short confirmations ("Kayıt eklendi.") and failures, for every app — one
 * provider instead of a useState + setTimeout pair in each app.
 *
 *   const notify = useToast();
 *   notify('Kaydedildi.');            // success
 *   notify(res.error, 'error');
 */
export type ToastTone = 'success' | 'error';
export type Notify = (text: string, tone?: ToastTone) => void;

interface Item {
	id: number;
	text: string;
	tone: ToastTone;
}

const ToastContext = createContext<Notify>(() => {});
const VISIBLE_MS = 3600;
const MAX_STACK = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
	const [items, setItems] = useState<Item[]>([]);
	const nextId = useRef(1);

	const notify = useCallback<Notify>((text, tone = 'success') => {
		if (!text) return;
		const id = nextId.current++;
		// The same message twice in a row replaces the first instead of stacking.
		setItems((cur) => [...cur.filter((t) => t.text !== text), { id, text, tone }].slice(-MAX_STACK));
		window.setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), VISIBLE_MS);
	}, []);

	const value = useMemo(() => notify, [notify]);
	return (
		<ToastContext.Provider value={value}>
			{children}
			<div className={ui.toastStack} role="status" aria-live="polite">
				{items.map((t) => (
					<div key={t.id} className={`${ui.toast} ${t.tone === 'error' ? ui.toastError : ui.toastSuccess}`}>
						{t.text}
					</div>
				))}
			</div>
		</ToastContext.Provider>
	);
}

export const useToast = (): Notify => useContext(ToastContext);
