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

export function parseIniSync(content: string): Record<string, Record<string, string>> {
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

export function readRuntimeConfigSync(rootDir: string): Record<string, Record<string, string>> {
	const runtimePath = path.resolve(/*turbopackIgnore: true*/ [rootDir, 'data', 'runtime-config.json'].join(path.sep));
	if (!fs.existsSync(/*turbopackIgnore: true*/ runtimePath)) return {};
	try {
		const raw = fs.readFileSync(/*turbopackIgnore: true*/ runtimePath, 'utf8');
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === 'object') {
			return parsed as Record<string, Record<string, string>>;
		}
	} catch {
		// Ignore malformed runtime config
	}
	return {};
}

/**
 * Reads a secret from Docker secret mounts (/run/secrets/<name>), an env var pointing
 * to a file (<NAME>_FILE), the direct process environment (<NAME>), or fallback.
 */
export function readSecret(secretName: string, envVar: string, fallback = ''): string {
	const secretCandidates = [
		path.join('/run/secrets', secretName),
		path.join('/run/secrets', secretName.toLowerCase()),
	];
	for (const candidate of secretCandidates) {
		try {
			if (fs.existsSync(/*turbopackIgnore: true*/ candidate)) {
				const val = fs.readFileSync(/*turbopackIgnore: true*/ candidate, 'utf8').trim();
				if (val) return val;
			}
		} catch {
			// Ignore read errors
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
			// Ignore read errors
		}
	}

	const envVal = process.env[envVar]?.trim();
	if (envVal) return envVal;

	return fallback;
}
