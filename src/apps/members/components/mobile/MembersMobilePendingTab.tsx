'use client';

import React from 'react';
import { Check, UserCheck, X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import type { MemberRecord } from '../../types';
import s from '../MembersMobile.module.css';

interface MembersMobilePendingTabProps {
	pendingMembers: MemberRecord[];
	isAuthorizedToAdd: boolean;
	onUpdateStatus: (memberId: string, status: 'active' | 'rejected' | 'alumni') => void;
}

function getInitials(firstName?: string, lastName?: string): string {
	return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?';
}

export function MembersMobilePendingTab({
	pendingMembers,
	isAuthorizedToAdd,
	onUpdateStatus,
}: MembersMobilePendingTabProps) {
	const { t } = useI18n();

	return (
		<>
			<div className={s.card} style={{ gap: '4px' }}>
				<div style={{ fontSize: '14px', fontWeight: 700 }}>{t('membersMobTabPending')}</div>
				<div style={{ fontSize: '12px', opacity: 0.65 }}>{t('membersPendingDesc')}</div>
			</div>

			{pendingMembers.length === 0 ? (
				<div
					className={s.card}
					style={{
						alignItems: 'center',
						textAlign: 'center',
						padding: '32px 16px',
						opacity: 0.7,
					}}
				>
					<UserCheck size={32} style={{ opacity: 0.6 }} />
					<div style={{ fontSize: '13px' }}>{t('membersNoPending')}</div>
				</div>
			) : (
				<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
					{pendingMembers.map((member) => {
						const fullName = `${member.firstName} ${member.lastName}`;
						const avatarSrc = member.avatarUrl || member.profilePhoto;
						const idCode = member.handle || member.studentNo;

						return (
							<div key={member.id} className={s.pendingCard}>
								<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
									<div className={s.avatar}>
										{avatarSrc ? (
											// eslint-disable-next-line @next/next/no-img-element
											<img src={avatarSrc} alt={fullName} className={s.avatarImg} />
										) : (
											getInitials(member.firstName, member.lastName)
										)}
									</div>
									<div className={s.memberInfo}>
										<div className={s.memberName}>{fullName}</div>
										<div className={s.memberSub}>{member.email}</div>
										<div className={s.memberSub}>
											{member.department || t('membersDefaultDept')}
											{member.grade ? ` • ${fill(t('membersClassYear'), { year: member.grade })}` : ''}
											{idCode ? ` • ${idCode}` : ''}
										</div>
									</div>
								</div>

								{isAuthorizedToAdd && (
									<div className={s.actionRow}>
										<button
											type="button"
											className={s.btnApprove}
											onClick={() => onUpdateStatus(member.id, 'active')}
										>
											<Check size={15} />
											{t('approve')}
										</button>
										<button
											type="button"
											className={s.btnReject}
											onClick={() => onUpdateStatus(member.id, 'rejected')}
										>
											<X size={15} />
											{t('reject')}
										</button>
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}
		</>
	);
}
