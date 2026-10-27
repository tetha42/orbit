'use client';

import React from 'react';
import { X, Award, Trophy, Medal, Crown } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { KulupBilgileri } from '@/db';
import { ModalOverlay, useDraggableSheet } from '@/core/ui/Sheet';
import { CertificateQr } from './CertificateQr';
import { CertificateModalActions } from './CertificateModalActions';
import type { Certificate } from '../types';
import { CERTIFICATE_THEMES, inferCertificateCategory } from '@/lib/certificates';

interface CertificateDetailModalProps {
	cert: Certificate;
	currentUserName?: string;
	kulup: KulupBilgileri | null;
	copied: boolean;
	verifyUrl: (kod: string) => string;
	onClose: () => void;
	onCopyVerification: (kod: string) => void;
	onAddToLinkedIn: (cert: Certificate) => void;
	onError: (err: string) => void;
}

export function CertificateDetailModal({
	cert,
	currentUserName,
	kulup,
	copied,
	verifyUrl,
	onClose,
	onCopyVerification,
	onAddToLinkedIn,
	onError,
}: CertificateDetailModalProps) {
	const { t, language } = useI18n();
	const { offset, onHeaderMouseDown, onHeaderDoubleClick } = useDraggableSheet(true);
	const lang = (cert.dil === 'en' || language === 'en') ? 'en' : 'tr';
	const recipient = cert.kullaniciAdSoyad || currentUserName || t('membersMember');

	const catId = inferCertificateCategory(cert.baslik, cert.kategori);
	const theme = CERTIFICATE_THEMES[catId];

	const IconBadge = catId === 'honor' ? Crown : catId === 'service' ? Medal : catId === 'achievement' ? Trophy : Award;

	return (
		<ModalOverlay
			data-cert-view
			onClose={onClose}
			style={{
				background: 'rgba(0,0,0,0.82)',
				overflowY: 'auto',
			}}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={cert.baslik}
				onMouseDown={onHeaderMouseDown}
				onDoubleClick={onHeaderDoubleClick}
				style={{
					width: '740px',
					maxWidth: '95vw',
					maxHeight: 'calc(100vh - 64px)',
					overflowY: 'auto',
					background: theme.paperBg,
					color: '#1a1a1a',
					borderRadius: '16px',
					border: `8px double ${theme.borderColor}`,
					padding: '44px 48px',
					boxShadow: `0 24px 60px rgba(0,0,0,0.7), 0 0 40px ${theme.badgeBg}`,
					position: 'relative',
					textAlign: 'center',
					fontFamily: 'Georgia, serif',
					cursor: 'grab',
					...(offset.x !== 0 || offset.y !== 0
						? { transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }
						: {}),
				}}
			>
				<button
					onClick={onClose}
					style={{
						position: 'absolute',
						top: '16px',
						right: '16px',
						background: 'rgba(0,0,0,0.1)',
						border: 'none',
						borderRadius: '50%',
						width: '32px',
						height: '32px',
						cursor: 'pointer',
						fontSize: '16px',
						display: 'grid',
						placeItems: 'center',
					}}
				>
					<X size={16} />
				</button>

				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
					<IconBadge size={22} color={theme.accentColor} />
					<span
						style={{
							fontSize: '11px',
							letterSpacing: '1.5px',
							textTransform: 'uppercase',
							color: theme.accentColor,
							fontWeight: 700,
							background: theme.badgeBg,
							padding: '3px 10px',
							borderRadius: '12px',
							border: `1px solid ${theme.borderColor}`,
						}}
					>
						{theme.label[lang]}
					</span>
				</div>

				<div style={{ fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase', color: theme.secondaryColor, fontWeight: 700 }}>
					{kulup?.universite.toLocaleUpperCase(lang === 'en' ? 'en-US' : 'tr-TR')}
				</div>
				<div style={{ fontSize: '13px', color: '#555', marginTop: '2px' }}>
					{kulup?.kulupAdi.toLocaleUpperCase(lang === 'en' ? 'en-US' : 'tr-TR')}
				</div>

				<h2 style={{ fontSize: '27px', color: theme.secondaryColor, margin: '18px 0 10px 0', fontWeight: 700, letterSpacing: '-0.01em' }}>
					{theme.title[lang]}
				</h2>

				<p style={{ fontSize: '13.5px', color: '#666', margin: '0 0 16px 0', fontStyle: 'italic' }}>
					{theme.givenTo[lang]}
				</p>

				<div style={{ fontSize: '26px', fontWeight: 700, color: '#111', borderBottom: `2px solid ${theme.borderColor}`, display: 'inline-block', padding: '0 24px 6px 24px', marginBottom: '16px' }}>
					{recipient}
				</div>

				<p style={{ fontSize: '15px', color: '#333', maxWidth: '580px', margin: '0 auto 24px auto', lineHeight: 1.55 }}>
					<strong>"{cert.baslik}"</strong> {cert.aciklama ? cert.aciklama : theme.completion[lang]}
				</p>

				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '30px', paddingTop: '20px', borderTop: `1px solid ${theme.badgeBg}` }}>
					<div style={{ textAlign: 'center', minWidth: 150 }}>
						<div style={{ fontSize: '14px', fontWeight: 700 }}>{kulup?.imzalar[0]?.ad || '\u00A0'}</div>
						<div style={{ fontSize: '11px', color: '#666' }}>{kulup?.imzalar[0]?.unvan}</div>
					</div>

					<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
						<CertificateQr url={verifyUrl(cert.verificationCode)} />
						<div style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: '#777' }}>
							{cert.verificationCode}
						</div>
					</div>

					<div style={{ textAlign: 'center', minWidth: 150 }}>
						<div style={{ fontSize: '14px', fontWeight: 700 }}>{kulup?.imzalar[1]?.ad || '\u00A0'}</div>
						<div style={{ fontSize: '11px', color: '#666' }}>{kulup?.imzalar[1]?.unvan}</div>
					</div>
				</div>

				<CertificateModalActions
					cert={cert}
					recipient={recipient}
					kulup={kulup}
					copied={copied}
					verifyUrl={verifyUrl}
					onCopyVerification={onCopyVerification}
					onAddToLinkedIn={onAddToLinkedIn}
					onError={onError}
				/>
			</div>
		</ModalOverlay>
	);
}
