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
		atanabilir,
		rolById,
		rolData,
		rolSecenekleri,
		rolsuzVar,
		dokunulabilir,
		searchQuery,
		setSearchQuery,
		activeFilter,
		setActiveFilter,
		rolFilter,
		setRolFilter,
		selectedDept,
		setSelectedDept,
		selectedClass,
		setSelectedClass,
		showAddModal,
		setShowAddModal,
		newAd,
		setNewAd,
		newSoyad,
		setNewSoyad,
		newEposta,
		setNewEposta,
		newBolum,
		setNewBolum,
		newSinif,
		setNewSinif,
		newRolId,
		setNewRolId,
		newOgrenciNo,
		setNewOgrenciNo,
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
	} = m;

	return (
		<div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100%', width: '100%' }}>
			<MembersToolbar
				searchQuery={searchQuery}
				onSearchChange={setSearchQuery}
				selectedDept={selectedDept}
				onDeptChange={setSelectedDept}
				selectedClass={selectedClass}
				onClassChange={setSelectedClass}
				rolFilter={rolFilter}
				onRolFilterChange={setRolFilter}
				rolSecenekleri={rolSecenekleri}
				rolsuzVar={rolsuzVar}
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
				atanabilir={atanabilir}
				dokunulabilir={dokunulabilir}
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
				newAd={newAd}
				setNewAd={setNewAd}
				newSoyad={newSoyad}
				setNewSoyad={setNewSoyad}
				newEposta={newEposta}
				setNewEposta={setNewEposta}
				newBolum={newBolum}
				setNewBolum={setNewBolum}
				newSinif={newSinif}
				setNewSinif={setNewSinif}
				newRolId={newRolId}
				setNewRolId={setNewRolId}
				newOgrenciNo={newOgrenciNo}
				setNewOgrenciNo={setNewOgrenciNo}
				isSubmitting={isSubmitting}
				rolData={rolData}
				rolById={rolById}
				atanabilir={atanabilir}
			/>

			<MemberDetailModal
				member={selectedMemberForProfile}
				isOpen={Boolean(selectedMemberForProfile)}
				onClose={() => setSelectedMemberForProfile(null)}
				currentUserId={currentUser?.id}
				mailUser={mailUser}
				isReachable={Boolean(selectedMemberForProfile && reachable.has(selectedMemberForProfile.id))}
				onSendMessage={(id) => openApp('chat', { section: 'compose', itemId: id })}
			/>
		</div>
	);
}

// Re-export as alias for standard naming consistency
export { MemberDirectoryApp as MembersApp };
