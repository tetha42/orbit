import fs from 'node:fs';
import path from 'node:path';
import { parseIniSync, readRuntimeConfigSync } from './typesAndParsers';

export type ConfigSource =
	| 'secret'
	| 'env'
	| 'env.local'
	| 'config.ini'
	| 'runtime-config'
	| 'default';

export interface ConfigProvenanceEntry {
	key: string;
	value: string;
	source: ConfigSource;
	sensitive: boolean;
	configured: boolean;
}

interface ConfigKeySpec {
	key: string;
	section: string;
	iniKey: string;
	secretName?: string;
	fallback: string;
	sensitive: boolean;
}

const CONFIG_SPECS: readonly ConfigKeySpec[] = [
	{ key: 'DATABASE_URL', section: 'database', iniKey: 'url', secretName: 'database_url', fallback: '', sensitive: true },
	{ key: 'AUTH_SECRET', section: 'security', iniKey: 'auth_secret', secretName: 'auth_secret', fallback: '', sensitive: true },
	{ key: 'PUBLIC_BASE_URL', section: 'public_api', iniKey: 'base_url', fallback: 'http://localhost:3000', sensitive: false },
	{ key: 'BOOTSTRAP_ADMIN_EMAIL', section: 'bootstrap_admin', iniKey: 'email', fallback: 'admin@orbit.local', sensitive: false },
	{
		key: 'BOOTSTRAP_ADMIN_PASSWORD',
		section: 'bootstrap_admin',
		iniKey: 'password',
		secretName: 'bootstrap_admin_password',
		fallback: '',
		sensitive: true,
	},
	{ key: 'CLUB_NAME', section: 'club_preset', iniKey: 'name', fallback: 'Orbit Community', sensitive: false },
	{ key: 'CLUB_DOMAIN', section: 'club_preset', iniKey: 'domain', fallback: 'orbit.local', sensitive: false },
	{ key: 'UPLOAD_DIR', section: 'storage', iniKey: 'upload_dir', fallback: './data/uploads', sensitive: false },
	{ key: 'SMTP_HOST', section: 'smtp', iniKey: 'host', fallback: '', sensitive: false },
	{ key: 'TERMINAL_ENABLED', section: 'terminal', iniKey: 'enabled', fallback: 'false', sensitive: false },
];

