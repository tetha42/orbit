import path from 'path';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { randomBytes } from 'crypto';

/**
 * Runtime customisations (uploaded wallpapers, a custom site icon) live outside
 * `public/`, on a dedicated Docker volume. That keeps them across container
 * rebuilds while `public/` stays immutable. In development the same layout is
 * used under `./data/custom`, which is git-ignored.
 */
export function dataDir(): string {
	return path.resolve(/*turbopackIgnore: true*/ process.env.ORBIT_DATA_DIR?.trim() || './data');
}

export function customDir(): string {
	return path.resolve(
		/*turbopackIgnore: true*/ process.env.ORBIT_CUSTOM_DIR?.trim() ||
			path.join(dataDir(), 'custom')
	);
}

export type CustomAssetKind = 'wallpapers' | 'identity';

const ASSET_KINDS: readonly CustomAssetKind[] = ['wallpapers', 'identity'];

export function isCustomAssetKind(value: string): value is CustomAssetKind {
	return (ASSET_KINDS as readonly string[]).includes(value);
}

export function customAssetDir(kind: CustomAssetKind): string {
	return path.join(customDir(), kind);
}

/** Names are generated here, never taken from the client. */
export const CUSTOM_IMAGE_NAME_RE = /^[a-z0-9-]{12,80}\.(jpg|jpeg|png|webp|gif|avif)$/;

export function isSafeCustomImageName(name: string): boolean {
	return CUSTOM_IMAGE_NAME_RE.test(name);
}

export function customAssetUrl(kind: CustomAssetKind, name: string): string {
	return `/api/custom-assets/${kind}/${name}`;
}

export async function writeCustomImage(
	kind: CustomAssetKind,
	buffer: Buffer,
	ext: '.jpg' | '.jpeg' | '.png' | '.webp' | '.gif' | '.avif'
): Promise<string> {
	const dir = customAssetDir(kind);
	await mkdir(dir, { recursive: true });
	const name = `${Date.now()}-${randomBytes(9).toString('hex')}${ext}`;
	// `wx` refuses to overwrite an existing asset.
	await writeFile(path.join(dir, name), buffer, { flag: 'wx' });
	return name;
}

export async function removeCustomImage(kind: CustomAssetKind, name: string): Promise<void> {
	if (!isSafeCustomImageName(name)) return;
	await unlink(path.join(customAssetDir(kind), name)).catch(() => {});
}

/** The file name in a stored `/api/custom-assets/...` URL, if it is one. */
export function customImageNameFromUrl(url: string | null | undefined): string | null {
	if (!url) return null;
	const clean = url.split('?')[0].split('#')[0];
	const match = clean.match(/^\/api\/custom-assets\/[a-z]+\/([a-z0-9-]+\.[a-z0-9]+)$/);
	return match && isSafeCustomImageName(match[1]) ? match[1] : null;
}
