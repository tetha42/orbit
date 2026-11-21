import { diffRows, type AuditRecord } from '@/lib/audit';
import type { AuditCopy } from './i18nAudit';

export interface AuditResponse {
	records: AuditRecord[];
	total: number;
	page: number;
	size: number;
}

export type CategoryType = 'all' | 'roles' | 'members' | 'security';
export type DatePresetType = 'all' | 'today' | '7d' | '30d' | 'custom';
export type ActionTone = 'create' | 'update' | 'delete' | 'security';

export function getActionCategory(action: string): 'roles' | 'members' | 'security' {
	if (action.startsWith('role.')) return 'roles';
	if (action.startsWith('member.') || action.startsWith('application.')) return 'members';
	return 'security';
}

export function getActionTone(action: string): ActionTone {
	if (
		action.includes('create') ||
		action.includes('grant') ||
		action.includes('approve') ||
		action.includes('activate')
	) {
		return 'create';
	}
	if (
		action.includes('delete') ||
		action.includes('revoke') ||
		action.includes('reject') ||
		action.includes('disable')
	) {
		return 'delete';
	}
	if (
		action.includes('2fa') ||
		action.includes('smtp') ||
		action.includes('security') ||
		action.includes('password')
	) {
		return 'security';
	}
	return 'update';
}

export function formatRelativeTime(timestamp: number, copy: AuditCopy): string {
	const now = Date.now();
	const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));
	if (diffSec < 60) return copy.justNow;
	const diffMin = Math.floor(diffSec / 60);
	if (diffMin < 60) return `${diffMin}${copy.minsAgoSuffix}`;
	const diffHours = Math.floor(diffMin / 60);
	if (diffHours < 24) return `${diffHours}${copy.hoursAgoSuffix}`;
	const diffDays = Math.floor(diffHours / 24);
	if (diffDays < 7) return `${diffDays}${copy.daysAgoSuffix}`;
	return new Date(timestamp).toLocaleDateString(copy.shortDateLocale, {
		month: 'short',
		day: 'numeric',
	});
}

export function getDiffSummary(
	record: AuditRecord,
	t: (k: string, f?: string) => string,
	copy: AuditCopy
): string | null {
	const diffs = diffRows(record.before ?? null, record.after ?? null);
	if (!diffs || diffs.length === 0) return null;

	const roleDiff = diffs.find((d) => d.field === 'roleId' || d.field === 'roleName');
	if (roleDiff) {
		const newVal = String(roleDiff.after || '—');
		return `${copy.diffRolePrefix}: ${newVal}`;
	}

	const permDiffs = diffs.filter((d) => d.field.startsWith('izinler.'));
	if (permDiffs.length > 0) {
		return `${permDiffs.length} ${copy.diffPermChangesSuffix}`;
	}

	if (diffs.length === 1) {
		const fieldName = t(`auditField_${diffs[0].field}`, diffs[0].field);
		return `${fieldName} ${copy.diffUpdatedSuffix}`;
	}

	return `${diffs.length} ${copy.diffFieldsModifiedSuffix}`;
}
