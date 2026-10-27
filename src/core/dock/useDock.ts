'use client';

import { useCallback, useState } from 'react';
import { DEFAULT_DOCK_APPS } from '@/configs/apps.config';
import type { AppID } from '@/types/workspace';

/** The dock: which apps it pins and whether it hides itself. Composed by the workspace provider. */
export function useDock() {
	const [dockApps, setDockApps] = useState<AppID[]>(DEFAULT_DOCK_APPS);
	const [isDockAutoHide, setIsDockAutoHide] = useState<boolean>(false);
	const toggleDockAutoHide = useCallback(() => setIsDockAutoHide((prev) => !prev), []);
	return { dockApps, setDockApps, isDockAutoHide, setIsDockAutoHide, toggleDockAutoHide };
}
