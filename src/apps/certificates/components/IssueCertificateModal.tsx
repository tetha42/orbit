'use client';

import React from 'react';
import { Award } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { Sheet } from '@/core/ui/Sheet';
import ui from '@/core/ui/ui.module.css';
import { CertificateTitlePresets } from './CertificateTitlePresets';
import { IssueModeToggle } from './IssueModeToggle';
import { IssueModalFooter } from './IssueModalFooter';
import type { MemberRankItem } from '../types';

interface IssueCertificateModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (e: React.FormEvent) => void;
	issueMode: 'single' | 'bulk';
	setIssueMode: (mode: 'single' | 'bulk') => void;
	issueUserId: string;
	setIssueUserId: (id: string) => void;
	members: MemberRankItem[];
	issueBaslik: string;
	setIssueBaslik: (title: string) => void;
	issueEtkinlikId: string;
	setIssueEtkinlikId: (id: string) => void;
	issueCategory?: 'achievement' | 'participation' | 'service' | 'honor';
	setIssueCategory?: (cat: 'achievement' | 'participation' | 'service' | 'honor') => void;
	issueLang?: 'tr' | 'en';
	setIssueLang?: (lang: 'tr' | 'en') => void;
	issueContext?: string;
	setIssueContext?: (ctx: string) => void;
	events: Array<{ id: string; baslik: string; katilimciSayisi: number }>;
	isSubmitting: boolean;
}

export function IssueCertificateModal({
	isOpen,
	onClose,
	onSubmit,
	issueMode,
	setIssueMode,
	issueUserId,
	setIssueUserId,
	members,
	issueBaslik,
	setIssueBaslik,
	issueEtkinlikId,
	setIssueEtkinlikId,
	issueCategory = 'achievement',
	setIssueCategory,
	issueLang = 'tr',
	setIssueLang,
	issueContext = '',
	setIssueContext,
	events,
	isSubmitting,
}: IssueCertificateModalProps) {
	const { t } = useI18n();

	if (!isOpen) return null;

	return (
		<Sheet
			title={t('certsIssueModalTitle')}
			label={t('certsIssueModalTitle')}
			icon={<Award size={20} color="#ff9500" />}
			onClose={onClose}
			onSubmit={onSubmit}
			maxWidth={520}
			dialogProps={{ 'data-cert-issue': '' }}
		>
			<IssueModeToggle mode={issueMode} onChange={setIssueMode} />

			{issueMode === 'single' && (
				<div className={ui.field}>
					<label className={ui.fieldLabel}>{t('certsIssueMemberLabel')}</label>
					<select
						required={issueMode === 'single'}
						value={issueUserId}
						onChange={(e) => setIssueUserId(e.target.value)}
						className={ui.select}
						style={{ maxWidth: 'none', width: '100%' }}
					>
						<option value="">{t('certsIssueSelectMember')}</option>
						{members.map((m) => (
							<option key={m.id} value={m.id}>
								{m.ad} {m.soyad} ({m.bolum} - {fill(t('membersClassYear'), { year: m.sinif })})
							</option>
						))}
					</select>
				</div>
			)}

			<div className={ui.field}>
				<label className={ui.fieldLabel}>{t('certsIssueTitleLabel')}</label>
				<input
					type="text"
					required
					className={ui.input}
					placeholder={t('certsIssueTitlePh')}
					value={issueBaslik}
					onChange={(e) => setIssueBaslik(e.target.value)}
				/>
				<CertificateTitlePresets
					onSelect={(preset, cat) => {
						setIssueBaslik(preset);
						if (cat && setIssueCategory) {
							setIssueCategory(cat as 'achievement' | 'participation' | 'service' | 'honor');
						}
					}}
				/>
			</div>

			<div className={ui.field}>
				<label className={ui.fieldLabel}>{t('certsIssueEventLabel')}</label>
				<select
					required={issueMode === 'bulk'}
					value={issueEtkinlikId}
					onChange={(e) => setIssueEtkinlikId(e.target.value)}
					className={ui.select}
					style={{ maxWidth: 'none', width: '100%' }}
				>
					<option value="">{issueMode === 'bulk' ? t('certsIssueSelectEvent') : t('certsIssueGeneralEvent')}</option>
					{events
						.filter((evt) => issueMode === 'single' || evt.katilimciSayisi > 0)
						.map((evt) => (
							<option key={evt.id} value={evt.id}>
								{evt.baslik}
								{issueMode === 'bulk' ? ` · ${fill(t('crtAttendees'), { n: evt.katilimciSayisi })}` : ''}
							</option>
						))}
				</select>
			</div>

			{setIssueCategory && setIssueLang && (
				<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
					<div className={ui.field}>
						<label className={ui.fieldLabel}>{t('certsCategoryLabel')}</label>
						<select
							value={issueCategory}
							onChange={(e) => setIssueCategory(e.target.value as 'achievement' | 'participation' | 'service' | 'honor')}
							className={ui.select}
							style={{ maxWidth: 'none', width: '100%' }}
						>
							<option value="achievement">{t('certsCategoryAchievement')}</option>
							<option value="participation">{t('certsCategoryParticipation')}</option>
							<option value="service">{t('certsCategoryService')}</option>
							<option value="honor">{t('certsCategoryHonor')}</option>
						</select>
					</div>

					<div className={ui.field}>
						<label className={ui.fieldLabel}>{t('certsLangLabel')}</label>
						<select
							value={issueLang}
							onChange={(e) => setIssueLang(e.target.value as 'tr' | 'en')}
							className={ui.select}
							style={{ maxWidth: 'none', width: '100%' }}
						>
							<option value="tr">🇹🇷 Türkçe (TR)</option>
							<option value="en">🇬🇧 English (EN)</option>
						</select>
					</div>
				</div>
			)}

			{setIssueContext && (
				<div className={ui.field}>
					<label className={ui.fieldLabel}>{t('certsCustomContextLabel')}</label>
					<input
						type="text"
						className={ui.input}
						placeholder={t('certsCustomContextPh')}
						value={issueContext}
						onChange={(e) => setIssueContext(e.target.value)}
					/>
				</div>
			)}

			<IssueModalFooter onClose={onClose} isSubmitting={isSubmitting} />
		</Sheet>
	);
}
