'use client';

import React from 'react';
import Image from 'next/image';
import {
	Award,
	CheckCircle2,
	Clock,
	XCircle,
	GraduationCap,
	ChevronRight,
	HardDrive,
} from 'lucide-react';
import { AvatarFallback } from '@/components/Common/AvatarFallback';
import { RoleBadge } from '@/core/ui/RoleBadge';
import { useI18n } from '@/core/i18n';
import { formatBytes } from '@/core/data/format';
import { useSession } from '@/core/session';
import { useWindowActions } from '@/core/windows';
import { fill } from '@/lib/text';
import type { MemberRecord, AssignableRole } from '../types';
import { getMemberDisplayRole, getMemberStatusLabel } from './MemberDisplayUtils';
import { MemberCardActions } from './MemberCardActions';

interface MemberCardProps {
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

export const MemberCard = React.memo(function MemberCard({
	member,
	currentUserId,
	mailUser,
	isReachable: _isReachable,
	isAuthorizedToAdd,
	accessible,
	assignableRoles: _assignableRoles,
	onOpenProfile,
	onResetPassword,
	onSendMessage,
	onUpdateStatus: _onUpdateStatus,
	onUpdateRole: _onUpdateRole,
	onAwardXp,
	onDelete,
}: MemberCardProps) {
	const { t } = useI18n();
	const { canUseApp } = useSession();
	const { openApp } = useWindowActions();
	const canSoc = canUseApp('soc');

	const displayRole = getMemberDisplayRole(member, t);
	const isSelf = member.id === currentUserId;
	const canManage = accessible && isAuthorizedToAdd;

	return (
		<div
			className="cv-auto-card"
			data-focus-id={`member:${member.id}`}
			style={{
				background: 'var(--card-bg)',
				border: '1px solid var(--card-border)',
				borderRadius: '12px',
				padding: '12px 14px',
				display: 'flex',
				flexDirection: 'column',
				gap: '10px',
				boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
			}}
		>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
					<div
						style={{ position: 'relative', width: '36px', height: '36px', flexShrink: 0, cursor: 'pointer' }}
						onClick={() => onOpenProfile(member)}
					>
						{member.avatarUrl || member.profilePhoto ? (
							<Image
								src={(member.avatarUrl || member.profilePhoto)!}
								alt={`${member.firstName} ${member.lastName}`}
								width={36}
								height={36}
								style={{ borderRadius: '50%', objectFit: 'cover' }}
								unoptimized
							/>
						) : (
							<AvatarFallback name={`${member.firstName} ${member.lastName}`} size={36} />
						)}
					</div>

					<div style={{ minWidth: 0 }}>
						<button
							type="button"
							onClick={() => onOpenProfile(member)}
							style={{
								fontWeight: 700,
								fontSize: '14px',
								color: 'var(--text-primary)',
								background: 'none',
								border: 'none',
								padding: 0,
								cursor: 'pointer',
								textAlign: 'left',
								display: 'flex',
								alignItems: 'center',
								gap: '4px',
							}}
						>
							<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
								{member.firstName} {member.lastName}
							</span>
							<ChevronRight size={13} style={{ opacity: 0.5 }} />
						</button>
						<div
							style={{
								fontSize: '11px',
								color: 'var(--text-secondary)',
								overflow: 'hidden',
								textOverflow: 'ellipsis',
								whiteSpace: 'nowrap',
							}}
						>
							{member.email}
						</div>
					</div>
				</div>

				<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
					<RoleBadge role={displayRole} emptyText={t('roleNone')} size="sm" />
					<span
						style={{
							fontSize: '10.5px',
							fontWeight: 650,
							display: 'inline-flex',
							alignItems: 'center',
							gap: '3px',
							color:
								member.status === 'active'
									? 'var(--success)'
									: member.status === 'pending'
										? 'var(--warning)'
										: member.status === 'alumni'
											? '#64d2ff'
											: 'var(--danger)',
						}}
					>
						{member.status === 'active' && <CheckCircle2 size={11} />}
						{member.status === 'pending' && <Clock size={11} />}
						{member.status === 'alumni' && <GraduationCap size={11} />}
						{member.status === 'rejected' && <XCircle size={11} />}
						{getMemberStatusLabel(member.status, t)}
					</span>
				</div>
			</div>

			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(2, 1fr)',
					gap: '6px 12px',
					fontSize: '11.5px',
					background: 'rgba(0, 0, 0, 0.03)',
					padding: '8px 10px',
					borderRadius: '8px',
				}}
			>
				<div>
					<span style={{ opacity: 0.6, fontSize: '10.5px', display: 'block' }}>{t('membersDeptClassLabel')}</span>
					<span style={{ fontWeight: 550 }}>
						{member.department || '—'} {member.grade ? `(${fill(t('certsGradeFormat'), { grade: member.grade })})` : ''}
					</span>
				</div>
				<div>
					<span style={{ opacity: 0.6, fontSize: '10.5px', display: 'block' }}>{t('membersTeamProjectLabel')}</span>
					<span style={{ fontWeight: 550 }}>{member.teamName || '—'}</span>
				</div>
				<div>
					<span style={{ opacity: 0.6, fontSize: '10.5px', display: 'block' }}>{t('membersStudentIdLabel')}</span>
					<span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '11px' }}>
						{member.handle || member.studentNo || '—'}
					</span>
				</div>
				<div>
					<span style={{ opacity: 0.6, fontSize: '10.5px', display: 'block' }}>{t('membersXpPointsLabel')}</span>
					<span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 600, color: 'var(--warning)' }}>
						<Award size={12} />
						{member.xp ?? 0} XP
					</span>
				</div>
				<div>
					<span style={{ opacity: 0.6, fontSize: '10.5px', display: 'block' }}>{t('membersColStorage')}</span>
					<span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
						<HardDrive size={12} style={{ opacity: 0.6 }} />
						{formatBytes(member.diskUsageBytes)}
					</span>
				</div>
			</div>

			<MemberCardActions
				member={member}
				isSelf={isSelf}
				mailUser={mailUser}
				canManage={canManage}
				canSoc={canSoc}
				onOpenProfile={onOpenProfile}
				onResetPassword={onResetPassword}
				onSendMessage={onSendMessage}
				onAwardXp={onAwardXp}
				onDelete={onDelete}
				onOpenSoc={(id) => openApp('soc', { section: 'siem', kind: 'user', itemId: id })}
			/>
		</div>
	);
});
