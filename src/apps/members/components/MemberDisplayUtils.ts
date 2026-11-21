import { isAlumniRole } from '@/core/permissions';
import type { MemberRecord } from '../types';

export function getMemberDisplayRole(
	member: MemberRecord,
	t: (key: string, fallback?: string) => string
): { name: string; color: string } | null {
	const isAlumni = member.status === 'alumni' || isAlumniRole({ id: member.roleId, name: member.roleName });
	if (isAlumni) {
		const hasAlumniRole = isAlumniRole({ id: member.roleId, name: member.roleName });
		return {
			name: hasAlumniRole ? (member.roleName ?? t('membersStatusAlumni')) : t('membersStatusAlumni'),
			color: hasAlumniRole ? (member.roleColor ?? '#64d2ff') : '#64d2ff',
		};
	}
	if (member.roleId) {
		return { name: member.roleName ?? '—', color: member.roleColor ?? '#8e8e93' };
	}
	return null;
}

export function getMemberStatusLabel(
	status: MemberRecord['status'],
	t: (key: string, fallback?: string) => string
): string {
	switch (status) {
		case 'active':
			return t('membersStatusActive');
		case 'pending':
			return t('membersStatusPending');
		case 'alumni':
			return t('membersStatusAlumni');
		default:
			return t('membersStatusRejected');
	}
}
