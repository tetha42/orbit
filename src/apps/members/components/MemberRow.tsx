'use client';

import React from 'react';
import { Award, ShieldAlert, HardDrive } from 'lucide-react';
import { RoleBadge } from '@/core/ui/RoleBadge';
import { useI18n } from '@/core/i18n';
import { formatBytes } from '@/core/data/format';
import { useSession } from '@/core/session';
import { useContextMenu, useShellActions } from '@/core/shell';
import { useWindowActions } from '@/core/windows';
import { fill } from '@/lib/text';
import { MemberActions } from './MemberActions';
import { MemberIdentityCell, MemberStatusCell } from './MemberRowCells';
import { getMemberDisplayRole } from './MemberDisplayUtils';
import { buildMemberContextMenuItems } from './MemberContextMenu';
import type { MemberRecord, AssignableRole } from '../types';

interface MemberRowProps {
	member: MemberRecord;
	currentUserId?: string;
	mailUser: boolean;
	isReachable: boolean;
	isAuthorizedToAdd: boolean;
	accessible: boolean;
	assignableRoles: AssignableRole[];
	onOpenProfile: (member: MemberRecord) => void;
	onResetPassword: (memberId: string, name: string) => void;
	onSendMessage: (memberId: string) => void;
	onUpdateStatus: (memberId: string, status: 'active' | 'rejected' | 'alumni') => void;
	onUpdateRole: (memberId: string, roleId: string) => void;
	onAwardXp: (memberId: string, xp: number) => void;
	onDelete: (memberId: string, name: string) => void;
}

export const MemberRow = React.memo(function MemberRow({
	member,
	currentUserId,
	mailUser,
	isReachable,
	isAuthorizedToAdd,
	accessible,
	assignableRoles,
	onOpenProfile,
	onResetPassword,
	onSendMessage,
	onUpdateStatus,
	onUpdateRole,
	onAwardXp,
	onDelete,
}: MemberRowProps) {
	const { t } = useI18n();
	const { canUseApp } = useSession();
	const { openContextMenu } = useShellActions();
	const { openApp } = useWindowActions();
	const canSoc = canUseApp('soc');
	const displayRole = getMemberDisplayRole(member, t);

	const getMenuItems = () =>
		buildMemberContextMenuItems({
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
		});

	const rowContextMenuProps = useContextMenu({ items: getMenuItems });

	const handleActionMenuClick = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		openContextMenu({
			x: rect.left,
			y: rect.bottom + 4,
			mode: 'app',
			appId: 'members',
			customItems: getMenuItems(),
		});
	};

	return (
		<tr
			data-focus-id={`member:${member.id}`}
			data-member-row={member.id}
			{...rowContextMenuProps}
			onDoubleClick={() => onOpenProfile(member)}
			title={t('membersRowContextTitle')}
			style={{ borderBottom: '1px solid color-mix(in srgb, var(--neutral) 8%, transparent)', transition: 'background 120ms ease', cursor: 'context-menu' }}
		>
			<MemberIdentityCell
				member={member}
				currentUserId={currentUserId}
				mailUser={mailUser}
				isReachable={isReachable}
				onSendMessage={onSendMessage}
			/>

			<td style={{ padding: '10px' }}>
				<RoleBadge role={displayRole} emptyText={t('roleNone')} />
			</td>

			<td style={{ padding: '10px' }}>
				<div>{member.department}</div>
				<div style={{ fontSize: '11px', opacity: 0.6 }}>
					{fill(t('membersClassAndNo'), { year: member.grade, no: member.handle || member.studentNo || '-' })}
				</div>
			</td>

			<td style={{ padding: '10px' }}>
				<div style={{ fontSize: '12.5px', fontWeight: 500 }}>
					{member.teamName || <span style={{ opacity: 0.4 }}>{t('membersNotAssigned')}</span>}
				</div>
			</td>

			<td style={{ padding: '10px' }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
					<Award size={14} style={{ color: 'var(--warning)' }} />
					<span style={{ fontWeight: 600, fontSize: '12px' }}>{member.xp || 0} XP</span>
				</div>
			</td>

			<td style={{ padding: '10px' }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '5px' }} title={`${member.fileCount ?? 0} ${t('filesCountUnit')}`}>
					<HardDrive size={13} style={{ opacity: 0.6 }} />
					<span style={{ fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>{formatBytes(member.diskUsageBytes)}</span>
				</div>
			</td>

			<MemberStatusCell status={member.status} />

			{isAuthorizedToAdd && (
				<td style={{ padding: '10px', textAlign: 'center' }}>
					<div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
						{canSoc && (
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									openApp('soc', { section: 'siem', kind: 'user', itemId: member.id });
								}}
								title={t('membersCtxSocAudit')}
								style={{
									background: 'transparent',
									border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
									color: 'var(--text-secondary)',
									cursor: 'pointer',
									padding: '4px 6px',
									borderRadius: '6px',
									display: 'inline-flex',
									alignItems: 'center',
									justifyContent: 'center',
								}}
							>
								<ShieldAlert size={13} />
							</button>
						)}
						<MemberActions member={member} onUpdateStatus={onUpdateStatus} onOpenContextMenu={handleActionMenuClick} />
					</div>
				</td>
			)}
		</tr>
	);
});
