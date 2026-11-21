import { useCallback } from 'react';
import { invalidateResource } from '@/core/data/useJsonResource';
import type { DialogApi } from '@/components/Common/DialogProvider';
import { fill } from '@/lib/text';

interface UseMemberActionsParams {
	t: (key: string, fallback?: string) => string;
	dialog: DialogApi;
	playSystemSound: () => void;
	fetchMembers: () => Promise<unknown>;
}

export function useMemberActions({
	t,
	dialog,
	playSystemSound,
	fetchMembers,
}: UseMemberActionsParams) {
	const patchMember = useCallback(
		async (payload: Record<string, unknown>, onErrorMessage?: string) => {
			try {
				const res = await fetch('/api/members', {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});
				const data = await res.json().catch(() => ({}));
				if (!res.ok) {
					void dialog.alert({
						message: data.error || onErrorMessage || t('actionFailed'),
						tone: 'danger',
					});
					return null;
				}
				playSystemSound();
				invalidateResource('/api/members');
				await fetchMembers();
				return data;
			} catch {
				void dialog.alert({ message: t('connError'), tone: 'danger' });
				return null;
			}
		},
		[dialog, fetchMembers, playSystemSound, t],
	);

	const handleUpdateMemberRole = useCallback(
		async (id: string, roleId: string) => {
			await patchMember({ id, roleId: roleId || null });
		},
		[patchMember],
	);

	const handleUpdateMemberStatus = useCallback(
		async (id: string, status: 'active' | 'pending' | 'rejected' | 'alumni') => {
			await patchMember({ id, status });
		},
		[patchMember],
	);

	const handleAwardXp = useCallback(
		async (id: string, addXp: number) => {
			await patchMember({ id, addXp });
		},
		[patchMember],
	);

	const handleResetPassword = useCallback(
		async (id: string, name: string) => {
			const confirmed = await dialog.confirm({
				title: t('membersCtxResetPassword'),
				message: fill(t('membersResetPassConfirm'), { name }),
				tone: 'warning',
			});
			if (!confirmed) return;

			const data = await patchMember({ id, passwordReset: true });
			if (data?.temporaryPassword) {
				void dialog.alert({
					title: t('membersCtxResetPassword'),
					message: `${fill(t('membersResetPassSuccess'), { name })}\n\n${data.temporaryPassword}\n\n${t('membersResetPassNotice')}`,
					tone: 'success',
				});
			}
		},
		[dialog, patchMember, t],
	);

	const handleSendPasswordResetEmail = useCallback(
		async (id: string, name: string) => {
			const confirmed = await dialog.confirm({
				title: t('membersSendResetEmail'),
				message: fill(t('membersSendResetEmailConfirm'), { name }),
				tone: 'warning',
			});
			if (!confirmed) return;

			try {
				const res = await fetch(`/api/members/${encodeURIComponent(id)}/password-reset`, {
					method: 'POST',
				});
				const data = await res.json().catch(() => ({}));
				if (!res.ok) {
					throw new Error(data.error || t('membersSendResetEmailFailed'));
				}
				playSystemSound();
				void dialog.alert({
					title: t('membersSendResetEmail'),
					message: fill(t('membersSendResetEmailSuccess'), { name }),
					tone: 'success',
				});
			} catch (error: unknown) {
				void dialog.alert({
					message:
						error instanceof Error ? error.message : t('membersSendResetEmailFailed'),
					tone: 'danger',
				});
			}
		},
		[dialog, playSystemSound, t],
	);

	const handleDeleteMember = useCallback(
		async (id: string, name: string) => {
			const confirmed = await dialog.confirm({
				title: t('membersCtxDelete'),
				message: fill(t('membersDeleteConfirmMsg'), { name }),
				tone: 'danger',
			});
			if (!confirmed) return;

			try {
				const res = await fetch(`/api/members?id=${encodeURIComponent(id)}`, {
					method: 'DELETE',
				});
				const data = await res.json().catch(() => ({}));
				if (!res.ok) {
					void dialog.alert({
						message: data.error || t('membersDeleteFailed'),
						tone: 'danger',
					});
					return;
				}
				playSystemSound();
				invalidateResource('/api/members');
				await fetchMembers();
			} catch {
				void dialog.alert({ message: t('connError'), tone: 'danger' });
			}
		},
		[dialog, fetchMembers, playSystemSound, t],
	);

	return {
		handleUpdateMemberRole,
		handleUpdateMemberStatus,
		handleAwardXp,
		handleResetPassword,
		handleSendPasswordResetEmail,
		handleDeleteMember,
	};
}
