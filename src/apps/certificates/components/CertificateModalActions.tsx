'use client';

import React from 'react';
import { Download, Share2, Check } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useSound } from '@/core/sound';
import { generateCertificatePDF } from '@/lib/client/pdfGenerator';
import { inferCertificateCategory } from '@/lib/certificates';
import type { KulupBilgileri } from '@/db';
import type { Certificate } from '../types';

interface CertificateModalActionsProps {
	cert: Certificate;
	recipient: string;
	kulup: KulupBilgileri | null;
	copied: boolean;
	verifyUrl: (kod: string) => string;
	onCopyVerification: (kod: string) => void;
	onAddToLinkedIn: (cert: Certificate) => void;
	onError: (err: string) => void;
}

export function CertificateModalActions({
	cert,
	recipient,
	kulup,
	copied,
	verifyUrl,
	onCopyVerification,
	onAddToLinkedIn,
	onError,
}: CertificateModalActionsProps) {
	const { t } = useI18n();
	const { playSystemSound } = useSound();

	const handleDownloadPdf = async () => {
		if (!kulup) return;
		playSystemSound();
		try {
			const cat = inferCertificateCategory(cert.baslik, cert.kategori);

			await generateCertificatePDF({
				kullaniciAdSoyad: recipient,
				baslik: cert.baslik,
				verificationCode: cert.verificationCode,
				verilisTarihi: cert.verilisTarihi,
				universite: kulup.universite,
				kulupAdi: kulup.kulupAdi,
				imzalar: kulup.imzalar,
				dogrulamaUrl: verifyUrl(cert.verificationCode),
				category: cat,
				lang: (cert.dil === 'en' ? 'en' : 'tr'),
				customContext: cert.aciklama || undefined,
			});
		} catch {
			onError(t('crtPdfFailed'));
		}
	};

	return (
		<div style={{ marginTop: '28px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
			<button
				disabled={!kulup}
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
					boxShadow: '0 4px 14px rgba(212, 175, 55, 0.4)',
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
					background: 'rgba(212, 175, 55, 0.1)',
					color: '#8b6508',
					fontWeight: 600,
					fontSize: '13px',
					cursor: 'pointer',
				}}
			>
				{copied ? <Check size={16} color="#34c759" /> : <Share2 size={16} />}
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
					background: 'rgba(10, 102, 194, 0.12)',
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
