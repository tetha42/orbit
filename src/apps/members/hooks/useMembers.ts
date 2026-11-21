import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/core/i18n';
import { useSession } from '@/core/session';
import { useSound } from '@/core/sound';
import { useDialog } from '@/components/Common/DialogProvider';
import { useJsonResource } from '@/core/data/useJsonResource';
import { useFocusTarget } from '@/lib/client/useFocusTarget';
import { useAppCommand, useAppEvent } from '@/core/commands';
import type { AssignableRole, MemberRecord } from '../types';
import { useAddMemberForm } from './useAddMemberForm';
import { useMemberActions } from './useMemberActions';
import { useMemberFilters } from './useMemberFilters';

interface RolesResponse {
	roles: AssignableRole[];
	defaultRoleId: string | null;
}

export function useMembers() {
	const { t } = useI18n();
	const { currentUser, canManageApp, canUseApp } = useSession();
	const { playSystemSound } = useSound();
	const dialog = useDialog();

	const isAuthorizedToAdd = canManageApp('members');
	const mailUser = canUseApp('mail');

	const [selectedMemberForProfile, setSelectedMemberForProfile] =
		useState<MemberRecord | null>(null);

	const { data: reachData } = useJsonResource<{ ids: string[] }>(
		mailUser ? '/api/messages/recipients?reachable=1' : null,
	);
	const reachable = useMemo(() => new Set(reachData?.ids ?? []), [reachData?.ids]);

	const {
		data: membersData,
		isLoading,
		refetch: fetchMembers,
	} = useJsonResource<{ members: MemberRecord[] }>('/api/members');
	const members = useMemo(() => membersData?.members ?? [], [membersData?.members]);

	const { data: roleData, refetch: fetchRoles } = useJsonResource<RolesResponse>(
		isAuthorizedToAdd ? '/api/roles' : null,
	);
	useEffect(() => {
		if (isAuthorizedToAdd) void fetchRoles();
	}, [isAuthorizedToAdd, fetchRoles]);
	const roles = useMemo(() => roleData?.roles ?? [], [roleData?.roles]);
	const assignableRoles = useMemo(
		() => roles.filter((role) => role.assignable),
		[roles],
	);
	const rolesById = useMemo(
		() => new Map(roles.map((role) => [role.id, role])),
		[roles],
	);

	const isMemberTouchable = useCallback(
		(member: MemberRecord) => !member.roleId || rolesById.get(member.roleId)?.assignable === true,
		[rolesById],
	);

	useAppEvent('roster-changed', () => void fetchMembers());

	const form = useAddMemberForm({
		t,
		dialog,
		playSystemSound,
		fetchMembers,
	});

	const actions = useMemberActions({
		t,
		dialog,
		playSystemSound,
		fetchMembers,
	});

	const filters = useMemberFilters({
		members,
		roles,
		coreConfig: form.coreConfig,
	});

	const {
		setActiveFilter,
		setSearchQuery,
		setSelectedDepartment,
		setSelectedGrade,
		setRoleFilter,
	} = filters;
	const { setShowAddModal } = form;

	useFocusTarget('members', {
		ready: !isLoading,
		refetch: fetchMembers,
		apply: useCallback(
			(target) => {
				if (
					target.section === 'pending' ||
					target.section === 'active' ||
					target.section === 'alumni' ||
					target.section === 'all'
				) {
					setActiveFilter(target.section);
					setSearchQuery('');
					setSelectedDepartment('');
					setSelectedGrade(0);
					setRoleFilter('');
				}
				if (target.itemId) {
					setActiveFilter('all');
					setSearchQuery('');
					setSelectedDepartment('');
					setSelectedGrade(0);
					setRoleFilter('');
					const found = members.find((member) => member.id === target.itemId);
					if (found) setSelectedMemberForProfile(found);
				}
			},
			[
				members,
				setActiveFilter,
				setRoleFilter,
				setSearchQuery,
				setSelectedDepartment,
				setSelectedGrade,
			],
		),
	});

	useAppCommand('members', (command) => {
		if (command === 'add-member' && isAuthorizedToAdd) {
			setShowAddModal(true);
		} else if (command === 'refresh') {
			void fetchMembers();
		} else if (command === 'filter-all') {
			setActiveFilter('all');
		} else if (command === 'filter-active') {
			setActiveFilter('active');
		} else if (command === 'filter-pending' && isAuthorizedToAdd) {
			setActiveFilter('pending');
		} else if (command === 'filter-alumni') {
			setActiveFilter('alumni');
		}
	});

	return {
		currentUser,
		mailUser,
		reachable,
		isAuthorizedToAdd,
		isLoading,
		members,
		filteredMembers: filters.filteredMembers,
		roles,
		assignableRoles,
		rolesById,
		roleData: roleData ?? null,
		roleOptions: filters.roleOptions,
		hasRolelessMember: filters.hasRolelessMember,
		trackOptions: filters.trackOptions,
		isMemberTouchable,
		searchQuery: filters.searchQuery,
		setSearchQuery: filters.setSearchQuery,
		activeFilter: filters.activeFilter,
		setActiveFilter: filters.setActiveFilter,
		roleFilter: filters.roleFilter,
		setRoleFilter: filters.setRoleFilter,
		selectedDepartment: filters.selectedDepartment,
		setSelectedDepartment: filters.setSelectedDepartment,
		selectedGrade: filters.selectedGrade,
		setSelectedGrade: filters.setSelectedGrade,
		...form,
		fetchMembers,
		...actions,
		selectedMemberForProfile,
		setSelectedMemberForProfile,
		t,
	};
}
