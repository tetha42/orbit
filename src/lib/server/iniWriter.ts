import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config';

export type IniUpdates = Record<string, Record<string, string | number | boolean | undefined | null>>;

/**
 * Synchronizes configuration updates into in-memory CONFIG and process.env.
 * Never creates or writes `config.ini` to disk unless `process.env.ORBIT_WRITE_CONFIG_INI === '1'`.
 */
export function updateConfigIniSync(
	updates: IniUpdates,
	customPath?: string
): void {
	// Normalize updates structure
	const pendingUpdates: Record<string, Record<string, string>> = {};
	for (const [sec, kv] of Object.entries(updates)) {
		const normalizedSec = sec.trim().toLowerCase();
		pendingUpdates[normalizedSec] = {};
		for (const [k, v] of Object.entries(kv)) {
			if (v !== undefined && v !== null) {
				pendingUpdates[normalizedSec][k.trim().toLowerCase()] = String(v);
			}
		}
	}

	// Always apply updates to process.env and CONFIG in memory immediately
	applyToMemory(pendingUpdates);

	// Persist runtime state to gitignored data/runtime-config.json so dev/prod server restarts retain DB & branding
	try {
		const rootDir = process.cwd();
		const dataDir = path.join(rootDir, 'data');
		if (!fs.existsSync(/*turbopackIgnore: true*/ dataDir)) {
			fs.mkdirSync(/*turbopackIgnore: true*/ dataDir, { recursive: true });
		}
		const runtimePath = path.join(dataDir, 'runtime-config.json');
		let currentRuntime: Record<string, Record<string, string>> = {};
		if (fs.existsSync(/*turbopackIgnore: true*/ runtimePath)) {
			try {
				currentRuntime = JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ runtimePath, 'utf8')) || {};
			} catch {
				currentRuntime = {};
			}
		}
		for (const [sec, kv] of Object.entries(pendingUpdates)) {
			currentRuntime[sec] = { ...(currentRuntime[sec] || {}), ...kv };
		}
		fs.writeFileSync(/*turbopackIgnore: true*/ runtimePath, JSON.stringify(currentRuntime, null, 2), 'utf8');
	} catch {
		// Ignore on read-only filesystems
	}

	// Only write config.ini to repo root if explicitly enabled via ORBIT_WRITE_CONFIG_INI === '1'
	if (process.env.ORBIT_WRITE_CONFIG_INI !== '1') {
		return;
	}

	const rootDir = process.cwd();
	const iniPath = customPath || path.join(rootDir, 'config.ini');

	let lines: string[] = [];
	if (fs.existsSync(/*turbopackIgnore: true*/ iniPath)) {
		const raw = fs.readFileSync(/*turbopackIgnore: true*/ iniPath, 'utf8');
		lines = raw.split(/\r?\n/);
	} else {
		lines = [
			'# ===========================================================================',
			'# Orbit Community OS — System Configuration (config.ini)',
			'# ===========================================================================',
			'',
		];
	}

	const newLines: string[] = [];
	let currentSection: string | null = null;
	const touchedKeysBySection: Record<string, Set<string>> = {};

	const flushRemainingSectionKeys = (sec: string) => {
		const remaining = pendingUpdates[sec];
		if (!remaining) return;
		const touched = touchedKeysBySection[sec] || new Set();
		for (const [k, v] of Object.entries(remaining)) {
			if (!touched.has(k)) {
				newLines.push(`${k} = ${v}`);
				touched.add(k);
			}
		}
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		const sectionMatch = trimmed.match(/^\[(.*?)\]$/);
		if (sectionMatch) {
			if (currentSection) {
				flushRemainingSectionKeys(currentSection);
			}
			currentSection = sectionMatch[1].trim().toLowerCase();
			if (!touchedKeysBySection[currentSection]) {
				touchedKeysBySection[currentSection] = new Set();
			}
			newLines.push(line);
			continue;
		}

		if (currentSection && pendingUpdates[currentSection]) {
			const eqIdx = line.indexOf('=');
			if (eqIdx > 0 && !trimmed.startsWith('#') && !trimmed.startsWith(';')) {
				const key = line.slice(0, eqIdx).trim().toLowerCase();
				if (key in pendingUpdates[currentSection]) {
					const newVal = pendingUpdates[currentSection][key];
					touchedKeysBySection[currentSection].add(key);

					// Preserve leading whitespace
					const indent = line.match(/^\s*/)?.[0] || '';
					// Preserve trailing comment if present
					const rawVal = line.slice(eqIdx + 1);
					const commentIdx = rawVal.search(/\s[#;]/);
					const trailingComment = commentIdx >= 0 ? rawVal.slice(commentIdx) : '';

					newLines.push(`${indent}${key} = ${newVal}${trailingComment}`);
					continue;
				}
			}
		}

		newLines.push(line);
	}

	if (currentSection) {
		flushRemainingSectionKeys(currentSection);
	}

	// Add any sections that were completely absent
	for (const [sec, kv] of Object.entries(pendingUpdates)) {
		if (!touchedKeysBySection[sec]) {
			newLines.push('');
			newLines.push(`[${sec}]`);
			for (const [k, v] of Object.entries(kv)) {
				newLines.push(`${k} = ${v}`);
			}
			touchedKeysBySection[sec] = new Set(Object.keys(kv));
		}
	}

	// Write file atomically
	const output = newLines.join('\n') + (newLines[newLines.length - 1] === '' ? '' : '\n');
	const tempPath = `${iniPath}.tmp.${Date.now()}`;
	fs.writeFileSync(/*turbopackIgnore: true*/ tempPath, output, 'utf8');
	fs.renameSync(/*turbopackIgnore: true*/ tempPath, /*turbopackIgnore: true*/ iniPath);
}

export async function updateConfigIni(
	updates: IniUpdates,
	customPath?: string
): Promise<void> {
	updateConfigIniSync(updates, customPath);
}

function applyToMemory(updates: Record<string, Record<string, string>>): void {
	if (updates.database?.url !== undefined) {
		process.env.DATABASE_URL = updates.database.url;
		CONFIG.database.url = updates.database.url;
	}
	if (updates.database?.max_connections !== undefined) {
		CONFIG.database.maxConnections = Number(updates.database.max_connections) || 30;
	}
	if (updates.security?.auth_secret !== undefined) {
		process.env.AUTH_SECRET = updates.security.auth_secret;
		CONFIG.security.authSecret = updates.security.auth_secret;
	}
	if (updates.security?.webauthn_origin !== undefined) {
		process.env.WEBAUTHN_ORIGIN = updates.security.webauthn_origin;
		CONFIG.security.webauthnOrigin = updates.security.webauthn_origin;
	}
	if (updates.security?.webauthn_rp_id !== undefined) {
		process.env.WEBAUTHN_RP_ID = updates.security.webauthn_rp_id;
		CONFIG.security.webauthnRpId = updates.security.webauthn_rp_id;
	}
	if (updates.bootstrap_admin?.email !== undefined) {
		process.env.BOOTSTRAP_ADMIN_EMAIL = updates.bootstrap_admin.email;
		CONFIG.bootstrapAdmin.email = updates.bootstrap_admin.email;
	}
	if (updates.bootstrap_admin?.first_name !== undefined) {
		process.env.BOOTSTRAP_ADMIN_AD = updates.bootstrap_admin.first_name;
		CONFIG.bootstrapAdmin.firstName = updates.bootstrap_admin.first_name;
	}
	if (updates.bootstrap_admin?.last_name !== undefined) {
		process.env.BOOTSTRAP_ADMIN_SOYAD = updates.bootstrap_admin.last_name;
		CONFIG.bootstrapAdmin.lastName = updates.bootstrap_admin.last_name;
	}
	if (updates.club_preset?.name !== undefined) {
		process.env.CLUB_NAME = updates.club_preset.name;
		CONFIG.clubPreset.name = updates.club_preset.name;
	}
	if (updates.club_preset?.university !== undefined) {
		process.env.CLUB_UNIVERSITY = updates.club_preset.university;
		CONFIG.clubPreset.university = updates.club_preset.university;
	}
	if (updates.club_preset?.domain !== undefined) {
		process.env.CLUB_DOMAIN = updates.club_preset.domain;
		CONFIG.clubPreset.domain = updates.club_preset.domain;
	}
	if (updates.club_preset?.president_name !== undefined) {
		process.env.CLUB_PRESIDENT_NAME = updates.club_preset.president_name;
		process.env.ORBIT_PRESIDENT_NAME = updates.club_preset.president_name;
		CONFIG.clubPreset.presidentName = updates.club_preset.president_name;
	}
	if (updates.club_preset?.president_title !== undefined) {
		process.env.CLUB_PRESIDENT_TITLE = updates.club_preset.president_title;
		CONFIG.clubPreset.presidentTitle = updates.club_preset.president_title;
	}
	if (updates.club_preset?.advisor_name !== undefined) {
		process.env.CLUB_ADVISOR_NAME = updates.club_preset.advisor_name;
		process.env.ORBIT_ADVISOR_NAME = updates.club_preset.advisor_name;
		CONFIG.clubPreset.advisorName = updates.club_preset.advisor_name;
	}
	if (updates.club_preset?.advisor_title !== undefined) {
		process.env.CLUB_ADVISOR_TITLE = updates.club_preset.advisor_title;
		CONFIG.clubPreset.advisorTitle = updates.club_preset.advisor_title;
	}
	if (updates.smtp?.host !== undefined) {
		process.env.SMTP_HOST = updates.smtp.host;
		CONFIG.smtp.host = updates.smtp.host;
	}
	if (updates.smtp?.port !== undefined) {
		const port = Number(updates.smtp.port) || 465;
		process.env.SMTP_PORT = String(port);
		CONFIG.smtp.port = port;
	}
	if (updates.smtp?.user !== undefined) {
		process.env.SMTP_USER = updates.smtp.user;
		CONFIG.smtp.user = updates.smtp.user;
	}
	if (updates.smtp?.password !== undefined) {
		process.env.SMTP_PASS = updates.smtp.password;
		CONFIG.smtp.password = updates.smtp.password;
	}
	if (updates.smtp?.from !== undefined) {
		process.env.SMTP_FROM = updates.smtp.from;
		CONFIG.smtp.from = updates.smtp.from;
	}
}
