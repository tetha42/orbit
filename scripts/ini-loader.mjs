import fs from 'node:fs';
import path from 'node:path';

/**
 * Lightweight, zero-dependency INI parser.
 * Supports sections [section], key = value pairs, comments (# and ;),
 * and stripped quotes.
 */
export function parseIniContent(content) {
	const result = {};
	let currentSection = '';

	const lines = content.split(/\r?\n/);
	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#') || line.startsWith(';')) continue;

		// Section header [section]
		const sectionMatch = line.match(/^\[(.*?)\]$/);
		if (sectionMatch) {
			currentSection = sectionMatch[1].trim().toLowerCase();
			if (!result[currentSection]) result[currentSection] = {};
			continue;
		}

		// Key = value
		const eqIdx = line.indexOf('=');
		if (eqIdx > 0) {
			const rawKey = line.slice(0, eqIdx).trim().toLowerCase();
			let rawVal = line.slice(eqIdx + 1).trim();

			// Remove trailing inline comments
			const commentIdx = rawVal.search(/\s[#;]/);
			if (commentIdx >= 0) {
				rawVal = rawVal.slice(0, commentIdx).trim();
			}

			// Unquote
			if ((rawVal.startsWith('"') && rawVal.endsWith('"')) || (rawVal.startsWith("'") && rawVal.endsWith("'"))) {
				rawVal = rawVal.slice(1, -1);
			}

			if (currentSection) {
				if (!result[currentSection]) result[currentSection] = {};
				result[currentSection][rawKey] = rawVal;
			} else {
				result[rawKey] = rawVal;
			}
		}
	}
	return result;
}

/**
 * Maps optional config.ini sections to standard system process.env variables.
 * Preserves existing OS process.env variables (OS ENV > config.ini).
 * Never creates or writes any .env or config.ini files to disk.
 */
export function loadConfigIni(rootDir = process.cwd()) {
	const iniPath = path.join(rootDir, 'config.ini');
	if (!fs.existsSync(iniPath)) return null;

	try {
		const content = fs.readFileSync(iniPath, 'utf8');
		const ini = parseIniContent(content);

		const mapping = {
			// [database]
			'database.url': 'DATABASE_URL',
			// [security]
			'security.auth_secret': 'AUTH_SECRET',
			'security.webauthn_origin': 'WEBAUTHN_ORIGIN',
			'security.webauthn_rp_id': 'WEBAUTHN_RP_ID',
			// [bootstrap_admin]
			'bootstrap_admin.email': 'BOOTSTRAP_ADMIN_EMAIL',
			'bootstrap_admin.password': 'BOOTSTRAP_ADMIN_PASSWORD',
			'bootstrap_admin.first_name': 'BOOTSTRAP_ADMIN_AD',
			'bootstrap_admin.last_name': 'BOOTSTRAP_ADMIN_SOYAD',
			// [club_preset]
			'club_preset.name': 'CLUB_NAME',
			'club_preset.university': 'CLUB_UNIVERSITY',
			'club_preset.domain': 'CLUB_DOMAIN',
			'club_preset.president_name': 'CLUB_PRESIDENT_NAME',
			'club_preset.president_title': 'CLUB_PRESIDENT_TITLE',
			'club_preset.advisor_name': 'CLUB_ADVISOR_NAME',
			'club_preset.advisor_title': 'CLUB_ADVISOR_TITLE',
			// [smtp]
			'smtp.host': 'SMTP_HOST',
			'smtp.port': 'SMTP_PORT',
			'smtp.user': 'SMTP_USER',
			'smtp.password': 'SMTP_PASS',
			'smtp.from': 'SMTP_FROM',
			// [storage]
			'storage.upload_dir': 'UPLOAD_DIR',
			// [public_api]
			'public_api.allowed_origins': 'PUBLIC_API_ALLOWED_ORIGINS',
			'public_api.base_url': 'PUBLIC_BASE_URL',
			// [terminal]
			'terminal.enabled': 'TERMINAL_ENABLED',
		};

		for (const [iniKey, envVar] of Object.entries(mapping)) {
			const [sec, key] = iniKey.split('.');
			const val = ini[sec]?.[key];
			if (val !== undefined && val !== '' && !process.env[envVar]) {
				process.env[envVar] = String(val);
			}
		}

		return ini;
	} catch (err) {
		console.warn('[config.ini Loader Warning]:', err.message);
		return null;
	}
}

/**
 * Legacy no-op helper retained for script compatibility.
 * Zero-config policy: never writes .env files to disk unless ORBIT_WRITE_CONFIG_INI === '1'.
 */
export function syncDockerEnv(_rootDir = process.cwd(), _ini) {
	// Zero-config architecture: Docker Compose uses inline defaults directly.
}
