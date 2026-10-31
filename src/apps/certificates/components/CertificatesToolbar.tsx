'use client';

import React from 'react';
import { Award, ShieldCheck, Trophy, PenLine, Plus } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import type { CommunityProfile } from '@/db';
import { LevelXpBanner } from './LevelXpBanner';

interface CertificatesToolbarProps {
	userLevel: number;
	userXP: number;
	nextLevelXP: number;
	progressPercent: number;
	activeTab: 'certificates' | 'all' | 'leaderboard';
	onSelectTab: (tab: 'certificates' | 'all' | 'leaderboard') => void;
	isManager: boolean;
	myCertsCount: number;
	allCertsCount: number;
	kulup: CommunityProfile | null;
	onEditSignatories: () => void;
	onOpenIssue: () => void;
	message: { text: string; type: 'success' | 'error' } | null;
}

export function CertificatesToolbar({
	userLevel,
	userXP,
	nextLevelXP,
	progressPercent,
	activeTab,
	onSelectTab,
	isManager,
	myCertsCount,
	allCertsCount,
	kulup,
	onEditSignatories,
	onOpenIssue,
	message,
}: CertificatesToolbarProps) {
	const { t } = useI18n();

	return (
		<>
			<LevelXpBanner
				userLevel={userLevel}
				userXP={userXP}
				nextLevelXP={nextLevelXP}
				progressPercent={progressPercent}
			/>

			{message && (
				<div
					style={{
						padding: '10px 16px',
						background: message.type === 'success' ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 59, 48, 0.15)',
						borderBottom: `1px solid ${message.type === 'success' ? '#34c759' : '#ff3b30'}`,
						color: message.type === 'success' ? '#34c759' : '#ff3b30',
						fontSize: '13px',
						fontWeight: 600,
						borderRadius: '8px',
					}}
				>
					{message.text}
				</div>
			)}

			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
				<div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
					<button
						onClick={() => onSelectTab('certificates')}
						style={{
							padding: '8px 16px',
							borderRadius: '8px',
							border: 'none',
							background: activeTab === 'certificates' ? 'var(--accent)' : 'rgba(255, 255, 255, 0.08)',
							color: activeTab === 'certificates' ? 'var(--accent-contrast, #ffffff)' : 'inherit',
							fontSize: '13px',
							fontWeight: 700,
							cursor: 'pointer',
							display: 'flex',
							alignItems: 'center',
							gap: '6px',
						}}
					>
						<Award size={15} />
						<span>{fill(t('certsMyCertificates'), { n: myCertsCount })}</span>
					</button>

					{isManager && (
						<button
							onClick={() => onSelectTab('all')}
							style={{
								padding: '8px 16px',
								borderRadius: '8px',
								border: 'none',
								background: activeTab === 'all' ? 'var(--accent)' : 'rgba(255, 255, 255, 0.08)',
								color: activeTab === 'all' ? 'var(--accent-contrast, #ffffff)' : 'inherit',
								fontSize: '13px',
								fontWeight: 700,
								cursor: 'pointer',
								display: 'flex',
								alignItems: 'center',
								gap: '6px',
							}}
						>
							<ShieldCheck size={15} />
							<span>{fill(t('certsAllCertificates'), { n: allCertsCount })}</span>
						</button>
					)}

					<button
						onClick={() => onSelectTab('leaderboard')}
						style={{
							padding: '8px 16px',
							borderRadius: '8px',
							border: 'none',
							background: activeTab === 'leaderboard' ? 'var(--accent)' : 'rgba(255, 255, 255, 0.08)',
							color: activeTab === 'leaderboard' ? 'var(--accent-contrast, #ffffff)' : 'inherit',
							fontSize: '13px',
							fontWeight: 700,
							cursor: 'pointer',
							display: 'flex',
							alignItems: 'center',
							gap: '6px',
						}}
					>
						<Trophy size={15} color="#ffd60a" />
						<span>{t('certsLeaderboardTab')}</span>
					</button>
				</div>

				<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
					{isManager && kulup && (
						<button
							type="button"
							onClick={onEditSignatories}
							style={{
								padding: '8px 14px',
								borderRadius: '8px',
								border: '1px solid rgba(212, 175, 55, 0.5)',
								background: 'rgba(212, 175, 55, 0.12)',
								color: '#b08a1e',
								fontSize: '12.5px',
								fontWeight: 700,
								cursor: 'pointer',
								display: 'flex',
								alignItems: 'center',
								gap: '6px',
							}}
						>
							<PenLine size={14} /> {t('crtSettings')}
						</button>
					)}

					{isManager && (
						<button
							onClick={onOpenIssue}
							style={{
								padding: '8px 16px',
								borderRadius: '8px',
								border: 'none',
								background: 'var(--accent)',
								color: 'var(--accent-contrast, #ffffff)',
								fontSize: '13px',
								fontWeight: 700,
								cursor: 'pointer',
								display: 'flex',
								alignItems: 'center',
								gap: '6px',
								boxShadow: 'var(--accent-glow)',
							}}
						>
							<Plus size={15} />
							<span>{t('certsIssueCertificate')}</span>
						</button>
					)}
				</div>
			</div>
		</>
	);
}
