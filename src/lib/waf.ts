/**
 * Pure Web Application Firewall (WAF) & AI Scanner signature detector.
 * Kept pure (no `@/` imports) so `scripts/check-pure.mjs` can test every rule.
 */
export type { WafCategory, WafInspectionResult } from './waf/rules.ts';
export {
	inspectRequestComponents,
	inspectRequestPayload,
	inspectJsonPayload,
} from './waf/requestWaf.ts';
export type { DatabaseSqlCheckResult } from './waf/sqlGuard.ts';
export {
	DB_SENSITIVE_COLUMNS,
	inspectDatabaseSql,
	maskDatabaseRow,
} from './waf/sqlGuard.ts';
