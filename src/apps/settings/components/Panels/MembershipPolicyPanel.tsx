'use client';

import React, { useEffect, useState } from 'react';
import {
	AlertCircle,
	CheckCircle2,
	Copy,
	Link2,
	Save,
	ShieldCheck,
	Trash2,
	UserPlus,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useDialog } from '@/components/Common/DialogProvider';
import { errorMessage } from '@/lib/errors';
import type { MembershipPolicy } from '@/lib/membershipPolicy';
import ui from '@/core/ui/ui.module.css';

interface Invitation {
	id: string;
	email: string | null;
	roleId: string | null;
	note: string | null;
	expiresAt: number;
	createdAt: number;
}

interface RoleOption {
	id: string;
	ad: string;
	renk: string;
}

const cardStyle: React.CSSProperties = {
	padding: '16px',
	borderRadius: '10px',
	border: '1px solid var(--window-border)',
	background: 'var(--card-bg, rgba(255,255,255,0.03))',
	display: 'flex',
	flexDirection: 'column',
	gap: '12px',
};

const inputStyle: React.CSSProperties = {
	width: '100%',
	padding: '8px 11px',
	borderRadius: '8px',
	border: '1px solid var(--window-border)',
	background: 'rgba(0, 0, 0, 0.22)',
	color: 'inherit',
	fontSize: '12.5px',
	outline: 'none',
	boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
	display: 'block',
	fontSize: '11.5px',
	fontWeight: 600,
	opacity: 0.82,
	marginBottom: '5px',
};

