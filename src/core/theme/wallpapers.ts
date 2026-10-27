/**
 * The wallpaper catalogue, the one list: Settings → Wallpaper shows it and
 * "next wallpaper" (menu bar, desktop menu, Ctrl+W) walks it in this order.
 * No imports, so it can be tested on its own.
 */

export interface Wallpaper {
	id: string;
	title: string;
	type: string;
	titleKey?: string;
	typeKey?: string;
	/** What is stored and drawn: an image path, or '3d-aurora' for the WebGL scene. */
	src: string;
	/** A still for the picker, where `src` is not an image. */
	preview?: string;
}

export const AURORA_WALLPAPER = '3d-aurora';
const AURORA_PREVIEW = '/wallpapers/3D-Aurora.png';

export const WALLPAPERS: readonly Wallpaper[] = [
	{ id: '3d-aurora', title: '3D Aurora & Matrix Peaks', type: 'Dynamic 3D', titleKey: 'wp_3d_aurora', typeKey: 'wptype_dynamic_3d', src: AURORA_WALLPAPER, preview: AURORA_PREVIEW },
	{ id: 'space-station-orbit', title: 'Orbit & Space Station', type: 'Space', titleKey: 'wp_space_station_orbit', typeKey: 'wptype_space', src: '/wallpapers/space-space-art-digital-art-earth-wallpaper-039af3ca98058c3d0832ae73316892d1.jpg' },
	{ id: 'spitzer-galaxy-jet', title: 'Spitzer Galaxy Jet', type: 'Space', titleKey: 'wp_spitzer_galaxy_jet', typeKey: 'wptype_space', src: '/wallpapers/spitzer-space-telescope-space-galaxy-nasa-wallpaper-53d30162198bd65ab0ee8083d06af927.jpg' },
	{ id: 'deep-space-nebula', title: 'Deep Space Nebula', type: 'Space', titleKey: 'wp_deep_space_nebula', typeKey: 'wptype_space', src: '/wallpapers/39620.jpg' },
	{ id: 'earth-horizon-eclipse', title: 'Earth Horizon & Star', type: 'Space', titleKey: 'wp_earth_horizon_eclipse', typeKey: 'wptype_space', src: '/wallpapers/39672.jpg' },
	{ id: 'think-positively', title: 'Think Positively', type: 'Abstract', titleKey: 'wp_think_positively', typeKey: 'wptype_abstract', src: '/wallpapers/quote-motivational-digital-art-typography-wallpaper-5856bc0a6f2cf779de90d962a2d90bb0.jpg' },
	{ id: 'big-sur-1', title: 'macOS Big Sur Dark', type: 'Dynamic Dark', titleKey: 'wp_big_sur_1', typeKey: 'wptype_dynamic_dark', src: '/wallpapers/big-sur-1.jpg' },
	{ id: 'big-sur-2', title: 'macOS Big Sur Light', type: 'Dynamic Light', titleKey: 'wp_big_sur_2', typeKey: 'wptype_dynamic_light', src: '/wallpapers/big-sur-2.jpg' },
	{ id: 'big-sur-3', title: 'macOS Big Sur Sunset', type: 'Dynamic Light', titleKey: 'wp_big_sur_3', typeKey: 'wptype_dynamic_light', src: '/wallpapers/big-sur-3.jpg' },
	{ id: 'big-sur-4', title: 'macOS Big Sur Night', type: 'Dynamic Dark', titleKey: 'wp_big_sur_4', typeKey: 'wptype_dynamic_dark', src: '/wallpapers/big-sur-4.jpg' },
	{ id: 'catalina-1', title: 'macOS Catalina Dark', type: 'Dynamic Dark', titleKey: 'wp_catalina_1', typeKey: 'wptype_dynamic_dark', src: '/wallpapers/catalina-1.jpg' },
	{ id: 'catalina-5', title: 'macOS Catalina Light', type: 'Dynamic Light', titleKey: 'wp_catalina_5', typeKey: 'wptype_dynamic_light', src: '/wallpapers/catalina-5.jpg' },
	{ id: 'mojave-1', title: 'macOS Mojave Night', type: 'Landscape', titleKey: 'wp_mojave_1', typeKey: 'wptype_landscape', src: '/wallpapers/mojave-1.jpg' },
	{ id: 'mojave-2', title: 'macOS Mojave Dunes', type: 'Landscape', titleKey: 'wp_mojave_2', typeKey: 'wptype_landscape', src: '/wallpapers/mojave-2.jpg' },
];

export const DEFAULT_WALLPAPER = WALLPAPERS[0].src;

/** Whether the wallpaper is the live 3D scene rather than an image. */
export function isAuroraWallpaper(src: string): boolean {
	return src === AURORA_WALLPAPER || src.includes('3D-Aurora') || src.includes('3d-aurora');
}

/** The wallpaper after `current` in the catalogue, wrapping round; an unknown one starts over at the first. */
export function nextWallpaper(current: string): string {
	const i = WALLPAPERS.findIndex((w) => w.src === current);
	return WALLPAPERS[(i + 1) % WALLPAPERS.length].src;
}

/** A catalogue entry, or a stand-in for a stored path the catalogue does not know. */
export function wallpaperInfo(src: string): Wallpaper {
	return WALLPAPERS.find((w) => w.src === src) ?? {
		id: 'custom',
		title: 'Custom Wallpaper',
		type: 'Custom',
		titleKey: 'wp_custom',
		typeKey: 'wptype_custom',
		src,
		preview: isAuroraWallpaper(src) ? AURORA_PREVIEW : src,
	};
}

/** The image to show in a picker for this wallpaper. */
export function wallpaperPreview(src: string): string {
	return wallpaperInfo(src).preview ?? src;
}
