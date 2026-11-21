'use client';

import React from 'react';
import { Download, Share2, Check } from 'lucide-react';
import { normalizeLocale, useI18n } from '@/core/i18n';
import { useSound } from '@/core/sound';
import { generateCertificatePDF } from '@/lib/i18n/data/certificatePdf';
import { inferCertificateCategory } from '@/lib/certificates';
import type { CommunityProfile } from '@/db';
import type { Certificate } from '../types';

interface CertificateModalActionsProps {
	cert: Certificate;
	recipient: string;
	club: CommunityProfile | null;
	copied: boolean;
	verifyUrl: (code: string) => string;
	onCopyVerification: (code: string) => void;
	onAddToLinkedIn: (cert: Certificate) => void;
	onError: (err: string) => void;
}

export function CertificateModalActions({
	cert,
	recipient,
	club,
	copied,
	verifyUrl,
	onCopyVerification,
	onAddToLinkedIn,
	onError,
}: CertificateModalActionsProps) {
	const { t } = useI18n();
	const { playSystemSound } = useSound();

	const handleDownloadPdf = async () => {
		if (!club) return;
		playSystemSound();
		try {
			const cat = inferCertificateCategory(cert.title, cert.category);

			await generateCertificatePDF({
				userNameSurname: recipient,
				title: cert.title,
				verificationCode: cert.verificationCode,
				issuanceDate: cert.issuanceDate,
				university: club.university,
				clubName: club.clubName,
				signatures: club.signatures,
				verificationUrl: verifyUrl(cert.verificationCode),
				category: cat,
				lang: normalizeLocale(cert.language, 'tr'),
				customContext: cert.description || undefined,
			});
		} catch {
			onError(t('crtPdfFailed'));
		}
	};

	return (
		<div style={{ marginTop: '28px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
			<button
				disabled={!club}
				onClick={handleDownloadPdf}
				style={{
					display: 'inline-flex',
					alignItems: 'center',
					gap: '8px',
					padding: '10px 22px',
					borderRadius: '8px',
					border: 'none',
					background: '#d4af37',
					color: '#1a1a1a',
					fontWeight: 700,
					fontSize: '13px',
					cursor: 'pointer',
					boxShadow: '0 4px 14px color-mix(in srgb, var(--gold) 40%, transparent)',
				}}
			>
				<Download size={16} />
				<span>{t('certsVectorPdfBtn')}</span>
			</button>

			<button
				onClick={() => onCopyVerification(cert.verificationCode)}
				style={{
					display: 'inline-flex',
					alignItems: 'center',
					gap: '8px',
					padding: '10px 18px',
					borderRadius: '8px',
					border: '1px solid #d4af37',
					background: 'color-mix(in srgb, var(--gold) 10%, transparent)',
					color: '#8b6508',
					fontWeight: 600,
					fontSize: '13px',
					cursor: 'pointer',
				}}
			>
				{copied ? <Check size={16} color="var(--success)" /> : <Share2 size={16} />}
				<span>{copied ? t('certsCopiedBtn') : t('certsVerifyLinkBtn')}</span>
			</button>

			<button
				onClick={() => onAddToLinkedIn(cert)}
				style={{
					display: 'inline-flex',
					alignItems: 'center',
					gap: '8px',
					padding: '10px 18px',
					borderRadius: '8px',
					border: '1px solid #0a66c2',
					background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
					color: '#0a66c2',
					fontWeight: 700,
					fontSize: '13px',
					cursor: 'pointer',
				}}
			>
				<Share2 size={16} />
				<span>{t('certsLinkedInBtn')}</span>
			</button>
		</div>
	);
}
