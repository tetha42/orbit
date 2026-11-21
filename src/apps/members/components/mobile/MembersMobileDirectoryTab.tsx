'use client';

import React from 'react';
import { Award, MessageSquare, Search } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useWindowActions } from '@/core/windows';
import { optionLabel } from '@/lib/formFields';
import { fill } from '@/lib/text';
import type { useMembers } from '../../hooks/useMembers';
import s from '../MembersMobile.module.css';

interface MembersMobileDirectoryTabProps {
	m: ReturnType<typeof useMembers>;
}

function getInitials(firstName?: string, lastName?: string): string {
	return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?';
}

export function MembersMobileDirectoryTab({ m }: MembersMobileDirectoryTabProps) {
	const { t, language } = useI18n();
	const { openApp } = useWindowActions();

	return (
		<>
			<div className={s.searchBox}>
				<Search size={15} className={s.searchIcon} />
				<input
					type="text"
					className={s.searchInput}
					placeholder={t('membersSearchPlaceholder')}
					value={m.searchQuery}
					onChange={(event) => m.setSearchQuery(event.target.value)}
				/>
			</div>

			<div className={s.chipRow}>
				<button
					type="button"
					className={`${s.chip} ${m.selectedDepartment === '' ? s.chipActive : ''}`}
					onClick={() => m.setSelectedDepartment('')}
				>
					{t('membersFilterAllDepts')} ({m.members.length})
				</button>
				{m.trackOptions.map((track) => (
					<button
						key={track.value}
						type="button"
						className={`${s.chip} ${m.selectedDepartment === track.value ? s.chipActive : ''}`}
						onClick={() =>
							m.setSelectedDepartment(m.selectedDepartment === track.value ? '' : track.value)
						}
					>
						{optionLabel(track, language)}
					</button>
				))}
			</div>

			{m.isLoading ? (
				<div style={{ padding: '32px', textAlign: 'center', opacity: 0.6, fontSize: '13px' }}>
					{t('loading')}
				</div>
			) : m.filteredMembers.length === 0 ? (
				<div className={s.card} style={{ textAlign: 'center', padding: '28px 16px', opacity: 0.65, fontSize: '13px' }}>
					{t('membersNoMatch')}
				</div>
			) : (
				<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
					{m.filteredMembers.map((member) => {
						const fullName = `${member.firstName} ${member.lastName}`;
						const avatarSrc = member.avatarUrl || member.profilePhoto;
						const isMe = member.id === m.currentUser?.id;
						const canMessage =
							m.mailUser &&
							!isMe &&
							member.status === 'active';

						return (
							<div
								key={member.id}
								className={s.memberCard}
								data-focus-id={`member:${member.id}`}
								onClick={() => m.setSelectedMemberForProfile(member)}
							>
								<button
									type="button"
									aria-label={fullName}
									onClick={(event) => {
										event.stopPropagation();
										m.setSelectedMemberForProfile(member);
									}}
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: '12px',
										minWidth: 0,
										flex: 1,
										padding: 0,
										border: 'none',
										background: 'transparent',
										color: 'inherit',
										textAlign: 'left',
										cursor: 'pointer',
									}}
								>
									<span className={s.avatar}>
										{avatarSrc ? (
											// eslint-disable-next-line @next/next/no-img-element
											<img src={avatarSrc} alt={fullName} className={s.avatarImg} />
										) : (
											getInitials(member.firstName, member.lastName)
										)}
									</span>

									<span className={s.memberInfo}>
										<span className={s.memberName}>
											<span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
												{fullName}
											</span>
											{isMe && (
												<span className={`${s.badge} ${s.badgeAccent}`} style={{ fontSize: '9.5px', padding: '1px 5px' }}>
													{t('you')}
												</span>
											)}
										</span>
										<span className={s.memberSub}>
											{member.department || t('membersDefaultDept')}
											{member.grade ? ` • ${fill(t('membersClassYear'), { year: member.grade })}` : ''}
										</span>
									</span>
								</button>

								<div className={s.memberRight}>
									<span className={`${s.badge} ${s.badgeAccent}`}>
										{member.roleName || t('membersMember')}
									</span>
									<div className={s.memberActionRow}>
										<span style={{ fontSize: '11px', opacity: 0.7, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
											<Award size={11} color="var(--warning)" />
											{member.xp ?? 0}
										</span>
										{canMessage && (
											<button
												type="button"
												className={s.quickMessageBtn}
												aria-label={fill(t('membersSendMessageTo'), { name: member.firstName })}
												title={fill(t('membersSendMessageTo'), { name: member.firstName })}
												onClick={(event) => {
													event.stopPropagation();
													openApp('mail', { section: 'compose', itemId: member.id });
												}}
											>
												<MessageSquare size={13} />
											</button>
										)}
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</>
	);
}
