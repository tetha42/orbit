import { useMemo, useState } from 'react';
import { ALUMNI_ROLE_ID } from '@/core/permissions';
import type { FormFieldOption } from '@/lib/formFields';
import type { RegistrationCoreConfig } from '@/lib/i18n/data/registrationConfig';
import type { AssignableRole, MemberRecord } from '../types';

export type MemberStatusFilter = 'all' | 'active' | 'pending' | 'alumni';

interface UseMemberFiltersParams {
	members: MemberRecord[];
	roles: AssignableRole[];
	coreConfig: RegistrationCoreConfig;
}

export function useMemberFilters({
	members,
	roles,
	coreConfig,
}: UseMemberFiltersParams) {
	const [searchQuery, setSearchQuery] = useState('');
	const [activeFilter, setActiveFilter] = useState<MemberStatusFilter>('all');
	const [roleFilter, setRoleFilter] = useState('');
	const [selectedDepartment, setSelectedDepartment] = useState('');
	const [selectedGrade, setSelectedGrade] = useState<number>(0);

	const hasRolelessMember = useMemo(
		() => members.some((member) => !member.roleId),
		[members],
	);

	const roleOptions = useMemo<[string, string][]>(() => {
		const map = new Map<string, string>();
		for (const role of roles) {
			if (role.id && role.name) map.set(role.id, role.name);
		}
		for (const member of members) {
			if (member.roleId && !map.has(member.roleId)) {
				map.set(member.roleId, member.roleName ?? member.roleId);
			}
		}
		return Array.from(map.entries());
	}, [members, roles]);

	const trackOptions = useMemo<FormFieldOption[]>(() => {
		const known = new Set(coreConfig.track.options.map((opt) => opt.value));
		const extras: FormFieldOption[] = [];
		for (const member of members) {
			const dept = member.department?.trim();
			if (dept && !known.has(dept)) {
				known.add(dept);
				extras.push({ value: dept, labelTr: dept, labelEn: dept });
			}
		}
		return [...coreConfig.track.options, ...extras];
	}, [coreConfig.track.options, members]);

	const filteredMembers = useMemo(() => {
		const query = searchQuery.trim().toLowerCase();
		return members.filter((member) => {
			if (activeFilter === 'alumni') {
				if (member.status !== 'alumni' && member.roleId !== ALUMNI_ROLE_ID) return false;
			} else if (activeFilter !== 'all' && member.status !== activeFilter) {
				return false;
			}

			if (roleFilter === '-') {
				if (member.roleId) return false;
			} else if (roleFilter && member.roleId !== roleFilter) {
				return false;
			}

			if (selectedDepartment && member.department !== selectedDepartment) return false;

			if (selectedGrade !== 0) {
				if (selectedGrade === -1) {
					if (member.grade !== 0 && member.grade !== -1) return false;
				} else if (member.grade !== selectedGrade) {
					return false;
				}
			}

			if (!query) return true;
			const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
			return (
				fullName.includes(query) ||
				member.email.toLowerCase().includes(query) ||
				(member.department || '').toLowerCase().includes(query) ||
				(member.studentNo || '').toLowerCase().includes(query) ||
				(member.handle || '').toLowerCase().includes(query) ||
				(member.teamName || '').toLowerCase().includes(query) ||
				(member.roleName || '').toLowerCase().includes(query)
			);
		});
	}, [
		activeFilter,
		members,
		roleFilter,
		searchQuery,
		selectedDepartment,
		selectedGrade,
	]);

	return {
		searchQuery,
		setSearchQuery,
		activeFilter,
		setActiveFilter,
		roleFilter,
		setRoleFilter,
		selectedDepartment,
		setSelectedDepartment,
		selectedGrade,
		setSelectedGrade,
		filteredMembers,
		roleOptions,
		hasRolelessMember,
		trackOptions,
	};
}
