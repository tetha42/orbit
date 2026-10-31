'use client';

import React from 'react';
import { useWindowActions } from '@/core/windows';
import { useIsMobile } from '@/lib/client/useClientValue';
import { useMembers } from './hooks/useMembers';
import { MembersToolbar } from './components/MembersToolbar';
import { MembersTable } from './components/MembersTable';
import { AddMemberModal } from './components/AddMemberModal';
import { MemberDetailModal } from './components/MemberDetailModal';
import { MembersMobileView } from './components/MembersMobileView';

export function MemberDirectoryApp() {
	const { openApp } = useWindowActions();
	const isMobile = useIsMobile();
	const m = useMembers();

	if (isMobile) {
		return <MembersMobileView m={m} />;
	}

	const {
		currentUser,
		mailUser,
		reachable,
		isAuthorizedToAdd,
		isLoading,
		members,
		filteredMembers,
		assignableRoles,
		rolesById,
		roleData,
		roleOptions,
		hasRolelessMember,
		trackOptions,
		isMemberTouchable,
		searchQuery,
		setSearchQuery,
		activeFilter,
		setActiveFilter,
		roleFilter,
		setRoleFilter,
		selectedDepartment,
		setSelectedDepartment,
		selectedGrade,
		setSelectedGrade,
		showAddModal,
		setShowAddModal,
		newFirstName,
		setNewFirstName,
		newLastName,
		setNewLastName,
		newEmail,
		setNewEmail,
		newTrack,
		setNewTrack,
		newGrade,
		setNewGrade,
		newRoleId,
		setNewRoleId,
		newMemberHandle,
		setNewMemberHandle,
		newPassword,
		setNewPassword,
		memberFields,
		coreConfig,
		customValues,
		setCustomValues,
		fieldErrors,
		isSubmitting,
		formError,
		fetchMembers,
		handleAddMember,
		handleUpdateMemberRole,
		handleUpdateMemberStatus,
		handleAwardXp,
		handleDeleteMember,
		selectedMemberForProfile,
		setSelectedMemberForProfile,
		handleResetPassword,
		handleSendPasswordResetEmail,
	} = m;

	return (
		<div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100%', width: '100%' }}>
			<MembersToolbar
				searchQuery={searchQuery}
				onSearchChange={setSearchQuery}
				selectedDepartment={selectedDepartment}
				onDeptChange={setSelectedDepartment}
				selectedGrade={selectedGrade}
				onClassChange={setSelectedGrade}
				trackOptions={trackOptions}
				levelOptions={coreConfig.level.options}
				roleFilter={roleFilter}
				onRolFilterChange={setRoleFilter}
				roleOptions={roleOptions}
				hasRolelessMember={hasRolelessMember}
				activeFilter={activeFilter}
				onActiveFilterChange={setActiveFilter}
				totalMembersCount={members.length}
				isAuthorizedToAdd={isAuthorizedToAdd}
				isLoading={isLoading}
				onRefresh={fetchMembers}
				onOpenAdd={() => setShowAddModal(true)}
			/>

			<MembersTable
				members={filteredMembers}
				currentUserId={currentUser?.id}
				mailUser={mailUser}
				reachable={reachable}
				isAuthorizedToAdd={isAuthorizedToAdd}
				isLoading={isLoading}
				assignableRoles={assignableRoles}
				isMemberTouchable={isMemberTouchable}
				onOpenProfile={(m) => setSelectedMemberForProfile(m)}
				onResetPassword={handleResetPassword}
				onSendMessage={(id) => openApp('chat', { section: 'compose', itemId: id })}
				onUpdateStatus={handleUpdateMemberStatus}
				onUpdateRole={handleUpdateMemberRole}
				onAwardXp={handleAwardXp}
				onDelete={handleDeleteMember}
			/>

			<AddMemberModal
				isOpen={showAddModal}
				onClose={() => setShowAddModal(false)}
				onSubmit={handleAddMember}
				formError={formError}
				newFirstName={newFirstName}
				setNewFirstName={setNewFirstName}
				newLastName={newLastName}
				setNewLastName={setNewLastName}
				newEmail={newEmail}
				setNewEmail={setNewEmail}
				newTrack={newTrack}
				setNewTrack={setNewTrack}
				newGrade={newGrade}
				setNewGrade={setNewGrade}
				newRoleId={newRoleId}
				setNewRoleId={setNewRoleId}
				newMemberHandle={newMemberHandle}
				setNewMemberHandle={setNewMemberHandle}
				newPassword={newPassword}
				setNewPassword={setNewPassword}
				memberFields={memberFields}
				coreConfig={coreConfig}
				customValues={customValues}
				setCustomValues={setCustomValues}
				fieldErrors={fieldErrors}
				isSubmitting={isSubmitting}
				roleData={roleData}
				rolesById={rolesById}
				assignableRoles={assignableRoles}
			/>

			<MemberDetailModal
				member={selectedMemberForProfile}
				isOpen={Boolean(selectedMemberForProfile)}
				onClose={() => setSelectedMemberForProfile(null)}
				currentUserId={currentUser?.id}
				mailUser={mailUser}
				isReachable={Boolean(selectedMemberForProfile && reachable.has(selectedMemberForProfile.id))}
				onSendMessage={(id) => openApp('chat', { section: 'compose', itemId: id })}
				canEdit={isAuthorizedToAdd}
				onSaved={fetchMembers}
				onSendPasswordReset={
					selectedMemberForProfile
						? () =>
								void handleSendPasswordResetEmail(
									selectedMemberForProfile.id,
									`${selectedMemberForProfile.ad} ${selectedMemberForProfile.soyad}`.trim()
								)
						: undefined
				}
			/>
		</div>
	);
}

// Re-export as alias for standard naming consistency
export { MemberDirectoryApp as MembersApp };
