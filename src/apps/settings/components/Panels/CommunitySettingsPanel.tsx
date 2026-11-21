'use client';

import React, { useEffect, useRef } from 'react';
import { Building2, CheckCircle2, Shield, Sparkles, XCircle } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useCommunitySettings } from './community/useCommunitySettings';
import { CommunityBrandingCard } from './community/CommunityBrandingCard';
import { CommunityArchetypeCard } from './community/CommunityArchetypeCard';
import { CommunityDomainCard } from './community/CommunityDomainCard';

export function CommunitySettingsPanel() {
	const { t } = useI18n();
	const state = useCommunitySettings();
	const statusRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (state.status) {
			statusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}
	}, [state.status]);

	if (state.isLoading) {
		return (
			<div style={{ padding: '40px', textAlign: 'center', fontSize: '13px', opacity: 0.6 }}>
				{t('loading')}
			</div>
		);
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '680px', margin: '0 auto' }}>
			<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
				<div
					style={{
						width: '40px',
						height: '40px',
						borderRadius: '10px',
						background: 'linear-gradient(135deg, var(--accent), var(--indigo))',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						color: '#fff',
						flexShrink: 0,
					}}
				>
					<Building2 size={20} />
				</div>
				<div>
					<h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>{t('identityTitle')}</h2>
					<p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
						{t('identityDesc')}
					</p>
				</div>
			</div>

			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: '10px',
					padding: '10px 14px',
					borderRadius: '10px',
					background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
					border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
					fontSize: '12.5px',
					color: 'var(--text-secondary)',
					lineHeight: 1.45,
				}}
			>
				<Sparkles size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
				<span>{t('identityInfo')}</span>
			</div>

			{state.status && (
				<div
					ref={statusRef}
					role={state.status.type === 'error' ? 'alert' : 'status'}
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '8px',
						padding: '10px 14px',
						borderRadius: '10px',
						fontSize: '12.5px',
						background: state.status.type === 'success' ? 'color-mix(in srgb, var(--success) 12%, transparent)' : 'color-mix(in srgb, var(--danger) 12%, transparent)',
						color: state.status.type === 'success' ? 'var(--success)' : 'var(--danger)',
						border: `1px solid ${state.status.type === 'success' ? 'color-mix(in srgb, var(--success) 30%, transparent)' : 'color-mix(in srgb, var(--danger) 30%, transparent)'}`,
					}}
				>
					{state.status.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
					<span>{state.status.text}</span>
				</div>
			)}

			<form onSubmit={state.handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
				<CommunityBrandingCard
					appName={state.identity.appName}
					siteName={state.siteName}
					shortName={state.shortName}
					descriptionTr={state.descriptionTr}
					descriptionEn={state.descriptionEn}
					iconUrl={state.iconUrl}
					iconBusy={state.iconBusy}
					disabled={state.isSaving}
					onChangeSiteName={state.setSiteName}
					onChangeShortName={state.setShortName}
					onChangeDescriptionTr={state.setDescriptionTr}
					onChangeDescriptionEn={state.setDescriptionEn}
					onUploadIcon={(file) => void state.uploadIcon(file)}
					onRemoveIcon={() => void state.removeIcon()}
				/>

				<CommunityArchetypeCard
					archetype={state.archetype}
					disabled={state.isSaving}
					onSelectArchetype={state.setArchetype}
				/>

				<CommunityDomainCard
					domain={state.domain}
					signature1Name={state.signature1Name}
					signature1Rank={state.signature1Rank}
					signature2Name={state.signature2Name}
					signature2Rank={state.signature2Rank}
					disabled={state.isSaving}
					onChangeDomain={state.setDomain}
					onChangeSignature1Name={state.setSignature1Name}
					onChangeSignature1Rank={state.setSignature1Rank}
					onChangeSignature2Name={state.setSignature2Name}
					onChangeSignature2Rank={state.setSignature2Rank}
				/>

				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
					<span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
						{t('identityChangesImmediateHint', 'Changes apply across all pages immediately.')}
					</span>
					<button
						type="submit"
						disabled={state.isSaving}
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '8px',
							padding: '10px 18px',
							borderRadius: '10px',
							border: 'none',
							background: 'var(--accent)',
							color: '#fff',
							fontSize: '13.5px',
							fontWeight: 600,
							cursor: state.isSaving ? 'not-allowed' : 'pointer',
							opacity: state.isSaving ? 0.65 : 1,
						}}
					>
						<Shield size={15} />
						{state.isSaving ? t('saving') : t('identitySave')}
					</button>
				</div>
			</form>
		</div>
	);
}
