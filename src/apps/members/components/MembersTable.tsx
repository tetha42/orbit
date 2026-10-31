'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { MemberRow } from './MemberRow';
import { MemberCard } from './MemberCard';
import type { MemberRecord, AssignableRole } from '../types';

interface MembersTableProps {
	members: MemberRecord[];
	currentUserId?: string;
	mailUser: boolean;
	reachable: Set<string>;
	isAuthorizedToAdd: boolean;
	isLoading: boolean;
	assignableRoles: AssignableRole[];
	isMemberTouchable: (m: MemberRecord) => boolean;
	onOpenProfile: (member: MemberRecord) => void;
	onResetPassword: (memberId: string, name: string) => void;
	onSendMessage: (memberId: string) => void;
	onUpdateStatus: (memberId: string, status: 'aktif' | 'reddedildi' | 'mezun') => void;
	onUpdateRole: (memberId: string, roleId: string) => void;
	onAwardXp: (memberId: string, xp: number) => void;
	onDelete: (memberId: string, name: string) => void;
}

export function MembersTable({
	members,
	currentUserId,
	mailUser,
	reachable,
	isAuthorizedToAdd,
	isLoading,
	assignableRoles,
	isMemberTouchable,
	onOpenProfile,
	onResetPassword,
	onSendMessage,
	onUpdateStatus,
	onUpdateRole,
	onAwardXp,
	onDelete,
}: MembersTableProps) {
	const { t } = useI18n();
	const [isMobile, setIsMobile] = React.useState(false);

	React.useEffect(() => {
		const checkMobile = () => setIsMobile(window.innerWidth < 768);
		checkMobile();
		window.addEventListener('resize', checkMobile);
		return () => window.removeEventListener('resize', checkMobile);
	}, []);

	if (isMobile) {
		return (
			<div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', padding: '8px 12px 32px' }}>
				{members.map((m) => (
					<MemberCard
						key={m.id}
						member={m}
						currentUserId={currentUserId}
						mailUser={mailUser}
						isReachable={reachable.has(m.id)}
						isAuthorizedToAdd={isAuthorizedToAdd}
						erisilebilir={isMemberTouchable(m)}
						assignableRoles={assignableRoles}
						onOpenProfile={onOpenProfile}
						onResetPassword={onResetPassword}
						onSendMessage={onSendMessage}
						onUpdateStatus={onUpdateStatus}
						onUpdateRole={onUpdateRole}
						onAwardXp={onAwardXp}
						onDelete={onDelete}
					/>
				))}
				{!isLoading && members.length === 0 && (
					<div style={{ padding: '40px 20px', textAlign: 'center', opacity: 0.6, fontSize: '13px' }}>
						{t('membersNoResults')}
					</div>
				)}
			</div>
		);
	}

	return (
		<div style={{ padding: '12px 18px', width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
			<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left', minWidth: '600px' }}>
				<thead>
					<tr
						style={{
							borderBottom: '1px solid var(--window-border)',
							opacity: 0.6,
							fontSize: '11px',
							textTransform: 'uppercase',
							letterSpacing: '0.04em',
						}}
					>
						<th style={{ padding: '8px 10px' }}>{t('membersColName')}</th>
						<th style={{ padding: '8px 10px' }}>{t('membersColRole')}</th>
						<th style={{ padding: '8px 10px' }}>{t('membersColDept')}</th>
						<th style={{ padding: '8px 10px' }}>{t('membersColTeam')}</th>
						<th style={{ padding: '8px 10px' }}>{t('membersColXp')}</th>
						<th style={{ padding: '8px 10px' }}>{t('membersColStatus')}</th>
						{isAuthorizedToAdd && <th style={{ padding: '8px 10px', textAlign: 'center' }}>{t('membersColActions')}</th>}
					</tr>
				</thead>
				<tbody>
					{members.map((m) => (
						<MemberRow
							key={m.id}
							member={m}
							currentUserId={currentUserId}
							mailUser={mailUser}
							isReachable={reachable.has(m.id)}
							isAuthorizedToAdd={isAuthorizedToAdd}
							erisilebilir={isMemberTouchable(m)}
							assignableRoles={assignableRoles}
							onOpenProfile={onOpenProfile}
							onResetPassword={onResetPassword}
							onSendMessage={onSendMessage}
							onUpdateStatus={onUpdateStatus}
							onUpdateRole={onUpdateRole}
							onAwardXp={onAwardXp}
							onDelete={onDelete}
						/>
					))}
				</tbody>
			</table>

			{!isLoading && members.length === 0 && (
				<div style={{ padding: '40px 20px', textAlign: 'center', opacity: 0.6, fontSize: '13px' }}>
					{t('membersNoResults')}
				</div>
			)}
		</div>
	);
}
