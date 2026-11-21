'use client';

import React from 'react';
import { Building2, Lock } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { CommunityIconUpload } from './CommunityIconUpload';
import {
	communityCardStyle,
	communityInputStyle,
	communityLabelStyle,
	communityReadonlyInputStyle,
	communitySectionTitleStyle,
} from './styles';

interface CommunityBrandingCardProps {
	appName: string;
	siteName: string;
	shortName: string;
	descriptionTr: string;
	descriptionEn: string;
	iconUrl: string | null;
	iconBusy: boolean;
	disabled?: boolean;
	onChangeSiteName: (value: string) => void;
	onChangeShortName: (value: string) => void;
	onChangeDescriptionTr: (value: string) => void;
	onChangeDescriptionEn: (value: string) => void;
	onUploadIcon: (file: File) => void;
	onRemoveIcon: () => void;
}

export function CommunityBrandingCard({
	appName,
	siteName,
	shortName,
	descriptionTr,
	descriptionEn,
	iconUrl,
	iconBusy,
	disabled = false,
	onChangeSiteName,
	onChangeShortName,
	onChangeDescriptionTr,
	onChangeDescriptionEn,
	onUploadIcon,
	onRemoveIcon,
}: CommunityBrandingCardProps) {
	const { t } = useI18n();

	return (
		<div style={communityCardStyle}>
			<h3 style={communitySectionTitleStyle}>
				<Building2 size={16} color="var(--accent)" />
				{t('identityBrandingSection')}
			</h3>

			<CommunityIconUpload
				siteName={siteName}
				iconUrl={iconUrl}
				iconBusy={iconBusy}
				disabled={disabled}
				onUploadIcon={onUploadIcon}
				onRemoveIcon={onRemoveIcon}
			/>

			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
				<div>
					<label style={communityLabelStyle}>{t('identitySiteName')}</label>
					<input
						type="text"
						required
						disabled={disabled}
						maxLength={120}
						value={siteName}
						onChange={(event) => onChangeSiteName(event.target.value)}
						placeholder="Orbit Community"
						style={communityInputStyle}
					/>
				</div>
				<div>
					<label style={communityLabelStyle}>{t('identityShortName')}</label>
					<input
						type="text"
						disabled={disabled}
						maxLength={32}
						value={shortName}
						onChange={(event) => onChangeShortName(event.target.value)}
						placeholder="Orbit"
						style={communityInputStyle}
					/>
				</div>
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
				<div>
					<label style={communityLabelStyle}>{t('identityDescriptionTr')}</label>
					<textarea
						rows={3}
						disabled={disabled}
						maxLength={400}
						value={descriptionTr}
						onChange={(event) => onChangeDescriptionTr(event.target.value)}
						style={{ ...communityInputStyle, resize: 'vertical' }}
					/>
				</div>
				<div>
					<label style={communityLabelStyle}>{t('identityDescriptionEn')}</label>
					<textarea
						rows={3}
						disabled={disabled}
						maxLength={400}
						value={descriptionEn}
						onChange={(event) => onChangeDescriptionEn(event.target.value)}
						style={{ ...communityInputStyle, resize: 'vertical' }}
					/>
				</div>
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
				<div>
					<label style={communityLabelStyle}>{t('identityStudio')}</label>
					<input type="text" value="tetha42" disabled readOnly style={communityReadonlyInputStyle} />
				</div>
				<div>
					<label style={communityLabelStyle}>{t('identityAppName')}</label>
					<input type="text" value={appName} disabled readOnly style={communityReadonlyInputStyle} />
				</div>
			</div>

			<div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
				<Lock size={12} style={{ flexShrink: 0, opacity: 0.7 }} />
				<span>{t('identityImmutableHint')}</span>
			</div>
		</div>
	);
}
