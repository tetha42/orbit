const DB_FORBIDDEN_OS_PRIMITIVE_RE =
	/\b(?:COPY\b|pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_file|lo_import|lo_export|dblink)\b|\bDO\s*(?:\$|\b)/i;

const DB_PROTECTED_TABLE_NAME_RE =
	/\b(?:system_logs|audit_logs|security_blocks|webauthn_credentials|verification_tokens|oauth_clients|user_sessions|device_login_approvals)\b/i;

const DB_MUTATION_OR_DDL_RE =
	/\b(?:DROP|TRUNCATE|DELETE|UPDATE|INSERT|ALTER|CREATE|GRANT|REVOKE|COMMENT|SECURITY|POLICY|RULE|TRIGGER|RENAME)\b/i;

const DB_PROTECTED_SETTINGS_KEY_RE =
	/\b(?:soc_lockdown_mode|soc_lockdown_reason|smtp_pass|auth_secret|soc_webhook_config)\b/i;

const DB_SENSITIVE_COLUMN_REF_RE = new RegExp(
	'\\b(?:password_hash|passwordhash|totp_secret|totpsecret|session_token|sessiontoken|' +
		'totp_recovery_codes|totprecoverycodes|secret_hash|secrethash|smtp_pass|' +
		'token_hash|tokenhash|code_hash|codehash|auth_secret|soc_webhook_config)\\b',
	'i'
);

const DB_TX_BREAKOUT_RE =
	/\b(?:COMMIT|ROLLBACK|END|BEGIN|START\s+TRANSACTION|SAVEPOINT|RELEASE\s+SAVEPOINT|SET\s+TRANSACTION|SET\s+SESSION|SET\s+LOCAL|SET\s+default_transaction_read_only|RESET\s+ALL)\b/i;

