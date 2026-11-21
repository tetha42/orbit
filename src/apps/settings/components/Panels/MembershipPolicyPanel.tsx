'use client';

import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import ui from '@/core/ui/ui.module.css';
import { useMembershipPolicy } from './membership/useMembershipPolicy';
import { MembershipPolicyCard } from './membership/MembershipPolicyCard';
import { MembershipInvitationsCard } from './membership/MembershipInvitationsCard';

export function MembershipPolicyPanel() {
	const { t } = useI18n();
	const state = useMembershipPolicy();

	if (state.isLoading) {
		return <div className={ui.muted}>{t('loading')}</div>;
	}
	if (!state.policy) {
		return <div className={ui.error}>{t('membershipSaveFailed')}</div>;
	}

	return (
		<div
			data-focus-section="membership"
			style={{ maxWidth: '760px', display: 'flex', flexDirection: 'column', gap: '18px' }}
		>
			<div>
				<h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{t('membershipTitle')}</h2>
				<p style={{ margin: '3px 0 0', fontSize: '12.5px', opacity: 0.65 }}>{t('membershipDesc')}</p>
			</div>

			{state.status && (
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '8px',
						padding: '10px 12px',
						borderRadius: '8px',
						fontSize: '12px',
						background: state.status.type === 'ok' ? 'color-mix(in srgb, var(--success) 12%, transparent)' : 'color-mix(in srgb, var(--danger) 12%, transparent)',
						color: state.status.type === 'ok' ? 'var(--success)' : 'var(--danger)',
						border: `1px solid ${
							state.status.type === 'ok' ? 'color-mix(in srgb, var(--success) 30%, transparent)' : 'color-mix(in srgb, var(--danger) 30%, transparent)'
						}`,
					}}
				>
					{state.status.type === 'ok' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
					{state.status.text}
				</div>
			)}

			<MembershipPolicyCard
				policy={state.policy}
				domains={state.domains}
				isSaving={state.isSaving}
				onChangePolicy={state.setPolicy}
				onChangeDomains={state.setDomains}
				onSave={() => void state.save()}
			/>

			<MembershipInvitationsCard
				invitations={state.invitations}
				roles={state.roles}
				inviteEmail={state.inviteEmail}
				inviteRoleId={state.inviteRoleId}
				inviteNote={state.inviteNote}
				inviteDays={state.inviteDays}
				inviteBusy={state.inviteBusy}
				inviteError={state.inviteError}
				createdLink={state.createdLink}
				copied={state.copied}
				roleName={state.roleName}
				onEmailChange={state.setInviteEmail}
				onRoleChange={state.setInviteRoleId}
				onNoteChange={state.setInviteNote}
				onDaysChange={state.setInviteDays}
				onCreateInvite={() => void state.createInvite()}
				onCopyLink={() => void state.copyLink()}
				onRevoke={(invitation) => void state.revoke(invitation)}
			/>
		</div>
	);
}
