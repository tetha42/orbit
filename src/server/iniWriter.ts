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
	// Normalize updates structure and strip CR/LF characters to prevent INI section/key injection
	const pendingUpdates: Record<string, Record<string, string>> = {};
	for (const [sec, kv] of Object.entries(updates)) {
		const normalizedSection = sec.replace(/[\r\n\[\]]+/g, '').trim().toLowerCase();
		if (!normalizedSection) continue;
		pendingUpdates[normalizedSection] = {};
		for (const [k, v] of Object.entries(kv)) {
			if (v !== undefined && v !== null) {
				const cleanKey = k.replace(/[\r\n=]+/g, '').trim().toLowerCase();
				if (!cleanKey) continue;
				pendingUpdates[normalizedSection][cleanKey] = String(v).replace(/[\r\n]+/g, ' ').trim();
			}
		}
	}

	// Always apply updates to process.env and CONFIG in memory immediately
	applyToMemory(pendingUpdates);

	// Persist runtime state to gitignored data/runtime-config.json so dev/prod server restarts retain DB & branding
	try {
		const rootDir = process.cwd();
		const dataDir = path.resolve(/*turbopackIgnore: true*/ [rootDir, 'data'].join(path.sep));
		if (!fs.existsSync(/*turbopackIgnore: true*/ dataDir)) {
			fs.mkdirSync(/*turbopackIgnore: true*/ dataDir, { recursive: true, mode: 0o700 });
		}
		const runtimePath = path.resolve(/*turbopackIgnore: true*/ [dataDir, 'runtime-config.json'].join(path.sep));
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
		fs.writeFileSync(/*turbopackIgnore: true*/ runtimePath, JSON.stringify(currentRuntime, null, 2), {
			encoding: 'utf8',
			mode: 0o600,
		});
		try {
			fs.chmodSync(/*turbopackIgnore: true*/ runtimePath, 0o600);
		} catch {
			// Best-effort POSIX permission hardening
		}
	} catch {
		// Ignore on read-only filesystems
	}

	// Only write config.ini to repo root if explicitly enabled via ORBIT_WRITE_CONFIG_INI === '1'
	if (process.env.ORBIT_WRITE_CONFIG_INI !== '1') {
		return;
	}

	const rootDir = process.cwd();
	const iniPath = customPath || path.resolve(/*turbopackIgnore: true*/ [rootDir, 'config.ini'].join(path.sep));

	let lines: string[] = [];
	if (fs.existsSync(/*turbopackIgnore: true*/ iniPath)) {
		const raw = fs.readFileSync(/*turbopackIgnore: true*/ iniPath, 'utf8');
		lines = raw.split(/\r?\n/);
	} else {
		lines = ['# ===========================================================================', '# Orbit Community OS — System Configuration (config.ini)', ''];
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

	// Write file atomically with owner-only permissions (0o600)
	const output = newLines.join('\n') + (newLines[newLines.length - 1] === '' ? '' : '\n');
	const tempPath = `${iniPath}.tmp.${Date.now()}`;
	fs.writeFileSync(/*turbopackIgnore: true*/ tempPath, output, { encoding: 'utf8', mode: 0o600 });
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
	const ba = updates.bootstrap_admin;
	if (ba) {
		if (ba.email !== undefined) { process.env.BOOTSTRAP_ADMIN_EMAIL = ba.email; CONFIG.bootstrapAdmin.email = ba.email; }
		if (ba.first_name !== undefined) { process.env.BOOTSTRAP_ADMIN_FIRST_NAME = ba.first_name; CONFIG.bootstrapAdmin.firstName = ba.first_name; }
		if (ba.last_name !== undefined) { process.env.BOOTSTRAP_ADMIN_LAST_NAME = ba.last_name; CONFIG.bootstrapAdmin.lastName = ba.last_name; }
	}
	const cp = updates.club_preset;
	if (cp) {
		if (cp.name !== undefined) { process.env.CLUB_NAME = cp.name; CONFIG.clubPreset.name = cp.name; }
		if (cp.university !== undefined) { process.env.CLUB_UNIVERSITY = cp.university; CONFIG.clubPreset.university = cp.university; }
		if (cp.domain !== undefined) { process.env.CLUB_DOMAIN = cp.domain; CONFIG.clubPreset.domain = cp.domain; }
		if (cp.president_name !== undefined) {
			process.env.CLUB_PRESIDENT_NAME = cp.president_name;
			process.env.ORBIT_PRESIDENT_NAME = cp.president_name;
			CONFIG.clubPreset.presidentName = cp.president_name;
		}
		if (cp.president_title !== undefined) { process.env.CLUB_PRESIDENT_TITLE = cp.president_title; CONFIG.clubPreset.presidentTitle = cp.president_title; }
		if (cp.advisor_name !== undefined) {
			process.env.CLUB_ADVISOR_NAME = cp.advisor_name;
			process.env.ORBIT_ADVISOR_NAME = cp.advisor_name;
			CONFIG.clubPreset.advisorName = cp.advisor_name;
		}
		if (cp.advisor_title !== undefined) { process.env.CLUB_ADVISOR_TITLE = cp.advisor_title; CONFIG.clubPreset.advisorTitle = cp.advisor_title; }
	}
	const sm = updates.smtp;
	if (sm) {
		if (sm.host !== undefined) { process.env.SMTP_HOST = sm.host; CONFIG.smtp.host = sm.host; }
		if (sm.port !== undefined) { const port = Number(sm.port) || 465; process.env.SMTP_PORT = String(port); CONFIG.smtp.port = port; }
		if (sm.user !== undefined) { process.env.SMTP_USER = sm.user; CONFIG.smtp.user = sm.user; }
		if (sm.password !== undefined) { process.env.SMTP_PASS = sm.password; CONFIG.smtp.password = sm.password; }
		if (sm.from !== undefined) { process.env.SMTP_FROM = sm.from; CONFIG.smtp.from = sm.from; }
	}
}
