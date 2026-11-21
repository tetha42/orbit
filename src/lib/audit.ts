/**
 * Audit log helpers (Settings -> Roles -> Change history) — pure: no
 * imports outside local sub-modules, so scripts/check-pure.mjs can test them directly.
 */
export type {
	AuditAction,
	AuditTargetType,
	AuditContext,
	AuditValue,
	AuditFields,
	AuditRecord,
} from './audit/constants.ts';
export { AUDIT_RETENTION_DAYS, AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from './audit/constants.ts';
export type { RoleSummary } from './audit/sanitize.ts';
export {
	FORBIDDEN_KEY,
	sanitizeValue,
	clear,
	recordFields,
	sanitizeIp,
	cleanIp,
	roleSummary,
	memberSummary,
	memberTargetName,
} from './audit/sanitize.ts';
export type { DiffRow, DiffResult, Diff } from './audit/diff.ts';
export {
	diffRows,
	fieldDiff,
	roleDiff,
	SMTP_PASSWORD_KEY,
	SMTP_FIELDS,
	smtpDiff,
	statusAction,
} from './audit/diff.ts';
export type { AuditFilter } from './audit/filterAndCsv.ts';
export {
	AUDIT_PAGE_SIZE,
	AUDIT_MAX_PAGE_SIZE,
	AUDIT_CSV_LIMIT,
	parseAuditFilter,
	startOfDay,
	AUDIT_CSV_HEADERS,
	auditCsvRows,
	retentionDays,
	formatAuditAction,
} from './audit/filterAndCsv.ts';
