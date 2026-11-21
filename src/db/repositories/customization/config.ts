import { ensurePostgresInit, getPgPool } from '@/db';
import {
	DEFAULT_REGISTRATION_CORE_CONFIG,
	REGISTRATION_CORE_SETTINGS_KEY,
	normalizeRegistrationCoreConfig,
	type RegistrationCoreConfig,
} from '@/lib/i18n/data/registrationConfig';
import {
	DEFAULT_TEAM_CATEGORIES,
	TEAM_CATEGORIES_SETTINGS_KEY,
	normalizeTeamCategories,
} from '@/lib/teamCategories';

export async function getRegistrationCoreConfig(): Promise<RegistrationCoreConfig> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT value FROM system_settings WHERE key = $1`,
		[REGISTRATION_CORE_SETTINGS_KEY]
	);
	const raw = res.rows[0]?.value;
	if (typeof raw !== 'string' || !raw.trim()) return DEFAULT_REGISTRATION_CORE_CONFIG;
	try {
		return normalizeRegistrationCoreConfig(JSON.parse(raw));
	} catch {
		return DEFAULT_REGISTRATION_CORE_CONFIG;
	}
}

export async function setRegistrationCoreConfig(input: unknown): Promise<RegistrationCoreConfig> {
	await ensurePostgresInit();
	const config = normalizeRegistrationCoreConfig(input);
	await getPgPool().query(
		`INSERT INTO system_settings (key, value, updated_at)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
		[REGISTRATION_CORE_SETTINGS_KEY, JSON.stringify(config), Date.now()]
	);
	return config;
}

export async function getTeamCategories(): Promise<string[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT value FROM system_settings WHERE key = $1`,
		[TEAM_CATEGORIES_SETTINGS_KEY]
	);
	const raw = res.rows[0]?.value;
	if (typeof raw !== 'string' || !raw.trim()) return [...DEFAULT_TEAM_CATEGORIES];
	try {
		return normalizeTeamCategories(JSON.parse(raw));
	} catch {
		return [...DEFAULT_TEAM_CATEGORIES];
	}
}

export async function setTeamCategories(input: unknown): Promise<string[]> {
	await ensurePostgresInit();
	const categories = normalizeTeamCategories(input);
	await getPgPool().query(
		`INSERT INTO system_settings (key, value, updated_at)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
		[TEAM_CATEGORIES_SETTINGS_KEY, JSON.stringify(categories), Date.now()]
	);
	return categories;
}
