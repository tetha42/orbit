'use client';

import React from 'react';
import { useSession } from '@/core/session';
import { useIsMobile } from '@/lib/client/useClientValue';
import { useCertificates } from './hooks/useCertificates';
import { CertificatesToolbar } from './components/CertificatesToolbar';
import { CertificatesList } from './components/CertificatesList';
import { CertificateDetailModal } from './components/CertificateDetailModal';
import { SignatoriesModal } from './components/SignatoriesModal';
import { IssueCertificateModal } from './components/IssueCertificateModal';
import { BadgesGrid } from './components/BadgesGrid';
import { LeaderboardTab } from './components/LeaderboardTab';
import { CertificatesMobileView } from './components/CertificatesMobileView';

export function CertificatesApp() {
	const isMobile = useIsMobile();
	const { currentUser, currentUserId } = useSession();
	const c = useCertificates();

	const currentUserName = currentUser ? `${currentUser.name} ${currentUser.surname}`.trim() : undefined;

	if (isMobile) {
		return (
			<CertificatesMobileView
				c={c}
				currentUserName={currentUserName}
				currentUserId={currentUserId}
			/>
		);
	}

	const {
		isManager,
		certificates,
		myCerts,
		displayedCerts,
		selectedCert,
		setSelectedCert,
		copied,
		activeTab,
		setActiveTab,
		message,
		isIssuing,
		setIsIssuing,
		issueUserId,
		setIssueUserId,
		issueTitle,
		setIssueTitle,
		issueEventId,
		setIssueEventId,
		issueCategory,
		setIssueCategory,
		issueLang,
		setIssueLang,
		issueContext,
		setIssueContext,
		isSubmitting,
		events,
		club,
		refetchClub,
		editingSignatories,
		setEditingSignatories,
		issueMode,
		setIssueMode,
		verifyUrl,
		members,
		topMembers,
		userXP,
		userLevel,
		level,
		handleCopyVerification,
		handleAddToLinkedIn,
		handleIssueCertificate,
		handleRevokeCertificate,
	} = c;

	return (
		<div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
			<CertificatesToolbar
				userLevel={userLevel}
				userXP={userXP}
				nextLevelXP={level.next}
				progressPercent={Math.round(level.progress * 100)}
				activeTab={activeTab}
				onSelectTab={setActiveTab}
				isManager={isManager}
				myCertsCount={myCerts.length}
				allCertsCount={certificates.length}
				club={club}
				onEditSignatories={() => setEditingSignatories(true)}
				onOpenIssue={() => setIsIssuing(true)}
				message={message}
			/>

			{activeTab === 'leaderboard' ? (
				<LeaderboardTab topMembers={topMembers} currentUserId={currentUserId} />
			) : (
				<>
					<BadgesGrid />
					<CertificatesList
						displayedCerts={displayedCerts}
						activeTab={activeTab}
						isManager={isManager}
						copied={copied}
						onSelectCert={setSelectedCert}
						onCopyVerification={handleCopyVerification}
						onAddToLinkedIn={handleAddToLinkedIn}
						onRevokeCertificate={handleRevokeCertificate}
					/>
				</>
			)}

			{selectedCert && (
				<CertificateDetailModal
					cert={selectedCert}
					currentUserName={currentUserName}
					club={club}
					copied={copied}
					verifyUrl={verifyUrl}
					onClose={() => setSelectedCert(null)}
					onCopyVerification={handleCopyVerification}
					onAddToLinkedIn={handleAddToLinkedIn}
					onError={() => {}}
				/>
			)}

			{editingSignatories && club && (
				<SignatoriesModal
					initial={club}
					onClose={() => setEditingSignatories(false)}
					onSaved={() => {
						setEditingSignatories(false);
						void refetchClub();
					}}
				/>
			)}

			<IssueCertificateModal
				isOpen={isIssuing}
				onClose={() => setIsIssuing(false)}
				onSubmit={handleIssueCertificate}
				issueMode={issueMode}
				setIssueMode={setIssueMode}
				issueUserId={issueUserId}
				setIssueUserId={setIssueUserId}
				members={members}
				issueTitle={issueTitle}
				setIssueTitle={setIssueTitle}
				issueEventId={issueEventId}
				setIssueEventId={setIssueEventId}
				issueCategory={issueCategory}
				setIssueCategory={setIssueCategory}
				issueLang={issueLang}
				setIssueLang={setIssueLang}
				issueContext={issueContext}
				setIssueContext={setIssueContext}
				events={events}
				isSubmitting={isSubmitting}
			/>
		</div>
	);
}
