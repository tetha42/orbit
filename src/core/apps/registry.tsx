'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { AppID } from '@/types/workspace';
import { APP_LOADERS } from '@/apps/loaders.gen';

/**
 * Which component is each mini app — the one list the window manager and the
 * mobile launcher both render from. (They used to keep their own copies; the
 * mobile one had fallen behind and opened News and Projects as a blank screen.)
 *
 * Each app is its own chunk, loaded the first time it opens, so the desktop no
 * longer downloads and parses every app up front. Which component belongs to
 * which app is the app's manifest (src/apps/<id>/manifest.ts); the loaders are
 * generated from it.
 */
function Loading() {
	return <div data-app-loading="" style={{ display: 'grid', placeItems: 'center', height: '100%', minHeight: 160, fontSize: 13, color: 'var(--text-secondary)' }}>Yükleniyor…</div>;
}

export const APP_COMPONENTS = Object.fromEntries(
	Object.entries(APP_LOADERS).map(([id, load]) => [id, dynamic(load, { ssr: false, loading: Loading })])
) as Record<AppID, ComponentType>;

const PREFETCHED_APPS = new Set<AppID>();

/**
 * Proactively prefetch and compile an app chunk ahead of user interaction
 * (e.g., on dock icon hover, mobile touch start, or idle prewarming).
 */
export function prefetchApp(appId: AppID): void {
	if (PREFETCHED_APPS.has(appId)) return;
	const loader = APP_LOADERS[appId];
	if (loader) {
		PREFETCHED_APPS.add(appId);
		loader().catch((err) => {
			PREFETCHED_APPS.delete(appId);
			console.warn(`[prefetchApp] Failed to prefetch ${appId}:`, err);
		});
	}
}

/** Renders a mini app by id (nothing for an unknown id). */
export function AppContent({ appId }: { appId: AppID }) {
	const Component = APP_COMPONENTS[appId];
	return Component ? <Component /> : null;
}

