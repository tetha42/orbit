'use client';

import React, { useState, useRef } from 'react';
import {
	Award,
	Trophy,
	Medal,
	FileCheck,
	PlusCircle,
	ExternalLink,
	Copy,
	Check,
	Zap,
	ShieldCheck,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { formatDate } from '@/core/data/format';
import type { useCertificates } from '../hooks/useCertificates';
import type { Certificate } from '../types';
import { LevelXpBanner } from './LevelXpBanner';
import { LeaderboardTab } from './LeaderboardTab';
import { BadgesGrid } from './BadgesGrid';
import { CertificateDetailModal } from './CertificateDetailModal';
import { SignatoriesModal } from './SignatoriesModal';
import { IssueCertificateModal } from './IssueCertificateModal';
import s from './CertificatesMobile.module.css';

export interface CertificatesMobileViewProps {
	c: ReturnType<typeof useCertificates>;
	currentUserName?: string;
	currentUserId?: string;
}

type CertificatesMobileTab = 'my' | 'leaderboard' | 'badges' | 'all' | 'issue';

export function CertificatesMobileView({
	c,
	currentUserName,
	currentUserId,
}: CertificatesMobileViewProps) {
	const { t } = useI18n();
	const [activeTab, setActiveTab] = useState<CertificatesMobileTab>('my');
	const scrollAreaRef = useRef<HTMLDivElement>(null);

	const handleTabChange = (tabId: CertificatesMobileTab) => {
		if (tabId === 'issue') {
			c.setIsIssuing(true);
			return;
		}
		if (activeTab === tabId) {
			scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
		} else {
			setActiveTab(tabId);
			if (tabId === 'my') c.setActiveTab('certificates');
			else if (tabId === 'all') c.setActiveTab('all');
			else if (tabId === 'leaderboard') c.setActiveTab('leaderboard');
			scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'instant' });
		}
	};

	const tabs: Array<{
		id: CertificatesMobileTab;
		label: string;
		Icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
	}> = [
		{ id: 'my', label: t('certMobTabMy'), Icon: Award },
		{ id: 'leaderboard', label: t('certMobTabLeaderboard'), Icon: Trophy },
		{ id: 'badges', label: t('certMobTabBadges'), Icon: Medal },
		...(c.isManager ? [{ id: 'all' as const, label: t('certMobTabAll'), Icon: FileCheck }] : []),
		...(c.isManager ? [{ id: 'issue' as const, label: t('certMobIssue'), Icon: PlusCircle }] : []),
	];

	const renderCertCard = (cert: Certificate) => (
		<div
			key={cert.id}
			className={s.certCard}
			onClick={() => c.setSelectedCert(cert)}
		>
			<div className={s.certCardAccentLine} />
			<div className={s.certHeader}>
				<div style={{ flex: 1, minWidth: 0 }}>
					<div className={s.certTitle}>{cert.baslik}</div>
					<div className={s.certSub}>
						<span>{cert.kullaniciAdSoyad}</span>
						<span>•</span>
						<span>{formatDate(cert.verilisTarihi)}</span>
					</div>
				</div>
				<span className={`${s.badge} ${s.badgeGold}`}>
					<ShieldCheck size={12} />
					<span>{cert.verificationCode}</span>
				</span>
			</div>

			<div style={{ fontSize: '11.5px', opacity: 0.65, display: 'flex', alignItems: 'center', gap: '6px' }}>
				<Zap size={12} color="var(--accent)" />
				<span>{cert.kategori || t('certDefaultCategory')}</span>
			</div>

			<div className={s.certActionsRow} onClick={(e) => e.stopPropagation()}>
				<button
					type="button"
					className={s.certBtn}
					onClick={() => void c.handleCopyVerification(cert.verificationCode)}
				>
					{c.copied ? <Check size={13} color="#34c759" /> : <Copy size={13} />}
					<span>{c.copied ? t('copied') : t('certCopyCode')}</span>
				</button>

				<button
					type="button"
					className={`${s.certBtn} ${s.certBtnPrimary}`}
					onClick={() => c.setSelectedCert(cert)}
				>
					<ExternalLink size={13} />
					<span>{t('details')}</span>
				</button>
			</div>
		</div>
	);

	return (
		<div className={s.mobileRoot}>
			{/* Scrollable Content Area */}
			<div className={s.mobileScrollArea} ref={scrollAreaRef}>
				{activeTab === 'my' && (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
						<LevelXpBanner
							userLevel={c.userLevel}
							userXP={c.userXP}
							nextLevelXP={c.level.sonraki}
							progressPercent={Math.round(c.level.ilerleme * 100)}
						/>

						<div style={{ padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
							<h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{t('certMyCertificates')}</h3>
							<span style={{ fontSize: '12px', opacity: 0.6 }}>{c.myCerts.length} {t('certCount')}</span>
						</div>

						<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
							{c.myCerts.length === 0 ? (
								<div className={s.card} style={{ textAlign: 'center', padding: '40px 16px', opacity: 0.65, fontSize: '13px' }}>
									<Award size={36} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
									<div>{t('certNoMyCerts')}</div>
								</div>
							) : (
								c.myCerts.map(renderCertCard)
							)}
						</div>
					</div>
				)}

				{activeTab === 'leaderboard' && (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
						<LeaderboardTab topMembers={c.topMembers} currentUserId={currentUserId} />
					</div>
				)}

				{activeTab === 'badges' && (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
						<BadgesGrid />
					</div>
				)}

				{activeTab === 'all' && (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
						<div style={{ padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
							<div>
								<h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{t('certAllCertificates')}</h3>
								<p style={{ margin: '2px 0 0', fontSize: '11.5px', opacity: 0.65 }}>{t('certAllCertificatesDesc')}</p>
							</div>
							<span style={{ fontSize: '12px', opacity: 0.6 }}>{c.certificates.length} {t('certCount')}</span>
						</div>

						<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
							{c.certificates.length === 0 ? (
								<div className={s.card} style={{ textAlign: 'center', padding: '40px 16px', opacity: 0.65, fontSize: '13px' }}>
									<FileCheck size={36} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
									<div>{t('certNoAllCerts')}</div>
								</div>
							) : (
								c.certificates.map(renderCertCard)
							)}
						</div>
					</div>
				)}
			</div>

			{/* Fixed Apple iOS Bottom Tab Bar */}
			<nav
				className={`${s.mobileBottomTabBar} ${tabs.length === 5 ? s.mobileBottomTabBar5 : ''}`}
				role="tablist"
				aria-label={t('certMobNavAria')}
			>
				{tabs.map((tab) => {
					const activeTabMatched = activeTab === tab.id;
					const IconComponent = tab.Icon;
					const isIssue = tab.id === 'issue';
					return (
						<button
							key={tab.id}
							type="button"
							role="tab"
							aria-selected={activeTabMatched}
							className={`${s.mobileBottomTabBtn} ${activeTabMatched ? s.mobileBottomTabBtnActive : ''}`}
							onClick={() => handleTabChange(tab.id)}
							title={tab.label}
							style={isIssue ? { color: 'var(--accent)' } : undefined}
						>
							<div className={s.mobileBottomTabIconWrap}>
								<IconComponent size={20} strokeWidth={activeTabMatched ? 2.3 : 1.7} />
							</div>
							<span className={s.mobileBottomTabLabel}>{tab.label}</span>
						</button>
					);
				})}
			</nav>

			{/* Modals */}
			{c.selectedCert && (
				<CertificateDetailModal
					cert={c.selectedCert}
					currentUserName={currentUserName}
					kulup={c.kulup}
					copied={c.copied}
					verifyUrl={c.verifyUrl}
					onClose={() => c.setSelectedCert(null)}
					onCopyVerification={c.handleCopyVerification}
					onAddToLinkedIn={c.handleAddToLinkedIn}
					onError={() => {}}
				/>
			)}

			{c.editingSignatories && c.kulup && (
				<SignatoriesModal
					initial={c.kulup}
					onClose={() => c.setEditingSignatories(false)}
					onSaved={() => {
						c.setEditingSignatories(false);
						void c.refetchKulup();
					}}
				/>
			)}

			<IssueCertificateModal
				isOpen={c.isIssuing}
				onClose={() => c.setIsIssuing(false)}
				onSubmit={c.handleIssueCertificate}
				issueMode={c.issueMode}
				setIssueMode={c.setIssueMode}
				issueUserId={c.issueUserId}
				setIssueUserId={c.setIssueUserId}
				members={c.members}
				issueBaslik={c.issueBaslik}
				setIssueBaslik={c.setIssueBaslik}
				issueEtkinlikId={c.issueEtkinlikId}
				setIssueEtkinlikId={c.setIssueEtkinlikId}
				issueCategory={c.issueCategory}
				setIssueCategory={c.setIssueCategory}
				issueLang={c.issueLang}
				setIssueLang={c.setIssueLang}
				issueContext={c.issueContext}
				setIssueContext={c.setIssueContext}
				events={c.events}
				isSubmitting={c.isSubmitting}
			/>
		</div>
	);
}
