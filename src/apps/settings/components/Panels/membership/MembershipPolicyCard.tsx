'use client';

import React from 'react';
import { Save, ShieldCheck } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { MembershipPolicy } from '@/lib/membershipPolicy';
import { membershipCardStyle, membershipInputStyle, membershipLabelStyle } from './types';

interface MembershipPolicyCardProps {
	policy: MembershipPolicy;
	domains: string;
	isSaving: boolean;
	onChangePolicy: (next: MembershipPolicy) => void;
	onChangeDomains: (next: string) => void;
	onSave: () => void;
}

export function MembershipPolicyCard({
	policy,
	domains,
	isSaving,
	onChangePolicy,
	onChangeDomains,
	onSave,
}: MembershipPolicyCardProps) {
	const { t } = useI18n();

	return (
		<div style={membershipCardStyle}>
			<div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '13px' }}>
				<ShieldCheck size={16} style={{ opacity: 0.7 }} />
				{t('membershipPolicySection')}
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
				<div>
					<label style={membershipLabelStyle}>{t('membershipSelfRegistration')}</label>
					<select
						style={membershipInputStyle}
						value={policy.selfRegistration}
						onChange={(event) =>
							onChangePolicy({
								...policy,
								selfRegistration: event.target.value as MembershipPolicy['selfRegistration'],
							})
						}
					>
						<option value="open">{t('membershipOpen')}</option>
						<option value="closed">{t('membershipClosed')}</option>
					</select>
				</div>
				<div>
					<label style={membershipLabelStyle}>{t('membershipMaxOpen')}</label>
					<input
						style={membershipInputStyle}
						type="number"
						min={1}
						max={5}
						value={policy.maxOpenApplications}
						onChange={(event) =>
							onChangePolicy({ ...policy, maxOpenApplications: Number(event.target.value) })
						}
					/>
				</div>
				<div>
					<label style={membershipLabelStyle}>{t('membershipReapplyDays')}</label>
					<input
						style={membershipInputStyle}
						type="number"
						min={0}
						max={365}
						value={policy.reapplyCooldownDays}
						onChange={(event) =>
							onChangePolicy({ ...policy, reapplyCooldownDays: Number(event.target.value) })
						}
					/>
				</div>
				<div>
					<label style={membershipLabelStyle}>{t('membershipInviteDays')}</label>
					<input
						style={membershipInputStyle}
						type="number"
						min={1}
						max={90}
						value={policy.inviteExpiryDays}
						onChange={(event) =>
							onChangePolicy({ ...policy, inviteExpiryDays: Number(event.target.value) })
						}
					/>
				</div>
			</div>

			<div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px' }}>
				<label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
					<input
						type="checkbox"
						checked={policy.adminCreate}
						onChange={(event) => onChangePolicy({ ...policy, adminCreate: event.target.checked })}
					/>
					{t('membershipAdminCreate')}
				</label>
				<label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
					<input
						type="checkbox"
						checked={policy.inviteEnabled}
						onChange={(event) => onChangePolicy({ ...policy, inviteEnabled: event.target.checked })}
					/>
					{t('membershipInviteEnabled')}
				</label>
				<label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
					<input
						type="checkbox"
						checked={policy.emailVerification}
						onChange={(event) =>
							onChangePolicy({ ...policy, emailVerification: event.target.checked })
						}
					/>
					{t('membershipEmailVerification')}
				</label>
			</div>

			<div>
				<label style={membershipLabelStyle}>{t('membershipAllowedDomains')}</label>
				<input
					style={membershipInputStyle}
					value={domains}
					onChange={(event) => onChangeDomains(event.target.value)}
					placeholder="orbit.local, university.edu.tr"
				/>
				<div style={{ fontSize: '10.5px', opacity: 0.55, marginTop: '4px' }}>
					{t('membershipAllowedDomainsHint')}
				</div>
			</div>

			<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
				<button
					type="button"
					onClick={onSave}
					disabled={isSaving}
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: '6px',
						padding: '8px 14px',
						borderRadius: '8px',
						border: 'none',
						background: 'var(--accent)',
						color: '#fff',
						fontSize: '12px',
						fontWeight: 600,
						cursor: isSaving ? 'wait' : 'pointer',
						opacity: isSaving ? 0.7 : 1,
					}}
				>
					<Save size={13} />
					{isSaving ? t('saving') : t('membershipSave')}
				</button>
			</div>
		</div>
	);
}
