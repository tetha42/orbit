'use client';

import { useEffect, useRef } from 'react';
import type { AppID } from '@/types/workspace';

/**
 * Menu-bar commands addressed to one app ("new task", "print report", …).
 *
 * The menu often has to open the app first, so the command may arrive before
 * the app has mounted: it is kept briefly and handed over when the app's
 * listener appears. A command nobody claims within a few seconds is dropped —
 * otherwise opening the app much later would replay it out of the blue.
 *
 * Broadcast notices ("the roster changed") are the second half of this file;
 * commands are an instruction to one app, which may not be mounted yet.
 */
const EVENT = 'workspace:app-command';
const TTL_MS = 4000;
const pending = new Map<AppID, { command: string; at: number }>();

export function sendAppCommand(appId: AppID, command: string): void {
	pending.set(appId, { command, at: Date.now() });
	window.dispatchEvent(new CustomEvent(EVENT, { detail: { appId } }));
}

function take(appId: AppID): string | null {
	const p = pending.get(appId);
	if (!p) return null;
	pending.delete(appId);
	return Date.now() - p.at <= TTL_MS ? p.command : null;
}

/**
 * Receives the commands for `appId`. The handler returns `false` when it cannot
 * act yet (e.g. "new task" with no team open) — the command is then dropped,
 * and the handler is expected to tell the user why.
 */
export function useAppCommand(appId: AppID, handler: (command: string) => void, enabled = true): void {
	const ref = useRef(handler);
	useEffect(() => {
		ref.current = handler;
	});
	useEffect(() => {
		if (!enabled) return;
		const run = () => {
			const command = take(appId);
			if (command) ref.current(command);
		};
		// One sent before this listener existed (the menu opened the app).
		const t = window.setTimeout(run, 0);
		const onEvent = (e: Event) => {
			if ((e as CustomEvent<{ appId: AppID }>).detail?.appId === appId) run();
		};
		window.addEventListener(EVENT, onEvent);
		return () => {
			window.clearTimeout(t);
			window.removeEventListener(EVENT, onEvent);
		};
	}, [appId, enabled]);
}

/** Asks every mounted data view to fetch again ("Verileri Yenile"). */
export const REFRESH_EVENT = 'workspace:refresh';
export function refreshAllResources(): void {
	window.dispatchEvent(new Event(REFRESH_EVENT));
}

/* ---------------- broadcast notices ---------------- */


/**
 * Tiny cross-window notices between parts of the desktop that do not know each other.
 *
 * Approving an application from the notification center changes what an open
 * Members window shows; the window is not a child of the panel and refetches only
 * when it mounts. Rather than wiring one into the other, whoever changes the data
 * says so and anyone showing it listens.
 */
export type AppEventName = 'roster-changed';

const eventType = (name: AppEventName) => `beu:${name}`;

export function emitAppEvent(name: AppEventName): void {
	window.dispatchEvent(new Event(eventType(name)));
}

export function useAppEvent(name: AppEventName, handler: () => void): void {
	const handlerRef = useRef(handler);
	useEffect(() => {
		handlerRef.current = handler;
	});
	useEffect(() => {
		const listener = () => handlerRef.current();
		window.addEventListener(eventType(name), listener);
		return () => window.removeEventListener(eventType(name), listener);
	}, [name]);
}
