'use client';

import React, { useMemo } from 'react';
import { Award, Calendar, Check, Share2, ShieldCheck, Trash2, Trophy, Medal, Crown, Copy } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useContextMenu } from '@/core/shell';
import type { MenuItem } from '@/types/workspace';
import type { Certificate } from '../types';
import { CERTIFICATE_THEMES, inferCertificateCategory } from '@/lib/certificates';

interface CertificateCardProps {
	cert: Certificate;
	isManager: boolean;
	showRecipient: boolean;
	copied: boolean;
	onSelect: () => void;
	onCopyVerification: () => void;
	onAddToLinkedIn: () => void;
	onRevoke: () => void;
}

export function CertificateCard({
	cert,
	isManager,
	showRecipient,
	copied,
	onSelect,
	onCopyVerification,
	onAddToLinkedIn,
	onRevoke,
}: CertificateCardProps) {
	const { t, language } = useI18n();

	const catId = inferCertificateCategory(cert.baslik, cert.kategori);
	const theme = CERTIFICATE_THEMES[catId];
	const lang = (cert.dil === 'en' || language === 'en') ? 'en' : 'tr';
	const IconBadge = catId === 'honor' ? Crown : catId === 'service' ? Medal : catId === 'achievement' ? Trophy : Award;

	const menuItems = useMemo<MenuItem[]>(() => {
		const items: MenuItem[] = [
			{
				id: `cert-view-${cert.id}`,
				label: t('certsViewBtn'),
				icon: <Award size={13} />,
				action: () => onSelect(),
			},
			{
				id: `cert-copy-${cert.id}`,
				label: t('ctxCertCopyCode'),
				icon: <Copy size={13} />,
				action: () => onCopyVerification(),
			},
			{
				id: `cert-linkedin-${cert.id}`,
				label: 'LinkedIn',
				icon: <Share2 size={13} />,
				action: () => onAddToLinkedIn(),
			},
		];

		if (isManager) {
			items.push(
				{ id: `sep-cert-${cert.id}`, label: '', separator: true },
				{
					id: `cert-revoke-${cert.id}`,
					label: t('certsRevokeTooltip'),
					icon: <Trash2 size={13} />,
					danger: true,
					action: () => onRevoke(),
				}
			);
		}

		return items;
	}, [cert.id, t, onSelect, onCopyVerification, onAddToLinkedIn, isManager, onRevoke]);

	const contextMenuProps = useContextMenu({ items: menuItems });

	return (
		<div
			data-focus-id={`cert:${cert.id}`}
			data-cert-code={cert.verificationCode}
			{...contextMenuProps}
			style={{
				background: `linear-gradient(135deg, ${theme.badgeBg}, rgba(255, 255, 255, 0.02))`,
				border: `1px solid ${theme.borderColor}`,
				borderRadius: '14px',
				padding: '20px',
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'space-between',
				gap: '14px',
				boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
				position: 'relative',
				overflow: 'hidden',
			}}
		>
			<div>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
					<span
						style={{
							fontSize: '11px',
							fontWeight: 700,
							fontFamily: 'monospace',
							padding: '3px 8px',
							borderRadius: '6px',
							background: theme.badgeBg,
							color: theme.accentColor,
							border: `1px solid ${theme.borderColor}`,
						}}
					>
						{cert.verificationCode}
					</span>
					<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
						<span
							style={{
								fontSize: '10.5px',
								fontWeight: 700,
								color: theme.accentColor,
								background: theme.badgeBg,
								padding: '2px 8px',
								borderRadius: '10px',
								display: 'inline-flex',
								alignItems: 'center',
								gap: '4px',
							}}
						>
							<IconBadge size={12} />
							{theme.label[lang]}
						</span>
						<ShieldCheck size={16} color="#34c759" />
					</div>
				</div>

				{showRecipient && cert.kullaniciAdSoyad && (
					<div style={{ fontSize: '12px', fontWeight: 600, color: theme.accentColor, marginBottom: '4px' }}>
						{t('certsStudentLabel')} {cert.kullaniciAdSoyad}
					</div>
				)}

				<h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 6px 0', lineHeight: 1.4 }}>
					{cert.baslik}
				</h4>

				<div style={{ fontSize: '12px', opacity: 0.7, display: 'flex', alignItems: 'center', gap: '6px' }}>
					<Calendar size={13} />
					<span>{t('certsIssueDateLabel')} {new Date(cert.verilisTarihi).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US')}</span>
				</div>
			</div>

			<div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
				<button
					onClick={onSelect}
					style={{
						flex: 1,
						minWidth: '80px',
						padding: '8px 12px',
						borderRadius: '8px',
						border: 'none',
						background: 'var(--accent)',
						color: 'var(--accent-contrast, #ffffff)',
						fontSize: '12.5px',
						fontWeight: 700,
						cursor: 'pointer',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						gap: '6px',
					}}
				>
					<Award size={14} />
					<span>{t('certsViewBtn')}</span>
				</button>

				<button
					onClick={onCopyVerification}
					title={t('certsCopyLinkTooltip')}
					style={{
						padding: '8px 12px',
						borderRadius: '8px',
						border: '1px solid rgba(255, 255, 255, 0.15)',
						background: 'rgba(255, 255, 255, 0.08)',
						color: 'inherit',
						fontSize: '12px',
						cursor: 'pointer',
						display: 'flex',
						alignItems: 'center',
						gap: '6px',
					}}
				>
					{copied ? <Check size={14} color="#34c759" /> : <Share2 size={14} />}
					<span>{copied ? t('certsCopiedBtn') : t('certsVerifyBtn')}</span>
				</button>

				<button
					onClick={onAddToLinkedIn}
					title={t('certsAddLinkedInTooltip')}
					style={{
						padding: '8px 12px',
						borderRadius: '8px',
						border: '1px solid rgba(10, 102, 194, 0.3)',
						background: 'rgba(10, 102, 194, 0.12)',
						color: '#0a66c2',
						fontSize: '12px',
						fontWeight: 600,
						cursor: 'pointer',
						display: 'flex',
						alignItems: 'center',
						gap: '4px',
					}}
				>
					<span>LinkedIn</span>
				</button>

				{isManager && (
					<button
						onClick={onRevoke}
						title={t('certsRevokeTooltip')}
						style={{
							padding: '8px 10px',
							borderRadius: '8px',
							border: '1px solid rgba(255, 69, 58, 0.4)',
							background: 'rgba(255, 69, 58, 0.1)',
							color: '#ff453a',
							cursor: 'pointer',
							display: 'grid',
							placeItems: 'center',
						}}
					>
						<Trash2 size={13} />
					</button>
				)}
			</div>
		</div>
	);
}
