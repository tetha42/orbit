import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import path from 'path';
import { ensurePostgresInit, getPgPool } from '@/db';
import { customAssetDir } from '@/server/customData';

export interface CustomWallpaper {
	id: string;
	titleTr: string;
	titleEn: string;
	type: string;
	filename: string;
	mime: string;
	size: number;
	createdBy: string | null;
	createdAt: number;
	sortOrder: number;
}

const CUSTOM_WALLPAPERS_KEY = 'custom_wallpapers';

export async function readStoredCustomWallpapers(): Promise<CustomWallpaper[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT value FROM system_settings WHERE key = $1`,
		[CUSTOM_WALLPAPERS_KEY]
	);
	const raw = res.rows[0]?.value;
	if (typeof raw !== 'string' || !raw.trim()) return [];
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object'))
			.map((row) => ({
				id: String(row.id ?? ''),
				titleTr: String(row.titleTr ?? ''),
				titleEn: String(row.titleEn ?? ''),
				type: String(row.type ?? 'custom'),
				filename: String(row.filename ?? ''),
				mime: String(row.mime ?? 'image/jpeg'),
				size: Number(row.size) || 0,
				createdBy: row.createdBy ? String(row.createdBy) : null,
				createdAt: Number(row.createdAt) || 0,
				sortOrder: Number(row.sortOrder) || 0,
			}));
	} catch {
		return [];
	}
}

export async function writeStoredCustomWallpapers(list: CustomWallpaper[]): Promise<void> {
	await getPgPool().query(
		`INSERT INTO system_settings (key, value, updated_at)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
		[CUSTOM_WALLPAPERS_KEY, JSON.stringify(list), Date.now()]
	);
}

export async function getCustomWallpapers(): Promise<CustomWallpaper[]> {
	const list = await readStoredCustomWallpapers();
	return list
		.filter((row) =>
			existsSync(path.join(customAssetDir('wallpapers'), String(row.filename ?? '')))
		)
		.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
}

export async function createCustomWallpaper(input: {
	titleTr: string;
	titleEn: string;
	type: string;
	filename: string;
	mime: string;
	size: number;
	createdBy: string;
}): Promise<CustomWallpaper> {
	const list = await readStoredCustomWallpapers();
	const now = Date.now();
	const id = `wp_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
	const maxOrder = list.reduce((max, item) => Math.max(max, item.sortOrder), 0);
	const created: CustomWallpaper = {
		id,
		titleTr: input.titleTr,
		titleEn: input.titleEn,
		type: input.type,
		filename: input.filename,
		mime: input.mime,
		size: input.size,
		createdBy: input.createdBy,
		createdAt: now,
		sortOrder: maxOrder + 1,
	};
	list.push(created);
	await writeStoredCustomWallpapers(list);
	return created;
}

export async function getCustomWallpaperById(id: string): Promise<CustomWallpaper | null> {
	const all = await getCustomWallpapers();
	return all.find((wallpaper) => wallpaper.id === id) ?? null;
}

export async function renameCustomWallpaper(
	id: string,
	titleTr: string,
	titleEn: string
): Promise<CustomWallpaper | null> {
	const list = await readStoredCustomWallpapers();
	const idx = list.findIndex((w) => w.id === id);
	if (idx === -1) return null;
	list[idx] = { ...list[idx], titleTr, titleEn };
	await writeStoredCustomWallpapers(list);
	return getCustomWallpaperById(id);
}

export async function deleteCustomWallpaper(id: string): Promise<CustomWallpaper | null> {
	const list = await readStoredCustomWallpapers();
	const idx = list.findIndex((w) => w.id === id);
	if (idx === -1) return null;
	const [removed] = list.splice(idx, 1);
	await writeStoredCustomWallpapers(list);
	return removed ?? null;
}

export interface WallpaperOverride {
	titleTr?: string;
	titleEn?: string;
	hidden?: boolean;
}

const WALLPAPER_OVERRIDES_KEY = 'wallpaper_overrides';

export async function getWallpaperOverrides(): Promise<Record<string, WallpaperOverride>> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT value FROM system_settings WHERE key = $1`,
		[WALLPAPER_OVERRIDES_KEY]
	);
	const raw = res.rows[0]?.value;
	if (typeof raw !== 'string' || !raw.trim()) return {};
	try {
		const parsed = JSON.parse(raw) as Record<string, WallpaperOverride>;
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch {
		return {};
	}
}

export async function setWallpaperOverride(
	id: string,
	patch: WallpaperOverride
): Promise<Record<string, WallpaperOverride>> {
	await ensurePostgresInit();
	const overrides = await getWallpaperOverrides();
	overrides[id] = { ...(overrides[id] ?? {}), ...patch };
	await getPgPool().query(
		`INSERT INTO system_settings (key, value, updated_at)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
		[WALLPAPER_OVERRIDES_KEY, JSON.stringify(overrides), Date.now()]
	);
	return overrides;
}

export async function clearWallpaperOverride(id: string): Promise<Record<string, WallpaperOverride>> {
	await ensurePostgresInit();
	const overrides = await getWallpaperOverrides();
	delete overrides[id];
	await getPgPool().query(
		`INSERT INTO system_settings (key, value, updated_at)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
		[WALLPAPER_OVERRIDES_KEY, JSON.stringify(overrides), Date.now()]
	);
	return overrides;
}
