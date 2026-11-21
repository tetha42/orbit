import { ALL_WINDOW_MANIFESTS } from '@/apps';
import type { AppID, WindowState } from '@/types/workspace';
import { INITIAL_WINDOWS, INTERNAL_WINDOW_IDS } from './helpers';

export function computeTiledWindows(
	currentWindows: Record<AppID, WindowState>,
	openApps: AppID[]
): Record<AppID, WindowState> {
	const screenW = typeof window !== 'undefined' ? window.innerWidth : 1440;
	const screenH = typeof window !== 'undefined' ? window.innerHeight - 120 : 800;
	const cols = openApps.length <= 2 ? openApps.length : Math.ceil(Math.sqrt(openApps.length));
	const rows = Math.ceil(openApps.length / cols);
	const cellW = Math.floor(screenW / cols);
	const cellH = Math.floor(screenH / rows);

	const updated = { ...currentWindows };
	openApps.forEach((id, i) => {
		const col = i % cols;
		const row = Math.floor(i / cols);
		updated[id] = {
			...updated[id],
			isMinimized: false,
			isMaximized: false,
			position: { x: col * cellW + 15, y: row * cellH + 40 },
			size: { width: cellW - 30, height: cellH - 30 },
		};
	});
	return updated;
}

export function sanitizeRestoredWindows(
	savedWindows: Record<AppID, WindowState>
): Record<AppID, WindowState> {
	const screenW = typeof window !== 'undefined' ? window.innerWidth : 1440;
	const screenH = typeof window !== 'undefined' ? window.innerHeight : 900;
	const sanitized: Record<AppID, WindowState> = { ...INITIAL_WINDOWS };

	for (const id of Object.keys(sanitized) as AppID[]) {
		if (INTERNAL_WINDOW_IDS.has(id)) continue;
		const src = savedWindows[id];
		if (!src) continue;
		const def = INITIAL_WINDOWS[id];
		const posX =
			typeof src.position?.x === 'number' && src.position.x >= -100 && src.position.x < screenW - 100
				? src.position.x
				: def.position.x;
		const posY =
			typeof src.position?.y === 'number' && src.position.y >= 24 && src.position.y < screenH - 60
				? src.position.y
				: def.position.y;
		const sizeW =
			typeof src.size?.width === 'number' && src.size.width >= 320 && src.size.width <= screenW
				? src.size.width
				: def.size.width;
		const sizeH =
			typeof src.size?.height === 'number' && src.size.height >= 240 && src.size.height <= screenH
				? src.size.height
				: def.size.height;

		sanitized[id] = {
			isOpen: !!src.isOpen,
			isMinimized: !!src.isMinimized,
			isMaximized: !!src.isMaximized,
			position: { x: posX, y: posY },
			size: { width: sizeW, height: sizeH },
			zIndex: typeof src.zIndex === 'number' ? src.zIndex : def.zIndex,
		};
	}

	return sanitized;
}

export function notifyRevokedWindows(revoked: AppID[]): void {
	if (typeof window === 'undefined') return;
	for (const id of revoked) {
		const manifest = ALL_WINDOW_MANIFESTS.find((m) => m.id === id);
		const title = manifest?.title ?? id;
		window.dispatchEvent(
			new CustomEvent('orbit:toast', {
				detail: {
					message: `"${title}" window was closed because your access permissions were updated.`,
					tone: 'error',
				},
			})
		);
		try {
			window.dispatchEvent(new CustomEvent('workspace:app-closed', { detail: { appId: id } }));
		} catch {
			/* ignore */
		}
	}
}
