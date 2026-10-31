/**
 * Versioned URLs for the community's uploaded icon. The app icon is stored once
 * as an uploaded image; the browser favicon, Apple touch icon and PWA icons are
 * resized from it by `/api/identity/icon/[size]`.
 *
 * Pure and import-free so the server manifest, the client identity provider and
 * scripts/check-pure.mjs can all use the same URL rules.
 */

export const IDENTITY_ICON_ROUTE = '/api/identity/icon';

/** The `?v=` stamp from an uploaded icon URL; stable for the lifetime of that upload. */
export function identityIconVersion(iconUrl: string | null | undefined): string {
	if (!iconUrl) return 'default';
	const match = iconUrl.match(/[?&]v=([^&#]+)/);
	return match?.[1] || 'custom';
}

export function identityIconUrl(
	size: number,
	version: string,
	options: { maskable?: boolean } = {}
): string {
	const safeSize = Math.min(1024, Math.max(16, Math.round(size)));
	const params = new URLSearchParams({ v: version || 'default' });
	if (options.maskable) params.set('maskable', '1');
	return `${IDENTITY_ICON_ROUTE}/${safeSize}?${params.toString()}`;
}

export function identityManifestUrl(version: string): string {
	return `/manifest.webmanifest?v=${encodeURIComponent(version || 'default')}`;
}

/** The default static icon when no community icon has been uploaded. */
export function defaultIconForSize(size: number, maskable = false): string {
	if (maskable) return '/icons/icon-maskable-512.png';
	if (size >= 512) return '/icons/icon-512.png';
	if (size >= 192) return '/icons/icon-192.png';
	return '/icon.png';
}
