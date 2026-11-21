import fs from 'node:fs';
import path from 'node:path';
import {
	parseIniSync,
	readRuntimeConfigSync,
	readSecret,
	type SystemConfig,
} from './typesAndParsers';

export function buildConfig(): SystemConfig {
	const rootDir = process.cwd();
	const iniPath = path.resolve(/*turbopackIgnore: true*/ [rootDir, 'config.ini'].join(path.sep));

	const ini: Record<string, Record<string, string>> = readRuntimeConfigSync(rootDir);
	if (fs.existsSync(/*turbopackIgnore: true*/ iniPath)) {
		try {
			const diskIni = parseIniSync(fs.readFileSync(/*turbopackIgnore: true*/ iniPath, 'utf8'));
			for (const [sec, kv] of Object.entries(diskIni)) {
				ini[sec] = { ...(ini[sec] || {}), ...kv };
			}
		} catch (err: unknown) {
			console.warn('[config] Parse warning:', (err as Error).message);
		}
	}

	// Environment variable precedence (OS ENV > data/runtime-config.json / config.ini > defaults)
	const get = (envVar: string, iniSection: string, iniKey: string, fallback = ''): string => {
		return process.env[envVar]?.trim() || ini[iniSection]?.[iniKey]?.trim() || fallback;
	};

	const getVal = (iniSection: string, iniKey: string, envVar: string, fallback = ''): string => {
		return (
			process.env[envVar]?.trim() ||
			process.env[envVar.replace(/^ORBIT_/, 'CLUB_')]?.trim() ||
			ini[iniSection]?.[iniKey]?.trim() ||
			fallback
		);
	};

	const dbUrl = readSecret('database_url', 'DATABASE_URL', get('DATABASE_URL', 'database', 'url', ''));
	const authSecret = readSecret('auth_secret', 'AUTH_SECRET', get('AUTH_SECRET', 'security', 'auth_secret') || '') || undefined;
	const adminEmail = get('BOOTSTRAP_ADMIN_EMAIL', 'bootstrap_admin', 'email', 'admin@orbit.local');
	const adminPass = readSecret('bootstrap_admin_password', 'BOOTSTRAP_ADMIN_PASSWORD', get('BOOTSTRAP_ADMIN_PASSWORD', 'bootstrap_admin', 'password') || '') || undefined;
	const adminFirstName = get('BOOTSTRAP_ADMIN_FIRST_NAME', 'bootstrap_admin', 'first_name', 'Orbit');
	const adminLastName = get('BOOTSTRAP_ADMIN_LAST_NAME', 'bootstrap_admin', 'last_name', 'Admin');

	const clubName = get('CLUB_NAME', 'club_preset', 'name', 'Orbit Community');
	const clubUniv = get('CLUB_UNIVERSITY', 'club_preset', 'university', 'tetha42');
	const clubDomain = get('CLUB_DOMAIN', 'club_preset', 'domain', 'orbit.local');

	const uploadDir = get('UPLOAD_DIR', 'storage', 'upload_dir', './data/uploads');
	const allowedOrigins = get('PUBLIC_API_ALLOWED_ORIGINS', 'public_api', 'allowed_origins', '');
	const baseUrl = get('PUBLIC_BASE_URL', 'public_api', 'base_url', 'http://localhost:3000').replace(/\/+$/, '');

	const termEnabledVal = get('TERMINAL_ENABLED', 'terminal', 'enabled', 'true');
	const terminalEnabled = termEnabledVal === 'true' || termEnabledVal === '1';

	const smtpPortRaw = Number(get('SMTP_PORT', 'smtp', 'port', '465'));
	const smtpPort = !isNaN(smtpPortRaw) ? smtpPortRaw : 465;

	// Populate process.env if unset so standard third-party libraries and existing routes read seamlessly
	if (!process.env.DATABASE_URL && dbUrl) {
		process.env.DATABASE_URL = dbUrl;
	} else if (!process.env.DATABASE_URL && ini.database?.url) {
		process.env.DATABASE_URL = ini.database.url.trim();
	}
	if (authSecret && !process.env.AUTH_SECRET) process.env.AUTH_SECRET = authSecret;
	if (!process.env.BOOTSTRAP_ADMIN_EMAIL) process.env.BOOTSTRAP_ADMIN_EMAIL = adminEmail;
	if (adminPass && !process.env.BOOTSTRAP_ADMIN_PASSWORD) process.env.BOOTSTRAP_ADMIN_PASSWORD = adminPass;
	if (!process.env.BOOTSTRAP_ADMIN_FIRST_NAME) process.env.BOOTSTRAP_ADMIN_FIRST_NAME = adminFirstName;
	if (!process.env.BOOTSTRAP_ADMIN_LAST_NAME) process.env.BOOTSTRAP_ADMIN_LAST_NAME = adminLastName;
	if (!process.env.CLUB_NAME) process.env.CLUB_NAME = clubName;
	if (!process.env.CLUB_UNIVERSITY) process.env.CLUB_UNIVERSITY = clubUniv;
	if (!process.env.CLUB_DOMAIN) process.env.CLUB_DOMAIN = clubDomain;
	if (!process.env.UPLOAD_DIR) process.env.UPLOAD_DIR = uploadDir;
	if (!process.env.PUBLIC_BASE_URL) process.env.PUBLIC_BASE_URL = baseUrl;

	return {
		database: {
			url: dbUrl,
			maxConnections: Number(ini['database']?.['max_connections'] || 30) || 30,
		},
		security: {
			authSecret,
			webauthnOrigin: get('WEBAUTHN_ORIGIN', 'security', 'webauthn_origin') || undefined,
			webauthnRpId: get('WEBAUTHN_RP_ID', 'security', 'webauthn_rp_id') || undefined,
		},
		bootstrapAdmin: {
			email: adminEmail,
			password: adminPass,
			firstName: adminFirstName,
			lastName: adminLastName,
		},
		clubPreset: {
			name: clubName,
			university: clubUniv,
			domain: clubDomain,
			presidentName: getVal('club_preset', 'president_name', 'ORBIT_PRESIDENT_NAME', 'Community Lead'),
			presidentTitle: getVal('club_preset', 'president_title', 'ORBIT_PRESIDENT_TITLE', 'Community Lead'),
			advisorName: getVal('club_preset', 'advisor_name', 'ORBIT_ADVISOR_NAME', 'Community Advisor'),
			advisorTitle: getVal('club_preset', 'advisor_title', 'ORBIT_ADVISOR_TITLE', 'Community Advisor'),
		},
		smtp: {
			host: get('SMTP_HOST', 'smtp', 'host') || undefined,
			port: smtpPort,
			user: get('SMTP_USER', 'smtp', 'user') || undefined,
			password: get('SMTP_PASS', 'smtp', 'password') || undefined,
			from: get('SMTP_FROM', 'smtp', 'from') || undefined,
		},
		storage: {
			uploadDir,
		},
		publicApi: {
			allowedOrigins,
			baseUrl,
		},
		terminal: {
			enabled: terminalEnabled,
		},
	};
}
