import fs from 'node:fs';
import path from 'node:path';

/**
 * Parsed and strongly-typed system configuration model.
 * Runs zero-config out of the box with built-in defaults and Web UI database persistence.
 */
export interface SystemConfig {
	database: {
		url: string;
		maxConnections: number;
	};
	security: {
		authSecret?: string;
		webauthnOrigin?: string;
		webauthnRpId?: string;
	};
	bootstrapAdmin: {
		email: string;
		password?: string;
		firstName: string;
		lastName: string;
	};
	clubPreset: {
		name: string;
		university: string;
		domain: string;
		presidentName?: string;
		presidentTitle?: string;
		advisorName?: string;
		advisorTitle?: string;
	};
	smtp: {
		host?: string;
		port?: number;
		user?: string;
		password?: string;
		from?: string;
	};
	storage: {
		uploadDir: string;
	};
	publicApi: {
		allowedOrigins: string;
		baseUrl: string;
	};
	terminal: {
		enabled: boolean;
	};
}

function parseIniSync(content: string): Record<string, Record<string, string>> {
	const result: Record<string, Record<string, string>> = {};
	let currentSection = '';

	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#') || line.startsWith(';')) continue;

		const sectionMatch = line.match(/^\[(.*?)\]$/);
		if (sectionMatch) {
			currentSection = sectionMatch[1].trim().toLowerCase();
			if (!result[currentSection]) result[currentSection] = {};
			continue;
		}

		const eqIdx = line.indexOf('=');
		if (eqIdx > 0 && currentSection) {
			const key = line.slice(0, eqIdx).trim().toLowerCase();
			let val = line.slice(eqIdx + 1).trim();

			const commentIdx = val.search(/\s[#;]/);
			if (commentIdx >= 0) val = val.slice(0, commentIdx).trim();

			if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
				val = val.slice(1, -1);
			}

			if (!result[currentSection]) result[currentSection] = {};
			result[currentSection][key] = val;
		}
	}
	return result;
}

function readRuntimeConfigSync(rootDir: string): Record<string, Record<string, string>> {
	const runtimePath = path.join(rootDir, 'data', 'runtime-config.json');
	if (!fs.existsSync(runtimePath)) return {};
	try {
		const raw = fs.readFileSync(runtimePath, 'utf8');
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === 'object') {
			return parsed as Record<string, Record<string, string>>;
		}
	} catch {
		// Ignore malformed runtime config
	}
	return {};
}

function buildConfig(): SystemConfig {
	const rootDir = process.cwd();
	const iniPath = path.join(rootDir, 'config.ini');

	const ini: Record<string, Record<string, string>> = readRuntimeConfigSync(rootDir);
	if (fs.existsSync(iniPath)) {
		try {
			const diskIni = parseIniSync(fs.readFileSync(iniPath, 'utf8'));
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

	const dbUrl = get('DATABASE_URL', 'database', 'url', '');
	const authSecret = get('AUTH_SECRET', 'security', 'auth_secret') || undefined;
	const adminEmail = get('BOOTSTRAP_ADMIN_EMAIL', 'bootstrap_admin', 'email', 'admin@orbit.local');
	const adminPass = get('BOOTSTRAP_ADMIN_PASSWORD', 'bootstrap_admin', 'password') || undefined;
	const adminAd = get('BOOTSTRAP_ADMIN_AD', 'bootstrap_admin', 'first_name', 'Orbit');
	const adminSoyad = get('BOOTSTRAP_ADMIN_SOYAD', 'bootstrap_admin', 'last_name', 'Admin');

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
	if (process.env.DATABASE_URL) {
		// keep existing env
	} else if (ini.database?.url) {
		process.env.DATABASE_URL = ini.database.url.trim();
	}
	if (authSecret && !process.env.AUTH_SECRET) process.env.AUTH_SECRET = authSecret;
	if (!process.env.BOOTSTRAP_ADMIN_EMAIL) process.env.BOOTSTRAP_ADMIN_EMAIL = adminEmail;
	if (adminPass && !process.env.BOOTSTRAP_ADMIN_PASSWORD) process.env.BOOTSTRAP_ADMIN_PASSWORD = adminPass;
	if (!process.env.BOOTSTRAP_ADMIN_AD) process.env.BOOTSTRAP_ADMIN_AD = adminAd;
	if (!process.env.BOOTSTRAP_ADMIN_SOYAD) process.env.BOOTSTRAP_ADMIN_SOYAD = adminSoyad;
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
			firstName: adminAd,
			lastName: adminSoyad,
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

/**
 * Singleton authoritative system configuration instance.
 */
export const CONFIG: SystemConfig = buildConfig();