const DB_JSON_ROW_SERIALIZER_RE =
	/\b(?:to_json|to_jsonb|row_to_json|json_agg|jsonb_agg|json_build_object|jsonb_build_object|to_record|hstore)\s*\(/i;

const DB_SENSITIVE_ROW_TABLES_RE =
	/\b(?:users|system_settings|webauthn_credentials|verification_tokens|oauth_clients|user_sessions|device_login_approvals)\b/i;

export const DB_SENSITIVE_COLUMNS = new Set([
	'password_hash', 'passwordhash', 'totp_secret', 'totpsecret', 'session_token', 'sessiontoken',
	'totp_recovery_codes', 'totprecoverycodes', 'secret_hash', 'secrethash', 'smtp_pass',
	'token_hash', 'tokenhash', 'code_hash', 'codehash',
]);

const DB_SENSITIVE_SETTING_KEYS = new Set(['smtp_pass', 'auth_secret', 'soc_webhook_config']);
const DB_SENSITIVE_VALUE_RE = /^(?:\$2[aby]\$\d{2}\$|enc:v1:)/;

export interface DatabaseSqlCheckResult {
	allowed: boolean;
	strikePoints: number;
	reason?: string;
	normalizedExplainTarget?: string;
}

/**
 * Single-pass SQL lexer that strips comments only outside single-quoted strings,
 * double-quoted identifiers, and dollar-quoted literals, while counting statements.
 */
export function stripSqlCommentsAndSplitStatements(sql: string): {
	cleaned: string;
	statementCount: number;
} {
	const src = String(sql || '');
	const len = src.length;
	let out = '';
	let i = 0;
	let statements = 0;
	let hasTokensInCurrent = false;

	while (i < len) {
		const ch = src[i];
		const next = i + 1 < len ? src[i + 1] : '';

		if (ch === '-' && next === '-') {
			i += 2;
			while (i < len && src[i] !== '\n') i++;
			out += ' ';
			continue;
		}
		if (ch === '/' && next === '*') {
			i += 2;
			while (i < len && !(src[i] === '*' && src[i + 1] === '/')) i++;
			if (i < len) i += 2;
			out += ' ';
			continue;
		}
		if (ch === "'" || ch === '"') {
			const quote = ch;
			hasTokensInCurrent = true;
			out += ch;
			i++;
			while (i < len) {
				const c = src[i++];
				out += c;
				if (c === quote) {
					if (i < len && src[i] === quote) {
						out += src[i++];
						continue;
					}
					break;
				}
			}
			continue;
		}
		if (ch === '$') {
			const tagMatch = src.slice(i).match(/^\$([A-Za-z0-9_]*)\$/);
			if (tagMatch) {
				const tag = tagMatch[0];
				hasTokensInCurrent = true;
				out += tag;
				i += tag.length;
				const closeIdx = src.indexOf(tag, i);
				if (closeIdx === -1) {
					out += src.slice(i);
					break;
				}
				out += src.slice(i, closeIdx + tag.length);
				i = closeIdx + tag.length;
				continue;
			}
		}
		if (ch === ';') {
			if (hasTokensInCurrent) {
				statements++;
				hasTokensInCurrent = false;
			}
			out += ';';
			i++;
			continue;
		}
		if (!/\s/.test(ch)) hasTokensInCurrent = true;
		out += ch;
		i++;
	}
	if (hasTokensInCurrent) statements++;
	return { cleaned: out.trim(), statementCount: statements };
}

export function inspectDatabaseSql(
	rawQuery: string,
	options?: { isExplain?: boolean }
): DatabaseSqlCheckResult {
	const { cleaned, statementCount } = stripSqlCommentsAndSplitStatements(rawQuery);
	const withoutTrailingSemi = cleaned.replace(/;+\s*$/, '').trim();

	if (!withoutTrailingSemi) {
		return { allowed: false, strikePoints: 0, reason: 'SQL query cannot be empty.' };
	}
	if (DB_FORBIDDEN_OS_PRIMITIVE_RE.test(withoutTrailingSemi)) {
		return {
			allowed: false,
			strikePoints: 60,
			reason:
				'Security policy prohibits execution of operating system primitives, COPY, filesystem access, or anonymous code blocks (DO $$).',
		};
	}
	if (statementCount > 1) {
		return {
			allowed: false,
			strikePoints: 50,
			reason: 'Multiple SQL statements (stacked queries) are prohibited by security policy.',
		};
	}
	if (DB_TX_BREAKOUT_RE.test(withoutTrailingSemi)) {
		return {
			allowed: false,
			strikePoints: 50,
			reason: 'Transaction control commands (COMMIT, ROLLBACK, BEGIN, SAVEPOINT, SET) are prohibited.',
		};
	}
	if (DB_PROTECTED_TABLE_NAME_RE.test(withoutTrailingSemi) && DB_MUTATION_OR_DDL_RE.test(withoutTrailingSemi)) {
		return {
			allowed: false,
			strikePoints: 40,
			reason: 'Security and audit tables (system_logs, audit_logs, security_blocks) cannot be modified or deleted via SQL.',
		};
	}
	if (/\bsystem_settings\b/i.test(withoutTrailingSemi) && DB_PROTECTED_SETTINGS_KEY_RE.test(withoutTrailingSemi)) {
		return {
			allowed: false,
			strikePoints: 40,
			reason: 'Protected system settings (auth_secret, smtp_pass, soc_webhook_config, soc_lockdown_mode) cannot be accessed or modified via SQL.',
		};
	}
	if (DB_SENSITIVE_COLUMN_REF_RE.test(withoutTrailingSemi)) {
		return {
			allowed: false,
			strikePoints: 35,
			reason:
				'Sensitive authentication and cryptographic columns (password_hash, totp_secret, session_token, ' +
				'totp_recovery_codes, secret_hash, smtp_pass, token_hash, auth_secret) cannot be projected or modified via SQL.',
		};
	}
	if (DB_JSON_ROW_SERIALIZER_RE.test(withoutTrailingSemi) && DB_SENSITIVE_ROW_TABLES_RE.test(withoutTrailingSemi)) {
		return {
			allowed: false,
			strikePoints: 45,
			reason: 'Whole-row JSON serialization functions (row_to_json, to_json, to_jsonb, json_agg) are prohibited on authentication and system tables.',
		};
	}
	if (options?.isExplain) {
		const strippedExplain = withoutTrailingSemi
			.replace(/^EXPLAIN\s*(?:\([^)]*\)\s*|(?:ANALYZE|VERBOSE|BUFFERS|COSTS|TIMING|SUMMARY|SETTINGS|FORMAT\s+\w+)\s+)*/i, '')
			.trim();
		if (DB_MUTATION_OR_DDL_RE.test(strippedExplain)) {
			return {
				allowed: false,
				strikePoints: 30,
				reason: 'Only read-only (SELECT) queries can be executed in EXPLAIN analysis mode.',
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
	const keyVal = typeof clean.key === 'string' ? clean.key.toLowerCase() : '';
	const isSensitiveSettingRow = DB_SENSITIVE_SETTING_KEYS.has(keyVal);

	for (const k of Object.keys(clean)) {
		const val = clean[k];
		if (val === null || val === undefined || val === '') continue;
		const lowerKey = k.toLowerCase();
		if (DB_SENSITIVE_COLUMNS.has(lowerKey)) {
			clean[k] = '••••••••';
		} else if (isSensitiveSettingRow && lowerKey === 'value') {
			clean[k] = '••••••••';
		} else if (typeof val === 'string' && DB_SENSITIVE_VALUE_RE.test(val)) {
			clean[k] = '••••••••';
		}
	}
	return clean;
}
