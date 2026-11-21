'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/core/i18n';
import { useDialog } from '@/components/Common/DialogProvider';
import { errorMessage } from '@/lib/errors';
import type { MembershipPolicy } from '@/lib/membershipPolicy';
import type { Invitation, RoleOption } from './types';

export function useMembershipPolicy() {
	const { t } = useI18n();
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

	const load = useCallback(async () => {
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
		roles.find((role) => role.id === roleId)?.name ?? t('membershipNoRole');

	return {
		policy,
		setPolicy,
		domains,
		setDomains,
		invitations,
		roles,
		isLoading,
		isSaving,
		status,
		inviteEmail,
		setInviteEmail,
		inviteRoleId,
		setInviteRoleId,
		inviteNote,
		setInviteNote,
		inviteDays,
		setInviteDays,
		inviteBusy,
		inviteError,
		createdLink,
		copied,
		save,
		createInvite,
		copyLink,
		revoke,
		roleName,
	};
}
