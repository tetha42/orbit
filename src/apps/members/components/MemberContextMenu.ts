import React from 'react';
import {
	Mail,
	Award,
	CheckCircle2,
	XCircle,
	User,
	KeyRound,
	Shield,
	ShieldAlert,
	Trash2,
	HardDrive,
} from 'lucide-react';
import { isAlumniRole } from '@/core/permissions';
import { formatBytes } from '@/core/data/format';
import type { AppID, FocusTargetInput, MenuItem } from '@/types/workspace';
import type { MemberRecord, AssignableRole } from '../types';

interface BuildMenuParams {
	member: MemberRecord;
	currentUserId?: string;
	mailUser: boolean;
	isReachable: boolean;
	isAuthorizedToAdd: boolean;
	accessible: boolean;
	canSoc: boolean;
	assignableRoles: AssignableRole[];
	t: (key: string, fallback?: string) => string;
	openApp: (id: AppID, target?: FocusTargetInput) => void;
	onOpenProfile: (member: MemberRecord) => void;
	onResetPassword: (memberId: string, name: string) => void;
	onSendMessage: (memberId: string) => void;
	onUpdateStatus: (memberId: string, status: 'active' | 'rejected' | 'alumni') => void;
	onUpdateRole: (memberId: string, roleId: string) => void;
	onAwardXp: (memberId: string, xp: number) => void;
	onDelete: (memberId: string, name: string) => void;
}

export function buildMemberContextMenuItems({
	member,
	currentUserId,
	mailUser,
	isReachable,
	isAuthorizedToAdd,
	accessible,
	canSoc,
	assignableRoles,
	t,
	openApp,
	onOpenProfile,
	onResetPassword,
	onSendMessage,
	onUpdateStatus,
	onUpdateRole,
	onAwardXp,
	onDelete,
}: BuildMenuParams): MenuItem[] {
	const isSelf = member.id === currentUserId;
	const canManage = accessible && isAuthorizedToAdd;
	const isAlumni = member.status === 'alumni' || isAlumniRole({ id: member.roleId, name: member.roleName });

	const items: MenuItem[] = [
		{
			id: `view-profile-${member.id}`,
			label: t('membersCtxViewProfile'),
			icon: React.createElement(User, { size: 14 }),
			action: () => onOpenProfile(member),
		},
	];

	if (mailUser && !isSelf && member.status === 'active' && isReachable) {
		items.push({
			id: `send-mail-${member.id}`,
			label: t('membersCtxSendMessage'),
			icon: React.createElement(Mail, { size: 14 }),
			action: () => onSendMessage(member.id),
		});
	}

	if (canManage) {
		items.push({ id: `sep-mgm-${member.id}`, label: '', separator: true });

		if (canSoc) {
			items.push({
				id: `soc-audit-${member.id}`,
				label: t('membersCtxSocAudit'),
				icon: React.createElement(ShieldAlert, { size: 14 }),
				action: () => openApp('soc', { section: 'siem', kind: 'user', itemId: member.id }),
			});
		}

		items.push({
			id: `inspect-storage-${member.id}`,
			label: `${t('membersColStorage')}: ${formatBytes(member.diskUsageBytes)} (${member.fileCount ?? 0} ${t('filesCountUnit')})`,
			icon: React.createElement(HardDrive, { size: 14 }),
			action: () => onOpenProfile(member),
		});

		if (member.status !== 'rejected') {
			items.push({
				id: `change-role-${member.id}`,
				label: t('membersCtxChangeRole'),
				icon: React.createElement(Shield, { size: 14 }),
				children: [
					{
						id: `role-none-${member.id}`,
						label: t('membersCtxNoRole'),
						checked: !member.roleId && !isAlumni,
						action: () => onUpdateRole(member.id, ''),
					},
					...assignableRoles.map((r) => ({
						id: `role-${r.id}-${member.id}`,
						label: isAlumniRole(r) ? t('membersStatusAlumni', r.name) : r.name,
						checked: isAlumni ? isAlumniRole(r) : member.roleId === r.id,
						action: () => onUpdateRole(member.id, r.id),
					})),
				],
			});
		}

		items.push({
			id: `reset-pwd-${member.id}`,
			label: t('membersCtxResetPassword'),
			icon: React.createElement(KeyRound, { size: 14 }),
			action: () => onResetPassword(member.id, `${member.firstName} ${member.lastName}`),
		});

		if (member.status === 'pending') {
			items.push({
				id: `approve-${member.id}`,
				label: t('membersCtxApprove'),
				icon: React.createElement(CheckCircle2, { size: 14 }),
				action: () => onUpdateStatus(member.id, 'active'),
			});
			items.push({
				id: `reject-${member.id}`,
				label: t('membersCtxReject'),
				icon: React.createElement(XCircle, { size: 14 }),
				action: () => onUpdateStatus(member.id, 'rejected'),
			});
		}

		items.push({
			id: `award-xp-${member.id}`,
			label: t('membersCtxAwardXp'),
			icon: React.createElement(Award, { size: 14 }),
			action: () => onAwardXp(member.id, 50),
		});

		if (!isSelf) {
			items.push({ id: `sep-del-${member.id}`, label: '', separator: true });
			items.push({
				id: `delete-${member.id}`,
				label: t('membersCtxDelete'),
				icon: React.createElement(Trash2, { size: 14 }),
				action: () => onDelete(member.id, `${member.firstName} ${member.lastName}`),
			});
		}
	}

	return items;
}
