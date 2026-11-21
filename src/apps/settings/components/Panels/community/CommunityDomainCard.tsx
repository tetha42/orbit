'use client';

import React from 'react';
import { Award, Globe } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import {
	communityCardStyle,
	communityInputStyle,
	communityLabelStyle,
	communitySectionTitleStyle,
} from './styles';

interface CommunityDomainCardProps {
	domain: string;
	signature1Name: string;
	signature1Rank: string;
	signature2Name: string;
	signature2Rank: string;
	disabled?: boolean;
	onChangeDomain: (value: string) => void;
	onChangeSignature1Name: (value: string) => void;
	onChangeSignature1Rank: (value: string) => void;
	onChangeSignature2Name: (value: string) => void;
	onChangeSignature2Rank: (value: string) => void;
}

export function CommunityDomainCard({
	domain,
	signature1Name,
	signature1Rank,
	signature2Name,
	signature2Rank,
	disabled = false,
	onChangeDomain,
	onChangeSignature1Name,
	onChangeSignature1Rank,
	onChangeSignature2Name,
	onChangeSignature2Rank,
}: CommunityDomainCardProps) {
	const { t } = useI18n();

	return (
		<div style={communityCardStyle}>
			<h3 style={communitySectionTitleStyle}>
				<Globe size={16} color="var(--accent)" />
				{t('identityDomainSection')}
			</h3>

			<div>
				<label style={communityLabelStyle}>{t('identityDomain')}</label>
				<input
					type="text"
					required
					disabled={disabled}
					value={domain}
					onChange={(event) => onChangeDomain(event.target.value)}
					placeholder="orbit.local"
					style={communityInputStyle}
				/>
			</div>

			<div
				style={{
					paddingTop: '10px',
					borderTop: '1px solid var(--window-border)',
					display: 'flex',
					flexDirection: 'column',
					gap: '12px',
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
					<Award size={15} color="#ffd60a" />
					{t('identitySignatories')}
				</div>

				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
					<div
						style={{
							padding: '12px',
							borderRadius: '10px',
							background: 'rgba(255,255,255,0.03)',
							border: '1px solid var(--window-border)',
							display: 'flex',
							flexDirection: 'column',
							gap: '10px',
						}}
					>
						<div style={{ fontSize: '12px', fontWeight: 600 }}>{t('identitySignatoryPrimary')}</div>
						<div>
							<label style={communityLabelStyle}>{t('identityFullName')}</label>
							<input
								type="text"
								disabled={disabled}
								value={signature1Name}
								onChange={(event) => onChangeSignature1Name(event.target.value)}
								style={communityInputStyle}
							/>
						</div>
						<div>
							<label style={communityLabelStyle}>{t('identityTitleLabel')}</label>
							<input
								type="text"
								disabled={disabled}
								value={signature1Rank}
								onChange={(event) => onChangeSignature1Rank(event.target.value)}
								style={communityInputStyle}
							/>
						</div>
					</div>

					<div
						style={{
							padding: '12px',
							borderRadius: '10px',
							background: 'rgba(255,255,255,0.03)',
							border: '1px solid var(--window-border)',
							display: 'flex',
							flexDirection: 'column',
							gap: '10px',
						}}
					>
						<div style={{ fontSize: '12px', fontWeight: 600 }}>{t('identitySignatorySecondary')}</div>
						<div>
							<label style={communityLabelStyle}>{t('identityFullName')}</label>
							<input
								type="text"
								disabled={disabled}
								value={signature2Name}
								onChange={(event) => onChangeSignature2Name(event.target.value)}
								style={communityInputStyle}
							/>
						</div>
						<div>
							<label style={communityLabelStyle}>{t('identityTitleLabel')}</label>
							<input
								type="text"
								disabled={disabled}
								value={signature2Rank}
								onChange={(event) => onChangeSignature2Rank(event.target.value)}
								style={communityInputStyle}
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
