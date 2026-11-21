import { existsSync } from 'fs';
import path from 'path';
import { ensurePostgresInit, getPgPool } from '@/db';
import {
	DEFAULT_REGISTRATION_CORE_CONFIG,
	REGISTRATION_CORE_SETTINGS_KEY,
} from '@/lib/i18n/data/registrationConfig';
import {
	DEFAULT_TEAM_CATEGORIES,
	TEAM_CATEGORIES_SETTINGS_KEY,
} from '@/lib/teamCategories';
import {
	customAssetDir,
	customImageNameFromUrl,
	isSafeCustomImageName,
} from '@/server/customData';

export interface PublicIdentity {
	/** The application name is fixed by the product. */
	appName: 'Orbit';
	/** The studio that engineered the product; never editable. */
	studio: 'tetha42';
	siteName: string;
	siteShortName: string;
	descriptionTr: string;
	descriptionEn: string;
	domain: string;
	iconUrl: string | null;
	/** Changes on every icon or name edit; versions the PWA manifest URL. */
	brandVersion: string;
}

export async function getPublicIdentity(): Promise<PublicIdentity> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT key, value FROM system_settings WHERE key = ANY($1)`,
		[
			[
				'club_name',
				'organization_name',
				'site_short_name',
				'site_description_tr',
				'site_description_en',
				'club_domain',
				'organization_domain',
				'site_icon',
				'site_brand_version',
			],
		]
	);
	const map = Object.fromEntries(res.rows.map((row) => [String(row.key), String(row.value)]));
	const siteName = map.club_name?.trim() || map.organization_name?.trim() || 'Orbit Community';
	const storedIcon = map.site_icon?.trim() || null;
	const iconName = customImageNameFromUrl(storedIcon);
	const iconUrl =
		storedIcon && iconName && isSafeCustomImageName(iconName) &&
		existsSync(path.join(customAssetDir('identity'), iconName))
			? storedIcon
			: null;
	const storedBrandVersion = map.site_brand_version?.trim();
	const iconVersionFromUrl = storedIcon?.match(/[?&]v=([^&#]+)/)?.[1];
	return {
		appName: 'Orbit',
		studio: 'tetha42',
		siteName,
		siteShortName: map.site_short_name?.trim() || siteName.slice(0, 24),
		descriptionTr:
			map.site_description_tr?.trim() ||
			'Self-hosted community operating system engineered by tetha42.',
		descriptionEn:
			map.site_description_en?.trim() ||
			'Self-hosted community operating system engineered by tetha42.',
		domain: map.club_domain?.trim() || map.organization_domain?.trim() || 'orbit.local',
		iconUrl,
		brandVersion: storedBrandVersion || iconVersionFromUrl || 'default',
	};
}

/**
 * Materialises the factory defaults that the rest of the app would otherwise
 * read from in-code fallbacks. Setup calls this once, with ON CONFLICT DO
 * NOTHING, so a planted default can never overwrite an operator's value.
 */
export async function seedSetupDefaults(communityName: string): Promise<void> {
	await ensurePostgresInit();
	const now = Date.now();
	const defaults: Record<string, string> = {
		site_short_name: communityName.trim().slice(0, 24) || 'Orbit',
		site_description_tr:
			'Self-hosted community operating system engineered by tetha42.',
		site_description_en: 'Self-hosted community operating system engineered by tetha42.',
		site_brand_version: 'default',
		[REGISTRATION_CORE_SETTINGS_KEY]: JSON.stringify(DEFAULT_REGISTRATION_CORE_CONFIG),
		[TEAM_CATEGORIES_SETTINGS_KEY]: JSON.stringify(DEFAULT_TEAM_CATEGORIES),
	};
	for (const [key, value] of Object.entries(defaults)) {
		await getPgPool().query(
			`INSERT INTO system_settings (key, value, updated_at)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (key) DO NOTHING`,
			[key, value, now]
		);
	}
}
