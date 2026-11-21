'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { optionLabel } from '@/lib/formFields';
import type { useMembers } from '../../hooks/useMembers';
import s from '../MembersMobile.module.css';

interface MembersMobileRolesTabProps {
	m: ReturnType<typeof useMembers>;
	onSelectMembersTab: () => void;
}

export function MembersMobileRolesTab({ m, onSelectMembersTab }: MembersMobileRolesTabProps) {
	const { t, language } = useI18n();
	const roles = m.roleData?.roles ?? m.roles;

	return (
		<>
			<div className={s.card} style={{ gap: '4px' }}>
				<div style={{ fontSize: '14px', fontWeight: 700 }}>{t('membersMobTabRoles')}</div>
				<div style={{ fontSize: '12px', opacity: 0.65 }}>{t('membersRolesDistributionDesc')}</div>
			</div>

			<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
				{roles.map((role) => {
					const count = m.members.filter((member) => member.roleId === role.id).length;
					return (
						<button
							key={role.id}
							type="button"
							className={s.memberCard}
							style={{ width: '100%', textAlign: 'left', color: 'inherit' }}
							onClick={() => {
								m.setRoleFilter(role.id);
								m.setSelectedDepartment('');
								onSelectMembersTab();
							}}
						>
							<div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
								<span
									style={{
										width: '10px',
										height: '10px',
										borderRadius: '50%',
										background: role.color || 'var(--accent)',
										flexShrink: 0,
									}}
								/>
								<div className={s.memberInfo}>
									<div className={s.memberName}>{role.name}</div>
									<div className={s.memberSub}>
										{role.assignable
											? t('membersRoleStandardDesc')
											: t('membersRoleSystemDesc')}
									</div>
								</div>
							</div>
							<div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
								<span className={`${s.badge} ${s.badgeAccent}`}>
									{count} {t('membersCount')}
								</span>
								<ChevronRight size={14} style={{ opacity: 0.45 }} />
							</div>
						</button>
					);
				})}
			</div>

			<div className={s.card} style={{ gap: '10px' }}>
				<div style={{ fontSize: '13px', fontWeight: 700 }}>{t('membersDepartmentsTitle')}</div>
				<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
					{m.trackOptions.map((track) => {
						const count = m.members.filter((member) => member.department === track.value).length;
						return (
							<button
								key={track.value}
								type="button"
								onClick={() => {
									m.setSelectedDepartment(track.value);
									m.setRoleFilter('');
									onSelectMembersTab();
								}}
								style={{
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'space-between',
									padding: '8px 10px',
									borderRadius: '10px',
									border: '1px solid rgba(255, 255, 255, 0.08)',
									background: 'rgba(255, 255, 255, 0.03)',
									color: 'inherit',
									cursor: 'pointer',
									fontSize: '12.5px',
								}}
							>
								<span>{optionLabel(track, language)}</span>
								<span style={{ opacity: 0.65, fontWeight: 600 }}>
									{count} {t('membersCount')}
								</span>
							</button>
						);
					})}
				</div>
			</div>
		</>
	);
}
