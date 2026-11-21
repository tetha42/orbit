'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useWindowActions } from '@/core/windows';
import type { useMembers } from '../hooks/useMembers';
import { AddMemberModal } from './AddMemberModal';
import { MemberDetailModal } from './MemberDetailModal';
import { MembersMobileDirectoryTab } from './mobile/MembersMobileDirectoryTab';
import { MembersMobilePendingTab } from './mobile/MembersMobilePendingTab';
import { MembersMobileRolesTab } from './mobile/MembersMobileRolesTab';
import { MembersMobileTabBar, type MembersMobileTab } from './mobile/MembersMobileTabBar';
import s from './MembersMobile.module.css';

export interface MembersMobileViewProps {
	m: ReturnType<typeof useMembers>;
}

export function MembersMobileView({ m }: MembersMobileViewProps) {
	const { openApp } = useWindowActions();
	const [activeTab, setActiveTab] = useState<Exclude<MembersMobileTab, 'add'>>('members');
	const scrollAreaRef = useRef<HTMLDivElement>(null);

	const pendingMembers = useMemo(
		() => m.members.filter((member) => member.status === 'pending'),
		[m.members],
	);

	const handleTabChange = (tab: MembersMobileTab) => {
		if (tab === 'add') {
			if (m.isAuthorizedToAdd) m.setShowAddModal(true);
			return;
		}
		if (activeTab === tab) {
			scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
		} else {
			setActiveTab(tab);
			scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'instant' });
		}
	};

	return (
		<div className={s.mobileRoot}>
			<div ref={scrollAreaRef} className={s.mobileScrollArea}>
				{activeTab === 'members' && <MembersMobileDirectoryTab m={m} />}
				{activeTab === 'pending' && (
					<MembersMobilePendingTab
						pendingMembers={pendingMembers}
						isAuthorizedToAdd={m.isAuthorizedToAdd}
						onUpdateStatus={(memberId, status) => void m.handleUpdateMemberStatus(memberId, status)}
					/>
				)}
				{activeTab === 'roles' && (
					<MembersMobileRolesTab
						m={m}
						onSelectMembersTab={() => handleTabChange('members')}
					/>
				)}
			</div>

			<MembersMobileTabBar
				activeTab={activeTab}
				pendingCount={pendingMembers.length}
				onSelectTab={handleTabChange}
			/>

			<AddMemberModal
				isOpen={m.showAddModal}
				onClose={() => m.setShowAddModal(false)}
				onSubmit={m.handleAddMember}
				formError={m.formError}
				newFirstName={m.newFirstName}
				setNewFirstName={m.setNewFirstName}
				newLastName={m.newLastName}
				setNewLastName={m.setNewLastName}
				newEmail={m.newEmail}
				setNewEmail={m.setNewEmail}
				newTrack={m.newTrack}
				setNewTrack={m.setNewTrack}
				newGrade={m.newGrade}
				setNewGrade={m.setNewGrade}
				newRoleId={m.newRoleId}
				setNewRoleId={m.setNewRoleId}
				newMemberHandle={m.newMemberHandle}
				setNewMemberHandle={m.setNewMemberHandle}
				newPassword={m.newPassword}
				setNewPassword={m.setNewPassword}
				memberFields={m.memberFields}
				coreConfig={m.coreConfig}
				customValues={m.customValues}
				setCustomValues={m.setCustomValues}
				fieldErrors={m.fieldErrors}
				isSubmitting={m.isSubmitting}
				roleData={m.roleData}
				rolesById={m.rolesById}
				assignableRoles={m.assignableRoles}
			/>

			<MemberDetailModal
				member={m.selectedMemberForProfile}
				isOpen={Boolean(m.selectedMemberForProfile)}
				onClose={() => m.setSelectedMemberForProfile(null)}
				currentUserId={m.currentUser?.id}
				mailUser={m.mailUser}
				isReachable={
					m.selectedMemberForProfile ? m.reachable.has(m.selectedMemberForProfile.id) : false
				}
				onSendMessage={(memberId) => openApp('mail', { section: 'compose', itemId: memberId })}
				canEdit={m.isAuthorizedToAdd}
				onSaved={() => {
					void m.fetchMembers();
					m.setSelectedMemberForProfile(null);
				}}
				onSendPasswordReset={
					m.selectedMemberForProfile
						? () => {
								const profile = m.selectedMemberForProfile!;
								void m.handleSendPasswordResetEmail(
									profile.id,
									`${profile.firstName} ${profile.lastName}`,
								);
							}
						: undefined
				}
			/>
		</div>
	);
}
