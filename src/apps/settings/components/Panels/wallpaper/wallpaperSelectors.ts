import { resolveLocalizedText } from '@/core/i18n';
import { WALLPAPERS, wallpaperInfo } from '@/core/theme';
import type {
	CustomWallpaperItem,
	DisplayWallpaper,
	WallpaperCategory,
	WallpaperOverride,
} from './types';

export function resolveBuiltinCategory(
	id: string,
	type: string,
): Exclude<WallpaperCategory, 'all'> {
	if (type === 'Space') return 'space';
	if (id === '3d-aurora' || type.startsWith('Dynamic')) return 'dynamic';
	if (type === 'Landscape') return 'landscape';
	return 'abstract';
}

export function resolveWallpaperTitle(
	item: { titleTr?: string; titleEn?: string } | undefined,
	language: string,
): string {
	return item ? resolveLocalizedText({ en: item.titleEn, tr: item.titleTr }, language) : '';
}

export function buildDisplayWallpapers(
	customWallpapers: CustomWallpaperItem[],
	overrides: Record<string, WallpaperOverride>,
	language: string,
	t: (key: string, fallback?: string) => string,
): DisplayWallpaper[] {
	const builtins = WALLPAPERS.filter((wallpaper) => !overrides[wallpaper.id]?.hidden).map(
		(wallpaper) => {
			const override = overrides[wallpaper.id];
			const title =
				resolveWallpaperTitle(override, language) ||
				t(wallpaper.titleKey || `wp_${wallpaper.id.replace(/-/g, '_')}`, wallpaper.title);
			const type = t(
				wallpaper.typeKey || `wptype_${wallpaper.type.toLowerCase().replace(/\s+/g, '_')}`,
				wallpaper.type,
			);
			return {
				id: wallpaper.id,
				title,
				type,
				src: wallpaper.src,
				category: resolveBuiltinCategory(wallpaper.id, wallpaper.type),
				isSpace: wallpaper.type === 'Space',
				is3D: wallpaper.id === '3d-aurora',
				custom: false,
			};
		},
	);

	const customItems: DisplayWallpaper[] = customWallpapers.map((item) => ({
		id: item.id,
		title: resolveWallpaperTitle(item, language) || t('settingsWallpaperCustom'),
		type: !item.type || item.type === 'custom' ? t('settingsWallpaperCustomType') : item.type,
		src: item.url,
		category: 'custom',
		isSpace: false,
		is3D: false,
		custom: true,
	}));

	return [...builtins, ...customItems];
}

export function buildCategoryCounts(
	displayWallpapers: DisplayWallpaper[],
): Record<WallpaperCategory, number> {
	return {
		all: displayWallpapers.length,
		space: displayWallpapers.filter((item) => item.category === 'space').length,
		dynamic: displayWallpapers.filter((item) => item.category === 'dynamic').length,
		landscape: displayWallpapers.filter((item) => item.category === 'landscape').length,
		abstract: displayWallpapers.filter((item) => item.category === 'abstract').length,
		custom: displayWallpapers.filter((item) => item.category === 'custom').length,
	};
}

export function resolveCurrentWallpaperMeta(
	activeWallpaper: string,
	customWallpapers: CustomWallpaperItem[],
	overrides: Record<string, WallpaperOverride>,
	language: string,
	t: (key: string, fallback?: string) => string,
) {
	const currentWallpaperObj = wallpaperInfo(activeWallpaper);
	const currentCustom = customWallpapers.find((item) => item.url === activeWallpaper);

	let currentTitle: string;
	if (currentCustom) {
		currentTitle = resolveWallpaperTitle(currentCustom, language);
	} else {
		const currentOverride = overrides[currentWallpaperObj.id];
		currentTitle = currentOverride
			? resolveWallpaperTitle(currentOverride, language) || currentWallpaperObj.title
			: t(
					currentWallpaperObj.titleKey || `wp_${currentWallpaperObj.id.replace(/-/g, '_')}`,
					currentWallpaperObj.title,
				);
	}

	const currentType = currentCustom
		? !currentCustom.type || currentCustom.type === 'custom'
			? t('settingsWallpaperCustomType')
			: currentCustom.type
		: t(
				currentWallpaperObj.typeKey ||
					`wptype_${currentWallpaperObj.type.toLowerCase().replace(/\s+/g, '_')}`,
				currentWallpaperObj.type,
			);

	return {
		currentWallpaperObj,
		currentTitle,
		currentType,
	};
}
