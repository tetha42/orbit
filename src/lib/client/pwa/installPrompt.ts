'use client';

import { useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let justInstalled = false;
const promptListeners = new Set<() => void>();
const notifyPrompt = () => promptListeners.forEach((listener) => listener());

if (typeof window !== 'undefined') {
	const flagged = window as Window & { __orbitPwaBootstrapped?: boolean; __beuPwaBootstrapped?: boolean };
	if (!flagged.__orbitPwaBootstrapped && !flagged.__beuPwaBootstrapped) {
		flagged.__orbitPwaBootstrapped = true;
		window.addEventListener('beforeinstallprompt', (event) => {
			event.preventDefault();
			deferredPrompt = event as BeforeInstallPromptEvent;
			notifyPrompt();
		});
		window.addEventListener('appinstalled', () => {
			deferredPrompt = null;
			justInstalled = true;
			notifyPrompt();
		});
	}
}

function subscribePrompt(onChange: () => void): () => void {
	promptListeners.add(onChange);
	return () => promptListeners.delete(onChange);
}

/** True once the browser has offered the native install prompt. */
export function useCanPromptInstall(): boolean {
	return useSyncExternalStore(subscribePrompt, () => deferredPrompt !== null, () => false);
}

/** True after the browser reports the app was installed during this visit. */
export function useJustInstalled(): boolean {
	return useSyncExternalStore(subscribePrompt, () => justInstalled, () => false);
}

/** Shows the native install prompt, if the browser has offered one. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
	const event = deferredPrompt;
	if (!event) return 'unavailable';
	deferredPrompt = null;
	notifyPrompt();
	await event.prompt();
	const { outcome } = await event.userChoice;
	return outcome;
}
