'use client';

import React from 'react';
import { Award } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { CertificateCard } from './CertificateCard';
import type { Certificate } from '../types';

interface CertificatesListProps {
	displayedCerts: Certificate[];
	activeTab: 'certificates' | 'all' | 'leaderboard';
	isManager: boolean;
	copied: boolean;
	onSelectCert: (cert: Certificate) => void;
	onCopyVerification: (code: string) => void;
	onAddToLinkedIn: (cert: Certificate) => void;
	onRevokeCertificate: (cert: Certificate) => void;
}

export function CertificatesList({
	displayedCerts,
	activeTab,
	isManager,
	copied,
	onSelectCert,
	onCopyVerification,
	onAddToLinkedIn,
	onRevokeCertificate,
}: CertificatesListProps) {
	const { t } = useI18n();

	return (
		<div>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
				<h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
					{activeTab === 'all' ? t('certsAllListTitle') : t('certsVerifiedListTitle')} ({displayedCerts.length})
				</h3>
				<span style={{ fontSize: '12px', opacity: 0.65 }}>
					{t('certsUrlNotice')}
				</span>
			</div>

			{displayedCerts.length === 0 ? (
				<div
					style={{
						padding: '30px',
						textAlign: 'center',
						background: 'rgba(255, 255, 255, 0.03)',
						borderRadius: '12px',
						border: '1px dashed rgba(255, 255, 255, 0.1)',
					}}
				>
					<Award size={36} opacity={0.3} style={{ marginBottom: '8px' }} />
					<div style={{ fontSize: '14px', fontWeight: 600 }}>{t('certsEmptyTitle')}</div>
					<div style={{ fontSize: '12px', opacity: 0.65, marginTop: '4px' }}>
						{t('certsEmptyDesc')}
					</div>
				</div>
			) : (
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
					{displayedCerts.map((cert) => (
						<CertificateCard
							key={cert.id}
							cert={cert}
							isManager={isManager}
							showRecipient={activeTab === 'all'}
							copied={copied}
							onSelect={() => onSelectCert(cert)}
							onCopyVerification={() => onCopyVerification(cert.verificationCode)}
							onAddToLinkedIn={() => onAddToLinkedIn(cert)}
							onRevoke={() => onRevokeCertificate(cert)}
						/>
					))}
				</div>
			)}
		</div>
	);
}
