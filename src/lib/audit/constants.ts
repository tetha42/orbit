/** Records older than this are deleted (see src/db/audit.ts). `AUDIT_RETENTION_DAYS` overrides it. */
export const AUDIT_RETENTION_DAYS = 730;

export const AUDIT_ACTIONS = [
	'role.create',
	'role.edit',
	'role.delete',
	'role.default',
	'member.role_grant',
	'member.role_revoke',
	'member.delete',
	'member.graduate',
	'member.activate',
	'member.status',
	'member.profile',
	'member.email',
	'member.anonymize',
	'member.password_reset',
	'application.approve',
	'application.reject',
	'setting.smtp',
	'security.2fa_disable',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_TARGET_TYPES = ['role', 'member', 'setting'] as const;
export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

/** Who is acting and from where; built once per request. */
export interface AuditContext {
	actorId: string | null;
	actorName: string;
	ip: string;
}

export type AuditValue = string | number | boolean | null | AuditValue[] | { [key: string]: AuditValue };
export type AuditFields = { [key: string]: AuditValue };

/** What the API and the panel exchange. */
export interface AuditRecord {
	id: string;
	timestamp?: number;
	actorId?: string | null;
	actorName?: string;
	action?: string;
	targetType?: string;
	targetId?: string | null;
	targetName?: string;
	before?: AuditFields | null;
	after?: AuditFields | null;
	ip: string;
}
