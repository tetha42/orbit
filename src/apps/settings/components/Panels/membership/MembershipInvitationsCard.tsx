'use client';

import React from 'react';
import { Copy, Link2, Trash2, UserPlus } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import ui from '@/core/ui/ui.module.css';
import {
	membershipCardStyle,
	membershipInputStyle,
	membershipLabelStyle,
	type Invitation,
	type RoleOption,
} from './types';

interface MembershipInvitationsCardProps {
	invitations: Invitation[];
	roles: RoleOption[];
	inviteEmail: string;
	inviteRoleId: string;
	inviteNote: string;
	inviteDays: string;
	inviteBusy: boolean;
	inviteError: string | null;
	createdLink: string | null;
	copied: boolean;
	roleName: (roleId: string | null) => string;
	onEmailChange: (value: string) => void;
	onRoleChange: (value: string) => void;
	onNoteChange: (value: string) => void;
	onDaysChange: (value: string) => void;
	onCreateInvite: () => void;
	onCopyLink: () => void;
	onRevoke: (invitation: Invitation) => void;
}

export function MembershipInvitationsCard({
	invitations,
	roles,
	inviteEmail,
	inviteRoleId,
	inviteNote,
	inviteDays,
	inviteBusy,
	inviteError,
	createdLink,
	copied,
	roleName,
	onEmailChange,
	onRoleChange,
	onNoteChange,
	onDaysChange,
	onCreateInvite,
	onCopyLink,
	onRevoke,
}: MembershipInvitationsCardProps) {
	const { t, language } = useI18n();

	return (
		<div style={membershipCardStyle}>
			<div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '13px' }}>
				<UserPlus size={16} style={{ opacity: 0.7 }} />
				{t('membershipInvitations')}
			</div>
			<p style={{ margin: 0, fontSize: '11.5px', opacity: 0.6 }}>{t('membershipInvitationsDesc')}</p>

			<div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '8px' }}>
				<div>
					<label style={membershipLabelStyle}>{t('membershipInviteEmail')}</label>
					<input
						style={membershipInputStyle}
						type="email"
						value={inviteEmail}
						onChange={(event) => onEmailChange(event.target.value)}
						placeholder={t('membershipInviteOptional')}
					/>
				</div>
				<div>
					<label style={membershipLabelStyle}>{t('membershipInviteRole')}</label>
					<select
						style={membershipInputStyle}
						value={inviteRoleId}
						onChange={(event) => onRoleChange(event.target.value)}
					>
						<option value="">{t('membershipNoRole')}</option>
						{roles.map((role) => (
							<option key={role.id} value={role.id}>
								{role.name}
							</option>
						))}
					</select>
				</div>
				<div>
					<label style={membershipLabelStyle}>{t('membershipInviteDays')}</label>
					<input
						style={membershipInputStyle}
						type="number"
						min={1}
						max={90}
						value={inviteDays}
						onChange={(event) => onDaysChange(event.target.value)}
					/>
				</div>
			</div>
			<div>
				<label style={membershipLabelStyle}>{t('membershipInviteNote')}</label>
				<input
					style={membershipInputStyle}
					value={inviteNote}
					onChange={(event) => onNoteChange(event.target.value)}
				/>
			</div>
			{inviteError && <div className={ui.error}>{inviteError}</div>}
			{createdLink && (
				<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
					<div style={{ fontSize: '11px', fontWeight: 600 }}>{t('membershipInviteLink')}</div>
					<div style={{ display: 'flex', gap: '6px' }}>
						<input style={{ ...membershipInputStyle, fontFamily: 'monospace' }} readOnly value={createdLink} />
						<button type="button" className={ui.btn} onClick={onCopyLink}>
							<Copy size={13} />
							{copied ? t('membershipInviteCopied') : t('membershipInviteCopy')}
						</button>
					</div>
				</div>
			)}
			<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
				<button type="button" className={ui.primaryBtn} onClick={onCreateInvite} disabled={inviteBusy}>
					<Link2 size={13} />
					{inviteBusy ? t('saving') : t('membershipInviteCreate')}
				</button>
			</div>

			<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
				{invitations.length === 0 ? (
					<div style={{ fontSize: '11.5px', opacity: 0.6 }}>{t('membershipInviteEmpty')}</div>
				) : (
					invitations.map((invitation) => (
						<div
							key={invitation.id}
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: '10px',
								padding: '8px 10px',
								borderRadius: '8px',
								border: '1px solid var(--window-border)',
								fontSize: '11.5px',
							}}
						>
							<div style={{ flex: 1, minWidth: 0 }}>
								<div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
									{invitation.email || roleName(invitation.roleId)}
								</div>
								<div style={{ opacity: 0.55 }}>
									{roleName(invitation.roleId)} ·{' '}
									{new Intl.DateTimeFormat(language, {
										dateStyle: 'medium',
									}).format(new Date(invitation.expiresAt))}
								</div>
							</div>
							<button
								type="button"
								className={ui.btn}
								onClick={() => onRevoke(invitation)}
								title={t('membershipInviteRevoke')}
							>
								<Trash2 size={13} />
							</button>
						</div>
					))
				)}
			</div>
		</div>
	);
}