export function MembershipPolicyPanel() {
	const { t, language } = useI18n();
	const dialog = useDialog();
	const [policy, setPolicy] = useState<MembershipPolicy | null>(null);
	const [domains, setDomains] = useState('');
	const [invitations, setInvitations] = useState<Invitation[]>([]);
	const [roles, setRoles] = useState<RoleOption[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [status, setStatus] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);

	const [inviteEmail, setInviteEmail] = useState('');
	const [inviteRoleId, setInviteRoleId] = useState('');
	const [inviteNote, setInviteNote] = useState('');
	const [inviteDays, setInviteDays] = useState('7');
	const [inviteBusy, setInviteBusy] = useState(false);
	const [inviteError, setInviteError] = useState<string | null>(null);
	const [createdLink, setCreatedLink] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	const load = React.useCallback(async () => {
		setIsLoading(true);
		try {
			const [policyRes, inviteRes] = await Promise.all([
				fetch('/api/settings/membership-policy', { cache: 'no-store' }),
				fetch('/api/settings/invitations', { cache: 'no-store' }),
			]);
			const policyData = policyRes.ok ? await policyRes.json() : null;
			const inviteData = inviteRes.ok ? await inviteRes.json() : null;
			if (policyData?.policy) {
				setPolicy(policyData.policy);
				setDomains((policyData.policy.allowedEmailDomains ?? []).join(', '));
				setInviteDays(String(policyData.policy.inviteExpiryDays ?? 7));
			}
			if (inviteData) {
				setInvitations(inviteData.invitations ?? []);
				setRoles(inviteData.roles ?? []);
			}
		} catch {
			// The empty state is a valid fallback.
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const save = async () => {
		if (!policy) return;
		setIsSaving(true);
		setStatus(null);
		try {
			const res = await fetch('/api/settings/membership-policy', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...policy,
					allowedEmailDomains: domains
						.split(/[\s,;]+/)
						.map((domain) => domain.trim())
						.filter(Boolean),
				}),
			});
			const data = await res.json().catch(() => null);
			if (!res.ok) throw new Error(data?.error || t('membershipSaveFailed'));
			setPolicy(data.policy);
			setDomains((data.policy.allowedEmailDomains ?? []).join(', '));
			setStatus({ text: t('membershipSaved'), type: 'ok' });
		} catch (error) {
			setStatus({ text: errorMessage(error) || t('membershipSaveFailed'), type: 'err' });
		} finally {
			setIsSaving(false);
		}
	};

	const createInvite = async () => {
		setInviteBusy(true);
		setInviteError(null);
		setCreatedLink(null);
		setCopied(false);
		try {
			const res = await fetch('/api/settings/invitations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: inviteEmail.trim() || undefined,
					roleId: inviteRoleId || undefined,
					note: inviteNote.trim() || undefined,
					expiresInDays: Number(inviteDays) || undefined,
				}),
			});
			const data = await res.json().catch(() => null);
			if (!res.ok) throw new Error(data?.error || t('membershipInviteFailed'));
			setCreatedLink(`${window.location.origin}${data.path}`);
			setInviteEmail('');
			setInviteNote('');
			setInviteRoleId('');
			await load();
		} catch (error) {
			setInviteError(errorMessage(error) || t('membershipInviteFailed'));
		} finally {
			setInviteBusy(false);
		}
	};

	const copyLink = async () => {
		if (!createdLink) return;
		try {
			await navigator.clipboard.writeText(createdLink);
			setCopied(true);
		} catch {
			// The link is also visible for manual copy.
		}
	};

	const revoke = async (invitation: Invitation) => {
		const confirmed = await dialog.confirm({
			message: t('membershipInviteRevokeConfirm'),
			tone: 'warning',
			confirmLabel: t('membershipInviteRevoke'),
		});
		if (!confirmed) return;
		const res = await fetch(`/api/settings/invitations?id=${encodeURIComponent(invitation.id)}`, {
			method: 'DELETE',
		});
		if (res.ok) await load();
	};

	const roleName = (roleId: string | null) =>
		roles.find((role) => role.id === roleId)?.ad ?? t('membershipNoRole');

	if (isLoading) {
		return <div className={ui.muted}>{t('loading')}</div>;
	}
	if (!policy) {
		return <div className={ui.error}>{t('membershipSaveFailed')}</div>;
	}

	return (
		<div data-focus-section="membership" style={{ maxWidth: '760px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
			<div>
				<h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{t('membershipTitle')}</h2>
				<p style={{ margin: '3px 0 0', fontSize: '12.5px', opacity: 0.65 }}>{t('membershipDesc')}</p>
			</div>

			{status && (
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '8px',
						padding: '10px 12px',
						borderRadius: '8px',
						fontSize: '12px',
						background: status.type === 'ok' ? 'rgba(48,209,88,0.12)' : 'rgba(255,69,58,0.12)',
						color: status.type === 'ok' ? '#30d158' : '#ff453a',
						border: `1px solid ${status.type === 'ok' ? 'rgba(48,209,88,0.3)' : 'rgba(255,69,58,0.3)'}`,
					}}
				>
					{status.type === 'ok' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
					{status.text}
				</div>
			)}

			<div style={cardStyle}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '13px' }}>
					<ShieldCheck size={16} style={{ opacity: 0.7 }} />
					{t('membershipPolicySection')}
				</div>

				<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
					<div>
						<label style={labelStyle}>{t('membershipSelfRegistration')}</label>
						<select
							style={inputStyle}
							value={policy.selfRegistration}
							onChange={(event) =>
								setPolicy({ ...policy, selfRegistration: event.target.value as MembershipPolicy['selfRegistration'] })
							}
						>
							<option value="open">{t('membershipOpen')}</option>
							<option value="closed">{t('membershipClosed')}</option>
						</select>
					</div>
					<div>
						<label style={labelStyle}>{t('membershipMaxOpen')}</label>
						<input
							style={inputStyle}
							type="number"
							min={1}
							max={5}
							value={policy.maxOpenApplications}
							onChange={(event) => setPolicy({ ...policy, maxOpenApplications: Number(event.target.value) })}
						/>
					</div>
					<div>
						<label style={labelStyle}>{t('membershipReapplyDays')}</label>
						<input
							style={inputStyle}
							type="number"
							min={0}
							max={365}
							value={policy.reapplyCooldownDays}
							onChange={(event) => setPolicy({ ...policy, reapplyCooldownDays: Number(event.target.value) })}
						/>
					</div>
					<div>
						<label style={labelStyle}>{t('membershipInviteDays')}</label>
						<input
							style={inputStyle}
							type="number"
							min={1}
							max={90}
							value={policy.inviteExpiryDays}
							onChange={(event) => setPolicy({ ...policy, inviteExpiryDays: Number(event.target.value) })}
						/>
					</div>
				</div>

				<div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px' }}>
					<label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
						<input
							type="checkbox"
							checked={policy.adminCreate}
							onChange={(event) => setPolicy({ ...policy, adminCreate: event.target.checked })}
						/>
						{t('membershipAdminCreate')}
					</label>
					<label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
						<input
							type="checkbox"
							checked={policy.inviteEnabled}
							onChange={(event) => setPolicy({ ...policy, inviteEnabled: event.target.checked })}
						/>
						{t('membershipInviteEnabled')}
					</label>
					<label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
						<input
							type="checkbox"
							checked={policy.emailVerification}
							onChange={(event) => setPolicy({ ...policy, emailVerification: event.target.checked })}
						/>
						{t('membershipEmailVerification')}
					</label>
				</div>

				<div>
					<label style={labelStyle}>{t('membershipAllowedDomains')}</label>
					<input
						style={inputStyle}
						value={domains}
						onChange={(event) => setDomains(event.target.value)}
						placeholder="orbit.local, university.edu.tr"
					/>
					<div style={{ fontSize: '10.5px', opacity: 0.55, marginTop: '4px' }}>
						{t('membershipAllowedDomainsHint')}
					</div>
				</div>

				<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
					<button
						type="button"
						onClick={() => void save()}
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

			<div style={cardStyle}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '13px' }}>
					<UserPlus size={16} style={{ opacity: 0.7 }} />
					{t('membershipInvitations')}
				</div>
				<p style={{ margin: 0, fontSize: '11.5px', opacity: 0.6 }}>{t('membershipInvitationsDesc')}</p>

				<div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '8px' }}>
					<div>
						<label style={labelStyle}>{t('membershipInviteEmail')}</label>
						<input
							style={inputStyle}
							type="email"
							value={inviteEmail}
							onChange={(event) => setInviteEmail(event.target.value)}
							placeholder={t('membershipInviteOptional')}
						/>
					</div>
					<div>
						<label style={labelStyle}>{t('membershipInviteRole')}</label>
						<select
							style={inputStyle}
							value={inviteRoleId}
							onChange={(event) => setInviteRoleId(event.target.value)}
						>
							<option value="">{t('membershipNoRole')}</option>
							{roles.map((role) => (
								<option key={role.id} value={role.id}>
									{role.ad}
								</option>
							))}
						</select>
					</div>
					<div>
						<label style={labelStyle}>{t('membershipInviteDays')}</label>
						<input
							style={inputStyle}
							type="number"
							min={1}
							max={90}
							value={inviteDays}
							onChange={(event) => setInviteDays(event.target.value)}
						/>
					</div>
				</div>
				<div>
					<label style={labelStyle}>{t('membershipInviteNote')}</label>
					<input
						style={inputStyle}
						value={inviteNote}
						onChange={(event) => setInviteNote(event.target.value)}
					/>
				</div>
				{inviteError && <div className={ui.error}>{inviteError}</div>}
				{createdLink && (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
						<div style={{ fontSize: '11px', fontWeight: 600 }}>{t('membershipInviteLink')}</div>
						<div style={{ display: 'flex', gap: '6px' }}>
							<input style={{ ...inputStyle, fontFamily: 'monospace' }} readOnly value={createdLink} />
							<button type="button" className={ui.btn} onClick={() => void copyLink()}>
								<Copy size={13} />
								{copied ? t('membershipInviteCopied') : t('membershipInviteCopy')}
							</button>
						</div>
					</div>
				)}
				<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
					<button type="button" className={ui.primaryBtn} onClick={() => void createInvite()} disabled={inviteBusy}>
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
										{new Intl.DateTimeFormat(language === 'tr' ? 'tr-TR' : 'en-US', {
											dateStyle: 'medium',
										}).format(new Date(invitation.expiresAt))}
									</div>
								</div>
								<button
									type="button"
									className={ui.btn}
									onClick={() => void revoke(invitation)}
									title={t('membershipInviteRevoke')}
								>
									<Trash2 size={13} />
								</button>
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);
}
