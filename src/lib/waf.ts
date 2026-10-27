/**
 * Pure Web Application Firewall (WAF) & AI Scanner signature detector.
 *
 * Inspects URL path, query string, and request headers for common exploit
 * payloads (SQLi, XSS, Path Traversal, Command Injection / Log4Shell, and
 * automated offensive scanner fingerprints).
 *
 * Kept pure (no `@/` imports) so `scripts/check-pure.mjs` can test every rule.
 */

export type WafCategory = 'sqli' | 'xss' | 'path_traversal' | 'cmd_injection' | 'scanner';

export interface WafInspectionResult {
	matched: boolean;
	category?: WafCategory;
	points: number;
	signature?: string;
}

const PATH_TRAVERSAL_RE =
	/(?:\.\.[/\\]|%2e%2e(?:%2f|%5c|[/\\])|\/etc\/(?:passwd|shadow|hosts)|\/proc\/self\/|(?:c:|\\windows)\\system32)/i;

const SQLI_QUERY_RE =
	/(?:\bunion\s+(?:all\s+)?select\b|\bselect\b[\s\S]{1,40}\bfrom\s+(?:information_schema|pg_shadow|pg_user|pg_catalog)\b|(?:'|\"|%27|%22)\s*(?:or|and)\s*(?:'[^']*'\s*=\s*'[^']*'|\"[^\"]*\"\s*=\s*\"[^\"]*\"|\b\d+\s*=\s*\d+\b)|\bpg_sleep\s*\(|\bwaitfor\s+delay\b|\bbenchmark\s*\(\s*\d+)/i;

const XSS_QUERY_RE =
	/(?:<\s*script\b|javascript\s*:|on(?:error|load|mouseover|focus)\s*=\s*[^\s>]+|<\s*(?:iframe|svg|img)\b[^>]*\bon\w+\s*=)/i;

const CMD_INJECTION_RE =
	/(?:\$\{jndi:(?:ldap|rmi|dns|nis|iiop|corba|nds|http):|[;|`]\s*(?:cat|ls|whoami|id|uname|curl|wget|bash|sh|nc|ncat)\b|\$\(\s*(?:whoami|id|uname|cat|curl|wget)\b)/i;

const SSTI_QUERY_RE =
	/(?:\{\{\s*(?:\d+\s*[\*+-/]\s*\d+|config|request|app|self|lipsum|cycler|joiner|process|mainModule)\s*\}\}|\$\{\s*(?:\d+\s*[\*+-/]\s*\d+|process|mainModule)\s*\}|<%.*?%>)/i;

const PROTOTYPE_POLLUTION_RE =
	/(?:__proto__|constructor\s*(?:\.|\s*\[\s*['"]?)\s*prototype|\bprototype\b\s*(?:\.\s*\w+|\[))/i;

const OFFENSIVE_SCANNER_UA_RE =
	/\b(?:sqlmap|nikto|nuclei|acunetix|netsparker|nessus|masscan|zgrab|dirbuster|gobuster|feroxbuster|ffuf|wfuzz|wpscan|havij|commix)\b/i;

const AI_RECON_CANARY_PATHS_RE =
	/(?:^\/(?:\.env(?:\..*)?|\.git(?:\/.*)?|\.aws\b|\.ssh\b|wp-admin|wp-login\.php|xmlrpc\.php|phpmyadmin|adminer\.php|actuator\b|swagger-ui|api-docs|\.DS_Store|web\.config|server-status))/i;

function decodeOnce(raw: string): string {
	const plusNormalized = raw.replace(/\+/g, ' ');
	try {
		return decodeURIComponent(plusNormalized);
	} catch {
		return plusNormalized.replace(/(?:%[0-9a-fA-F]{2})+/g, (chunk) => {
			try {
				return decodeURIComponent(chunk);
			} catch {
				return chunk;
			}
		});
	}
}

function safeDecode(raw: string): string {
	const first = decodeOnce(raw);
	const second = first.includes('%') ? decodeOnce(first) : first;
	return second.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

export function inspectRequestComponents(input: {
	pathname: string;
	search?: string;
	userAgent?: string | null;
	referer?: string | null;
}): WafInspectionResult {
	const rawTarget = `${input.pathname || ''}${input.search || ''}`;
	const decodedTarget = `${safeDecode(input.pathname || '')} ${safeDecode(input.search || '')}`;
	const ua = String(input.userAgent || '');
	const ref = String(input.referer || '');

	if (AI_RECON_CANARY_PATHS_RE.test(input.pathname || '')) {
		const m = (input.pathname || '').match(AI_RECON_CANARY_PATHS_RE);
		return {
			matched: true,
			category: 'scanner',
			points: 100,
			signature: `AI & Recon Canary: ${m ? m[0] : 'honeypot'}`,
		};
	}

	if (OFFENSIVE_SCANNER_UA_RE.test(ua)) {
		const m = ua.match(OFFENSIVE_SCANNER_UA_RE);
		return {
			matched: true,
			category: 'scanner',
			points: 80,
			signature: `Scanner UA: ${m ? m[0] : 'bot'}`,
		};
	}

	if (CMD_INJECTION_RE.test(decodedTarget) || CMD_INJECTION_RE.test(ua) || CMD_INJECTION_RE.test(ref)) {
		return {
			matched: true,
			category: 'cmd_injection',
			points: 80,
			signature: 'Command Injection / JNDI probe',
		};
	}

	if (SSTI_QUERY_RE.test(decodedTarget) || SSTI_QUERY_RE.test(rawTarget)) {
		return {
			matched: true,
			category: 'cmd_injection',
			points: 80,
			signature: 'Server-Side Template Injection (SSTI) probe',
		};
	}

	if (PROTOTYPE_POLLUTION_RE.test(rawTarget) || PROTOTYPE_POLLUTION_RE.test(decodedTarget)) {
		return {
			matched: true,
			category: 'cmd_injection',
			points: 75,
			signature: 'Prototype Pollution probe',
		};
	}

	if (PATH_TRAVERSAL_RE.test(rawTarget) || PATH_TRAVERSAL_RE.test(decodedTarget)) {
		return {
			matched: true,
			category: 'path_traversal',
			points: 70,
			signature: 'Path Traversal / LFI probe',
		};
	}

	if (SQLI_QUERY_RE.test(decodedTarget)) {
		return {
			matched: true,
			category: 'sqli',
			points: 65,
			signature: 'SQL Injection query signature',
		};
	}

	if (XSS_QUERY_RE.test(decodedTarget)) {
		return {
			matched: true,
			category: 'xss',
			points: 55,
			signature: 'Reflected XSS query signature',
		};
	}

	return { matched: false, points: 0 };
}

export function inspectRequestPayload(request: Request, bodyText?: string): WafInspectionResult {
	try {
		const url = new URL(request.url);
		return inspectRequestComponents({
			pathname: url.pathname,
			search: `${url.search} ${bodyText || ''}`,
			userAgent: request.headers.get('user-agent'),
			referer: request.headers.get('referer'),
		});
	} catch {
		return { matched: false, points: 0 };
	}
}

function extractStringsFromJson(value: unknown, depth = 0, maxDepth = 5): string[] {
	if (depth > maxDepth || value === null || value === undefined) return [];
	if (typeof value === 'string') return [value];
	if (typeof value === 'number' || typeof value === 'boolean') return [];
	if (Array.isArray(value)) {
		const out: string[] = [];
		for (const item of value) {
			out.push(...extractStringsFromJson(item, depth + 1, maxDepth));
			if (out.length > 50) break;
		}
		return out;
	}
	if (typeof value === 'object') {
		const out: string[] = [];
		const keys = Object.getOwnPropertyNames(value);
		for (const k of keys) {
			out.push(k);
			out.push(...extractStringsFromJson((value as Record<string, unknown>)[k], depth + 1, maxDepth));
			if (out.length > 50) break;
		}
		return out;
	}
	return [];
}

/**
 * Recursively scans parsed JSON request bodies for SQLi, XSS, Command Injection,
 * SSTI, and Prototype Pollution payloads.
 */
export function inspectJsonPayload(json: unknown): WafInspectionResult {
	try {
		const strings = extractStringsFromJson(json);
		for (const text of strings) {
			const res = inspectRequestComponents({
				pathname: '/',
				search: `?data=${encodeURIComponent(text.slice(0, 500))}`,
			});
			if (res.matched) return res;
		}
		return { matched: false, points: 0 };
	} catch {
		return { matched: false, points: 0 };
	}
}

/* ---------------- Zero-Trust Database Studio SQL & Row Guards ---------------- */

const DB_FORBIDDEN_OS_PRIMITIVE_RE =
	/\b(?:COPY\s+[\s\S]*?\bPROGRAM\b|pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_file|lo_import|lo_export|dblink)\b|\bDO\s+\$/i;

const DB_PROTECTED_TABLE_NAME_RE =
	/\b(?:system_logs|sistem_loglari|audit_logs|denetim_kaydi|security_blocks|guvenlik_engelleri|kullanici_passkeyler|erisim_anahtarlari|oauth_istemciler)\b/i;

const DB_MUTATION_OR_DDL_RE =
	/\b(?:DROP|TRUNCATE|DELETE|UPDATE|INSERT|ALTER|CREATE|GRANT|REVOKE|COMMENT|SECURITY|POLICY|RULE|TRIGGER|RENAME)\b/i;

const DB_PROTECTED_SETTINGS_KEY_RE =
	/\b(?:soc_lockdown_mode|soc_lockdown_reason|smtp_pass)\b/i;

const DB_SENSITIVE_COLUMN_REF_RE =
	/\b(?:password_hash|passwordhash|sifrehash|totp_secret|totpsecret|session_token|sessiontoken|aktifoturumtoken|totp_recovery_codes|totprecoverycodes|secret_hash|secrethash|smtp_pass)\b/i;

const DB_EXPLAIN_TX_BREAKOUT_RE =
	/\b(?:COMMIT|ROLLBACK|END|BEGIN|START\s+TRANSACTION|SET\s+TRANSACTION|SET\s+SESSION)\b/i;

export const DB_SENSITIVE_COLUMNS = new Set([
	'password_hash',
	'passwordhash',
	'sifrehash',
	'totp_secret',
	'totpsecret',
	'session_token',
	'sessiontoken',
	'aktifoturumtoken',
	'totp_recovery_codes',
	'totprecoverycodes',
	'secret_hash',
	'secrethash',
	'smtp_pass',
]);

const DB_SENSITIVE_VALUE_RE = /^(?:\$2[aby]\$\d{2}\$|enc:v1:)/;

export interface DatabaseSqlCheckResult {
	allowed: boolean;
	strikePoints: number;
	reason?: string;
	normalizedExplainTarget?: string;
}

export function inspectDatabaseSql(
	rawQuery: string,
	options?: { isExplain?: boolean }
): DatabaseSqlCheckResult {
	const cleaned = String(rawQuery || '')
		.replace(/\/\*[\s\S]*?\*\/|--.*$/gm, ' ')
		.trim();

	if (!cleaned) {
		return { allowed: false, strikePoints: 0, reason: 'SQL sorgusu boş olamaz.' };
	}

	if (DB_FORBIDDEN_OS_PRIMITIVE_RE.test(cleaned)) {
		return {
			allowed: false,
			strikePoints: 60,
			reason: 'Güvenlik politikası gereği işletim sistemi, dosya sistemi veya anonim kod blokları (DO $$) çalıştırılamaz.',
		};
	}

	if (DB_PROTECTED_TABLE_NAME_RE.test(cleaned) && DB_MUTATION_OR_DDL_RE.test(cleaned)) {
		return {
			allowed: false,
			strikePoints: 40,
			reason: 'Güvenlik ve denetim tabloları (sistem_loglari, denetim_kaydi, guvenlik_engelleri) SQL üzerinden değiştirilemez veya silinemez.',
		};
	}

	if (/(?:\bsistem_ayarlari\b|\bsystem_settings\b)/i.test(cleaned) && DB_MUTATION_OR_DDL_RE.test(cleaned) && DB_PROTECTED_SETTINGS_KEY_RE.test(cleaned)) {
		return {
			allowed: false,
			strikePoints: 40,
			reason: 'SoC Kalkan (Lockdown) ve SMTP parola ayarları doğrudan SQL üzerinden değiştirilemez.',
		};
	}

	if (DB_SENSITIVE_COLUMN_REF_RE.test(cleaned)) {
		return {
			allowed: false,
			strikePoints: 35,
			reason: 'Hassas kimlik doğrulama ve kriptografik sütunlar (password_hash, passwordHash, totp_secret, totpSecret, session_token, aktifOturumToken, totp_recovery_codes, totpRecoveryCodes, secret_hash, secretHash, smtp_pass) SQL sorgularında doğrudan projekte edilemez veya değiştirilemez.',
		};
	}

	if (options?.isExplain) {
		const withoutTrailingSemi = cleaned.replace(/;+\s*$/, '').trim();
		if (withoutTrailingSemi.includes(';') || DB_EXPLAIN_TX_BREAKOUT_RE.test(withoutTrailingSemi)) {
			return {
				allowed: false,
				strikePoints: 50,
				reason: 'EXPLAIN analiz kipinde çoklu SQL ifadeleri veya işlem (transaction) kontrol komutları çalıştırılamaz.',
			};
		}
		const strippedExplain = withoutTrailingSemi
			.replace(/^EXPLAIN\s*(?:\([^)]*\)\s*|(?:ANALYZE|VERBOSE|BUFFERS|COSTS|TIMING|SUMMARY|SETTINGS|FORMAT\s+\w+)\s+)*/i, '')
			.trim();
		if (DB_MUTATION_OR_DDL_RE.test(strippedExplain)) {
			return {
				allowed: false,
				strikePoints: 30,
				reason: 'EXPLAIN analiz kipinde yalnızca salt-okunur (SELECT) sorgular çalıştırılabilir.',
			};
		}
		return {
			allowed: true,
			strikePoints: 0,
			normalizedExplainTarget: strippedExplain || withoutTrailingSemi,
		};
	}

	return { allowed: true, strikePoints: 0 };
}

export function maskDatabaseRow(row: Record<string, unknown>): Record<string, unknown> {
	if (!row || typeof row !== 'object') return row;
	const clean: Record<string, unknown> = { ...row };
	const anahtarVal = typeof clean.anahtar === 'string' ? clean.anahtar.toLowerCase() : typeof clean.key === 'string' ? clean.key.toLowerCase() : '';
	const isSensitiveSettingRow = anahtarVal === 'smtp_pass';

	for (const k of Object.keys(clean)) {
		const val = clean[k];
		if (val === null || val === undefined || val === '') continue;
		const lowerKey = k.toLowerCase();
		if (DB_SENSITIVE_COLUMNS.has(lowerKey)) {
			clean[k] = '••••••••';
		} else if (isSensitiveSettingRow && (lowerKey === 'deger' || lowerKey === 'value')) {
			clean[k] = '••••••••';
		} else if (typeof val === 'string' && DB_SENSITIVE_VALUE_RE.test(val)) {
			clean[k] = '••••••••';
		}
	}
	return clean;
}
