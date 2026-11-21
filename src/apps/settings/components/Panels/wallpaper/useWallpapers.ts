import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/core/i18n';
import { useShell } from '@/core/shell';
import { useSession } from '@/core/session';
import { useDialog } from '@/components/Common/DialogProvider';
import { WALLPAPERS } from '@/core/theme';
import type {
	CustomWallpaperItem,
	WallpaperCategory,
	WallpaperOverride,
} from './types';
import {
	buildCategoryCounts,
	buildDisplayWallpapers,
	resolveCurrentWallpaperMeta,
} from './wallpaperSelectors';
import { useWallpaperMutations } from './useWallpaperMutations';

export function useWallpapers() {
	const { t, language } = useI18n();
	const { activeWallpaper, setWallpaper, cycleWallpaper } = useShell();
	const { canManageApp } = useSession();
	const dialog = useDialog();

	const canManage = canManageApp('settings');
	const [selectedCategory, setSelectedCategory] = useState<WallpaperCategory>('all');
	const [customWallpapers, setCustomWallpapers] = useState<CustomWallpaperItem[]>([]);
	const [overrides, setOverrides] = useState<Record<string, WallpaperOverride>>({});
	const [isLoadingCustom, setIsLoadingCustom] = useState(true);
	const [busy, setBusy] = useState(false);
	const [feedback, setFeedback] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		const loadCustomWallpapers = async () => {
			setIsLoadingCustom(true);
			try {
				const res = await fetch('/api/settings/wallpapers', { cache: 'no-store' });
				const data = await res.json();
				if (!cancelled && res.ok) {
					setCustomWallpapers(Array.isArray(data.wallpapers) ? data.wallpapers : []);
					setOverrides(data.overrides && typeof data.overrides === 'object' ? data.overrides : {});
				}
			} catch {
				// Ignore transient wallpaper customization load failures.
			} finally {
				if (!cancelled) setIsLoadingCustom(false);
			}
		};
		void loadCustomWallpapers();
		return () => {
			cancelled = true;
		};
	}, []);

	const mutations = useWallpaperMutations({
		t,
		dialog,
		canManage,
		busy,
		activeWallpaper,
		setWallpaper,
		customWallpapers,
		setCustomWallpapers,
		overrides,
		setOverrides,
		setBusy,
		setFeedback,
	});

	const displayWallpapers = useMemo(
		() => buildDisplayWallpapers(customWallpapers, overrides, language, t),
		[customWallpapers, language, overrides, t],
	);

	const counts = useMemo(
		() => buildCategoryCounts(displayWallpapers),
		[displayWallpapers],
	);

	const filteredWallpapers = useMemo(() => {
		if (selectedCategory === 'all') return displayWallpapers;
		return displayWallpapers.filter((item) => item.category === selectedCategory);
	}, [displayWallpapers, selectedCategory]);

	const hiddenBuiltins = useMemo(
		() => WALLPAPERS.filter((wallpaper) => overrides[wallpaper.id]?.hidden),
		[overrides],
	);

	const currentMeta = useMemo(
		() => resolveCurrentWallpaperMeta(activeWallpaper, customWallpapers, overrides, language, t),
		[activeWallpaper, customWallpapers, language, overrides, t],
	);

	return {
		canManage,
		activeWallpaper,
		setWallpaper,
		cycleWallpaper,
		...currentMeta,
		selectedCategory,
		setSelectedCategory,
		counts,
		filteredWallpapers,
		hiddenBuiltins,
		isLoadingCustom,
		busy,
		feedback,
		...mutations,
	};
}
