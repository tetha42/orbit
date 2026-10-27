'use client';

import React, { useState, useRef, useMemo } from 'react';
import {
	Users,
	UserCheck,
	Shield,
	UserPlus,
	Search,
	Check,
	X,
	Zap,
	Building2,
	ChevronRight,
	Mail,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useWindowActions } from '@/core/windows';
import { initials } from '@/core/text/initials';
import { fill } from '@/lib/text';
import type { useMembers } from '../hooks/useMembers';
import { AddMemberModal } from './AddMemberModal';
import { MemberDetailModal } from './MemberDetailModal';
import s from './MembersMobile.module.css';

export interface MembersMobileViewProps {
	m: ReturnType<typeof useMembers>;
}

type MembersMobileTab = 'members' | 'pending' | 'roles' | 'add';

export function MembersMobileView({ m }: MembersMobileViewProps) {
	const { t } = useI18n();
	const { openApp } = useWindowActions();
	const [activeTab, setActiveTab] = useState<MembersMobileTab>('members');
	const scrollAreaRef = useRef<HTMLDivElement>(null);

	const pendingMembers = useMemo(
		() => m.members.filter((mbr) => mbr.status === 'beklemede'),
		[m.members]
	);

	const departments = useMemo(() => {
		const depts = new Set<string>();
		for (const mbr of m.members) {
			if (mbr.bolum) depts.add(mbr.bolum);
		}
		return Array.from(depts).sort((a, b) => a.localeCompare(b, 'tr'));
	}, [m.members]);

	const handleTabChange = (tabId: MembersMobileTab) => {
		if (tabId === 'add') {
			if (m.isAuthorizedToAdd) {
				m.setShowAddModal(true);
			}
			return;
		}
		if (activeTab === tabId) {
			scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
		} else {
			setActiveTab(tabId);
			scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'instant' });
		}
	};

	const tabs: Array<{
		id: MembersMobileTab;
		label: string;
		badgeCount?: number;
		Icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
	}> = [
		{ id: 'members', label: t('membersMobTabAll'), Icon: Users },
		{
			id: 'pending',
			label: t('membersMobTabPending'),
			Icon: UserCheck,
			badgeCount: pendingMembers.length > 0 ? pendingMembers.length : undefined,
		},
		{ id: 'roles', label: t('membersMobTabRoles'), Icon: Shield },
		{ id: 'add', label: t('membersMobAdd'), Icon: UserPlus },
	];

	// 1. Members Tab Content
	const renderMembers = () => (
		<>
			{/* Search Input */}
			<div className={s.searchBox}>
				<Search size={15} className={s.searchIcon} />
				<input
					type="text"
					className={s.searchInput}
					placeholder={t('membersSearchPlaceholder')}
					value={m.searchQuery}
					onChange={(e) => m.setSearchQuery(e.target.value)}
				/>
			</div>

			{/* Department Filter Chips */}
			<div className={s.chipRow}>
				<button
					type="button"
					className={`${s.chip} ${m.selectedDept === '' ? s.chipActive : ''}`}
					onClick={() => m.setSelectedDept('')}
				>
					{t('membersFilterAllDepts')} ({m.members.length})
				</button>
				{departments.map((dept) => (
					<button
						key={dept}
						type="button"
						className={`${s.chip} ${m.selectedDept === dept ? s.chipActive : ''}`}
						onClick={() => m.setSelectedDept(m.selectedDept === dept ? '' : dept)}
					>
						<span>{dept}</span>
					</button>
				))}
			</div>

			{/* Members List */}
			<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
				{m.filteredMembers.length === 0 ? (
					<div className={s.card} style={{ textAlign: 'center', padding: '36px', opacity: 0.65, fontSize: '13px' }}>
						{m.isLoading ? t('loading') : t('membersNoMatch')}
					</div>
				) : (
					m.filteredMembers.map((member) => {
						const isMe = member.id === m.currentUser?.id;
						return (
							<div
								key={member.id}
								className={s.memberCard}
								onClick={() => m.setSelectedMemberForProfile(member)}
							>
								<div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
									<div className={s.avatar}>
										{member.profilFoto ? (
											// eslint-disable-next-line @next/next/no-img-element
											<img src={member.profilFoto} alt="" className={s.avatarImg} />
										) : (
											initials(`${member.ad} ${member.soyad}`)
										)}
									</div>

									<div className={s.memberInfo}>
										<div className={s.memberName}>
											<span>{member.ad} {member.soyad}</span>
											{isMe && <span className={`${s.badge} ${s.badgeAccent}`} style={{ fontSize: '9.5px', padding: '1px 5px' }}>{t('you')}</span>}
										</div>
										<div className={s.memberSub}>
											{member.bolum || t('membersDefaultDept')} {member.sinif ? `• ${fill(t('membersClassYear'), { year: member.sinif })}` : ''}
										</div>
									</div>
								</div>

								<div className={s.memberRight}>
									<div className={s.memberActionRow}>
										{member.rolAd && (
											<span
												className={s.badge}
												style={{
													background: member.rolRenk ? `${member.rolRenk}25` : 'rgba(10, 132, 255, 0.15)',
													color: member.rolRenk || '#0a84ff',
													fontSize: '10.5px',
												}}
											>
												{member.rolAd}
											</span>
										)}
										{!isMe && m.mailUser && member.status === 'aktif' && (
											<button
												type="button"
												aria-label={fill(t('membersSendMessageTo'), { name: member.ad })}
												title={fill(t('membersSendMessageTo'), { name: member.ad })}
												className={s.quickMessageBtn}
												onClick={(e) => {
													e.stopPropagation();
													openApp('chat', { section: 'compose', itemId: member.id });
												}}
											>
												<Mail size={14} />
											</button>
										)}
									</div>
									<span style={{ fontSize: '11px', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '3px' }}>
										<Zap size={11} color="var(--accent)" />
										<span>{member.xp ?? 0} XP</span>
									</span>
								</div>
							</div>
						);
					})
				)}
			</div>
		</>
	);

	// 2. Pending Members Tab Content
	const renderPending = () => (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
			<div style={{ padding: '0 4px' }}>
				<h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{t('membersMobTabPending')}</h3>
				<p style={{ margin: '2px 0 0', fontSize: '11.5px', opacity: 0.65 }}>
					{t('membersPendingDesc')}
				</p>
			</div>

			{pendingMembers.length === 0 ? (
				<div className={s.card} style={{ textAlign: 'center', padding: '40px 16px', opacity: 0.65, fontSize: '13px' }}>
					<UserCheck size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
					<div>{t('membersNoPending')}</div>
				</div>
			) : (
				pendingMembers.map((member) => (
					<div key={member.id} className={s.pendingCard}>
						<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
							<div className={s.avatar}>
								{member.profilFoto ? (
									// eslint-disable-next-line @next/next/no-img-element
									<img src={member.profilFoto} alt="" className={s.avatarImg} />
								) : (
									initials(`${member.ad} ${member.soyad}`)
								)}
							</div>
							<div style={{ flex: 1, minWidth: 0 }}>
								<div style={{ fontSize: '14.5px', fontWeight: 700, color: '#f8fafc' }}>
									{member.ad} {member.soyad}
								</div>
								<div style={{ fontSize: '12px', opacity: 0.65, marginTop: '2px' }}>
									{member.email}
								</div>
								<div style={{ fontSize: '11.5px', opacity: 0.55, marginTop: '2px' }}>
									{member.bolum} {member.sinif ? `• ${fill(t('membersClassYear'), { year: member.sinif })}` : ''} {member.ogrenciNo ? `• ${member.ogrenciNo}` : ''}
								</div>
							</div>
						</div>

						{m.isAuthorizedToAdd && (
							<div className={s.actionRow}>
								<button
									type="button"
									className={s.btnApprove}
									onClick={() => void m.handleUpdateMemberStatus(member.id, 'aktif')}
								>
									<Check size={16} strokeWidth={2.5} />
									<span>{t('approve')}</span>
								</button>
								<button
									type="button"
									className={s.btnReject}
									onClick={() => void m.handleDeleteMember(member.id, `${member.ad} ${member.soyad}`)}
								>
									<X size={16} strokeWidth={2.5} />
									<span>{t('reject')}</span>
								</button>
							</div>
						)}
					</div>
				))
			)}
		</div>
	);

	// 3. Roles and Departments Tab Content
	const renderRoles = () => (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
			<div style={{ padding: '0 4px' }}>
				<h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{t('membersMobTabRoles')}</h3>
				<p style={{ margin: '2px 0 0', fontSize: '11.5px', opacity: 0.65 }}>
					{t('membersRolesDistributionDesc')}
				</p>
			</div>

			{/* Roles List */}
			<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
				{m.rolData?.roller.map((role) => {
					const count = m.members.filter((mbr) => mbr.roleId === role.id).length;
					return (
						<div
							key={role.id}
							className={s.memberCard}
							onClick={() => {
								m.setRolFilter(role.id);
								m.setSelectedDept('');
								setActiveTab('members');
							}}
						>
							<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
								<Shield size={18} color={role.renk || 'var(--accent)'} />
								<div>
									<div style={{ fontSize: '13.5px', fontWeight: 700, color: '#f8fafc' }}>{role.ad}</div>
									<div style={{ fontSize: '11px', opacity: 0.6 }}>
										{role.atanabilir ? t('membersRoleStandardDesc') : t('membersRoleSystemDesc')}
									</div>
								</div>
							</div>
							<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
								<span className={`${s.badge} ${s.badgeAccent}`}>{count} {t('membersCount')}</span>
								<ChevronRight size={14} opacity={0.5} />
							</div>
						</div>
					);
				})}
			</div>

			{/* Departments List */}
			<div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
				<div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', opacity: 0.6, letterSpacing: '0.04em', paddingLeft: '4px' }}>
					{t('membersDepartmentsTitle')}
				</div>
				{departments.map((dept) => {
					const count = m.members.filter((mbr) => mbr.bolum === dept).length;
					return (
						<div
							key={dept}
							className={s.memberCard}
							onClick={() => {
								m.setSelectedDept(dept);
								m.setRolFilter('');
								setActiveTab('members');
							}}
						>
							<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
								<Building2 size={18} opacity={0.7} />
								<div style={{ fontSize: '13px', fontWeight: 600 }}>{dept}</div>
							</div>
							<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
								<span style={{ fontSize: '12px', opacity: 0.65 }}>{count}</span>
								<ChevronRight size={14} opacity={0.5} />
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);

	return (
		<div className={s.mobileRoot}>
			{/* Scrollable Content Area */}
			<div className={s.mobileScrollArea} ref={scrollAreaRef}>
				{activeTab === 'members' && renderMembers()}
				{activeTab === 'pending' && renderPending()}
				{activeTab === 'roles' && renderRoles()}
			</div>

			{/* Fixed Apple iOS Bottom Tab Bar */}
			<nav className={s.mobileBottomTabBar} role="tablist" aria-label={t('membersMobNavAria')}>
				{tabs.map((tab) => {
					const activeTabMatched = activeTab === tab.id;
					const IconComponent = tab.Icon;
					const isAdd = tab.id === 'add';
					return (
						<button
							key={tab.id}
							type="button"
							role="tab"
							aria-selected={activeTabMatched}
							className={`${s.mobileBottomTabBtn} ${activeTabMatched ? s.mobileBottomTabBtnActive : ''}`}
							onClick={() => handleTabChange(tab.id)}
							title={tab.label}
							style={isAdd ? { color: 'var(--accent)' } : undefined}
						>
							<div className={s.mobileBottomTabIconWrap}>
								<IconComponent size={20} strokeWidth={activeTabMatched ? 2.3 : 1.7} />
								{tab.badgeCount !== undefined && (
									<span className={s.tabBadge}>{tab.badgeCount}</span>
								)}
							</div>
							<span className={s.mobileBottomTabLabel}>{tab.label}</span>
						</button>
					);
				})}
			</nav>

			{/* Modals */}
			<AddMemberModal
				isOpen={m.showAddModal}
				onClose={() => m.setShowAddModal(false)}
				onSubmit={m.handleAddMember}
				formError={m.formError}
				newAd={m.newAd}
				setNewAd={m.setNewAd}
				newSoyad={m.newSoyad}
				setNewSoyad={m.setNewSoyad}
				newEposta={m.newEposta}
				setNewEposta={m.setNewEposta}
				newBolum={m.newBolum}
				setNewBolum={m.setNewBolum}
				newSinif={m.newSinif}
				setNewSinif={m.setNewSinif}
				newRolId={m.newRolId}
				setNewRolId={m.setNewRolId}
				newOgrenciNo={m.newOgrenciNo}
				setNewOgrenciNo={m.setNewOgrenciNo}
				isSubmitting={m.isSubmitting}
				rolData={m.rolData}
				rolById={m.rolById}
				atanabilir={m.atanabilir}
			/>

			<MemberDetailModal
				member={m.selectedMemberForProfile}
				isOpen={Boolean(m.selectedMemberForProfile)}
				onClose={() => m.setSelectedMemberForProfile(null)}
				currentUserId={m.currentUser?.id}
				mailUser={m.mailUser}
				isReachable={Boolean(m.selectedMemberForProfile && m.reachable.has(m.selectedMemberForProfile.id))}
				onSendMessage={(id) => openApp('chat', { section: 'compose', itemId: id })}
			/>
		</div>
	);
}
