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

	const currentUserName = currentUser ? `${currentUser.ad} ${currentUser.soyad}`.trim() : undefined;

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
		issueBaslik,
		setIssueBaslik,
		issueEtkinlikId,
		setIssueEtkinlikId,
		issueCategory,
		setIssueCategory,
		issueLang,
		setIssueLang,
		issueContext,
		setIssueContext,
		isSubmitting,
		events,
		kulup,
		refetchKulup,
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
				nextLevelXP={level.sonraki}
				progressPercent={Math.round(level.ilerleme * 100)}
				activeTab={activeTab}
				onSelectTab={setActiveTab}
				isManager={isManager}
				myCertsCount={myCerts.length}
				allCertsCount={certificates.length}
				kulup={kulup}
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
					kulup={kulup}
					copied={copied}
					verifyUrl={verifyUrl}
					onClose={() => setSelectedCert(null)}
					onCopyVerification={handleCopyVerification}
					onAddToLinkedIn={handleAddToLinkedIn}
					onError={() => {}}
				/>
			)}

			{editingSignatories && kulup && (
				<SignatoriesModal
					initial={kulup}
					onClose={() => setEditingSignatories(false)}
					onSaved={() => {
						setEditingSignatories(false);
						void refetchKulup();
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
				issueBaslik={issueBaslik}
				setIssueBaslik={setIssueBaslik}
				issueEtkinlikId={issueEtkinlikId}
				setIssueEtkinlikId={setIssueEtkinlikId}
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
