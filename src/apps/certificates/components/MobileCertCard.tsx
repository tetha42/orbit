'use client';

import React from 'react';
import { Check, Copy, ExternalLink, ShieldCheck, Zap } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { formatDate } from '@/core/data/format';
import type { Certificate } from '../types';
import s from './CertificatesMobile.module.css';

interface MobileCertCardProps {
	cert: Certificate;
	copied: boolean;
	onSelect: (cert: Certificate) => void;
	onCopyVerification: (code: string) => void;
}

export function MobileCertCard({ cert, copied, onSelect, onCopyVerification }: MobileCertCardProps) {
	const { t } = useI18n();

	return (
		<div className={s.certCard} onClick={() => onSelect(cert)}>
			<div className={s.certCardAccentLine} />
			<div className={s.certHeader}>
				<div style={{ flex: 1, minWidth: 0 }}>
					<div className={s.certTitle}>{cert.title}</div>
					<div className={s.certSub}>
						<span>{cert.userNameSurname}</span>
						<span>•</span>
						<span>{formatDate(cert.issuanceDate)}</span>
					</div>
				</div>
				<span className={`${s.badge} ${s.badgeGold}`}>
					<ShieldCheck size={12} />
					<span>{cert.verificationCode}</span>
				</span>
			</div>

			<div style={{ fontSize: '11.5px', opacity: 0.65, display: 'flex', alignItems: 'center', gap: '6px' }}>
				<Zap size={12} color="var(--accent)" />
				<span>{cert.category || t('certDefaultCategory')}</span>
			</div>

			<div className={s.certActionsRow} onClick={(e) => e.stopPropagation()}>
				<button type="button" className={s.certBtn} onClick={() => void onCopyVerification(cert.verificationCode)}>
					{copied ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
					<span>{copied ? t('copied') : t('certCopyCode')}</span>
				</button>

				<button type="button" className={`${s.certBtn} ${s.certBtnPrimary}`} onClick={() => onSelect(cert)}>
					<ExternalLink size={13} />
					<span>{t('details')}</span>
				</button>
			</div>
		</div>
	);
}