export function parseDotEnvFile(filePath: string): Record<string, string> {
	if (!fs.existsSync(/*turbopackIgnore: true*/ filePath)) return {};
	try {
		const raw = fs.readFileSync(/*turbopackIgnore: true*/ filePath, 'utf8');
		const out: Record<string, string> = {};
		for (const rawLine of raw.split(/\r?\n/)) {
			let line = rawLine.trim();
			if (!line || line.startsWith('#')) continue;
			if (line.startsWith('export ')) line = line.slice(7).trim();
			const eqIdx = line.indexOf('=');
			if (eqIdx <= 0) continue;
			const key = line.slice(0, eqIdx).trim();
			if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
			let val = line.slice(eqIdx + 1).trim();
			const isQuoted =
				(val.startsWith('"') && val.endsWith('"') && val.length >= 2) ||
				(val.startsWith("'") && val.endsWith("'") && val.length >= 2);
			if (isQuoted) {
				val = val.slice(1, -1);
			} else {
				const commentIdx = val.search(/\s+#/);
				if (commentIdx >= 0) val = val.slice(0, commentIdx).trim();
			}
			out[key] = val;
		}
		return out;
	} catch {
		// Unreadable .env files should not crash config diagnostics
		return {};
	}
}

export function maskConfigValue(key: string, value: string, sensitive: boolean): string {
	if (!value) return '(unset)';
	if (key === 'DATABASE_URL') {
		try {
			const parsed = new URL(value);
			if (parsed.password) {
				parsed.password = '****';
				return parsed.toString();
			}
			return value;
		} catch {
			return value.replace(/:([^:@/]+)@/, ':****@');
		}
	}
	if (sensitive) {
		return `<set (${value.length} chars)>`;
	}
	return value;
}

function readSecretFromDiskOnly(secretName: string, envVar: string): string {
	const candidates = [
		path.join('/run/secrets', secretName),
		path.join('/run/secrets', secretName.toLowerCase()),
	];
	for (const candidate of candidates) {
		try {
			if (fs.existsSync(/*turbopackIgnore: true*/ candidate)) {
				const val = fs.readFileSync(/*turbopackIgnore: true*/ candidate, 'utf8').trim();
				if (val) return val;
			}
		} catch {
			// Ignore unreadable mounted secrets
		}
	}
	const fileVar = process.env[`${envVar}_FILE`]?.trim();
	if (fileVar) {
		try {
			if (fs.existsSync(/*turbopackIgnore: true*/ fileVar)) {
				const val = fs.readFileSync(/*turbopackIgnore: true*/ fileVar, 'utf8').trim();
				if (val) return val;
			}
		} catch {
			// Ignore unreadable _FILE secret path
		}
	}
	return '';
}

function loadLayeredSources(rootDir: string) {
	const runtimeConfig = readRuntimeConfigSync(rootDir);
	let diskIni: Record<string, Record<string, string>> = {};
	const iniPath = path.join(rootDir, 'config.ini');
	if (fs.existsSync(/*turbopackIgnore: true*/ iniPath)) {
		try {
			diskIni = parseIniSync(fs.readFileSync(/*turbopackIgnore: true*/ iniPath, 'utf8'));
		} catch {
			// Ignore malformed config.ini during inspection
		}
	}
	const dotEnv = parseDotEnvFile(path.join(rootDir, '.env'));
	const dotEnvLocal = { ...dotEnv, ...parseDotEnvFile(path.join(rootDir, '.env.local')) };
	return { runtimeConfig, diskIni, dotEnvLocal };
}

function resolveRawSpec(
	spec: ConfigKeySpec,
	sources: ReturnType<typeof loadLayeredSources>
): { rawValue: string; source: ConfigSource } {
	if (spec.secretName) {
		const secretVal = readSecretFromDiskOnly(spec.secretName, spec.key);
		if (secretVal) return { rawValue: secretVal, source: 'secret' };
	}
	const envVal = process.env[spec.key]?.trim();
	const dotEnvVal = sources.dotEnvLocal[spec.key]?.trim();
	if (envVal) {
		return {
			rawValue: envVal,
			source: dotEnvVal === envVal ? 'env.local' : 'env',
		};
	}
	if (dotEnvVal) return { rawValue: dotEnvVal, source: 'env.local' };

	const iniVal = sources.diskIni[spec.section]?.[spec.iniKey]?.trim();
	if (iniVal) return { rawValue: iniVal, source: 'config.ini' };

	const runtimeVal = sources.runtimeConfig[spec.section]?.[spec.iniKey]?.trim();
	if (runtimeVal) return { rawValue: runtimeVal, source: 'runtime-config' };

	return { rawValue: spec.fallback, source: 'default' };
}

export function resolveDatabaseUrlWithSource(rootDir = process.cwd()): { url: string; source: ConfigSource } {
	const sources = loadLayeredSources(rootDir);
	const resolved = resolveRawSpec(CONFIG_SPECS[0], sources);
	return { url: resolved.rawValue, source: resolved.source };
}

export function collectConfigProvenance(rootDir = process.cwd()): ConfigProvenanceEntry[] {
	const sources = loadLayeredSources(rootDir);
	return CONFIG_SPECS.map((spec) => {
		const { rawValue, source } = resolveRawSpec(spec, sources);
		return {
			key: spec.key,
			value: maskConfigValue(spec.key, rawValue, spec.sensitive),
			source,
			sensitive: spec.sensitive,
			configured: source !== 'default' && Boolean(rawValue),
		};
	});
}
