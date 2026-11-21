'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import type { RegistrationCoreTextField } from '@/lib/i18n/data/registrationConfig';
import { coreCardStyle, coreInputStyle, coreLabelStyle } from './styles';

interface MemberIdFieldCardProps {
	memberId: RegistrationCoreTextField;
	onUpdate: (patch: Partial<RegistrationCoreTextField>) => void;
}

export function MemberIdFieldCard({ memberId, onUpdate }: MemberIdFieldCardProps) {
	const { t } = useI18n();

	return (
		<div style={coreCardStyle}>
			<div
				style={{
					display: 'flex',
					alignItems: 'flex-start',
					justifyContent: 'space-between',
					gap: '12px',
					marginBottom: '10px',
				}}
			>
				<div>
					<div style={{ fontSize: '12.5px', fontWeight: 700 }}>{t('regCoreMemberId')}</div>
					<div style={{ fontSize: '11px', opacity: 0.55, marginTop: '2px' }}>
						{t('regCoreMemberIdHint')}
					</div>
				</div>
				<label
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: '7px',
						fontSize: '11.5px',
						fontWeight: 600,
						cursor: 'pointer',
						whiteSpace: 'nowrap',
					}}
				>
					<input
						type="checkbox"
						checked={memberId.required}
						onChange={(event) => onUpdate({ required: event.target.checked })}
						style={{ accentColor: 'var(--accent)' }}
					/>
					{t('regCoreRequired')}
				</label>
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
				<div>
					<label style={coreLabelStyle}>{t('formLabelTr')}</label>
					<input
						style={coreInputStyle}
						value={memberId.labelTr}
						onChange={(event) => onUpdate({ labelTr: event.target.value })}
					/>
				</div>
				<div>
					<label style={coreLabelStyle}>{t('formLabelEn')}</label>
					<input
						style={coreInputStyle}
						value={memberId.labelEn}
						onChange={(event) => onUpdate({ labelEn: event.target.value })}
					/>
				</div>
				<div>
					<label style={coreLabelStyle}>{t('formPlaceholderTr')}</label>
					<input
						style={coreInputStyle}
						value={memberId.placeholderTr}
						onChange={(event) => onUpdate({ placeholderTr: event.target.value })}
					/>
				</div>
				<div>
					<label style={coreLabelStyle}>{t('formPlaceholderEn')}</label>
					<input
						style={coreInputStyle}
						value={memberId.placeholderEn}
						onChange={(event) => onUpdate({ placeholderEn: event.target.value })}
					/>
				</div>
			</div>
			<div style={{ fontSize: '10.5px', opacity: 0.55, marginTop: '6px' }}>
				{memberId.required ? t('regCoreRequiredOn') : t('regCoreRequiredOff')}
			</div>
		</div>
	);
}
