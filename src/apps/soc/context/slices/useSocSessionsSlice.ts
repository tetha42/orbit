'use client';

import { useState, useCallback } from 'react';
import type { useDialog } from '@/components/Common/DialogProvider';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import type { ActiveSessionInfo } from '../../types';
import {
	executeKillSession,
	executeKillAllOtherSessions,
	executeRevokeAnomalousSessions,
	executeSuspendUser,
} from '../../actions/sessionActions';

interface SessionsSliceDeps {
	dialog: ReturnType<typeof useDialog>;
	runSocAction: (
		payloadOrExec: Record<string, unknown> | (() => Promise<{ ok: boolean; error?: string }>),
		successMsg: string
	) => Promise<boolean>;
}

export function useSocSessionsSlice({ dialog, runSocAction }: SessionsSliceDeps) {
	const [sessions, setSessions] = useState<ActiveSessionInfo[]>([]);
	const { t } = useI18n();

	const handleKillSession = useCallback(
		async (session: ActiveSessionInfo) => {
			const confirmed = await dialog.confirm({
				title: t('socKillSessionTitle'),
				message: fill(t('socKillSessionMsg'), {
					name: session.name,
					surname: session.surname,
					email: session.email,
				}),
				tone: 'warning',
				confirmLabel: t('socKillSessionBtn'),
				cancelLabel: t('cancel'),
			});
			if (!confirmed) return;
			await runSocAction(
				() => executeKillSession(session.id),
				fill(t('socKillSessionSuccess'), { email: session.email })
			);
		},
		[dialog, runSocAction, t]
	);

	const handleKillAllOtherSessions = useCallback(async () => {
		const confirmed = await dialog.confirm({
			title: t('socKillAllTitle'),
			message: t('socKillAllMsg'),
			tone: 'danger',
			confirmLabel: t('socKillAllBtn'),
			cancelLabel: t('cancel'),
		});
		if (!confirmed) return;
		await runSocAction(() => executeKillAllOtherSessions(), t('socKillAllSuccess'));
	}, [dialog, runSocAction, t]);

	const handleRevokeAnomalousSessions = useCallback(async () => {
		const confirmed = await dialog.confirm({
			title: t('socRevokeAnomalousTitle'),
			message: t('socRevokeAnomalousMsg'),
			tone: 'danger',
			confirmLabel: t('socRevokeAnomalousBtn'),
			cancelLabel: t('cancel'),
		});
		if (!confirmed) return;
		await runSocAction(() => executeRevokeAnomalousSessions(), t('socRevokeAnomalousSuccess'));
	}, [dialog, runSocAction, t]);

	const handleSuspendUser = useCallback(
		async (session: ActiveSessionInfo) => {
			const confirmed = await dialog.confirm({
				title: t('socSuspendUserTitle'),
				message: fill(t('socSuspendUserMsg'), {
					name: session.name,
					surname: session.surname,
					email: session.email,
				}),
				tone: 'danger',
				confirmLabel: t('socSuspendUserBtn'),
				cancelLabel: t('cancel'),
			});
			if (!confirmed) return;
			await runSocAction(
				() => executeSuspendUser(session.id),
				fill(t('socSuspendUserSuccess'), { email: session.email })
			);
		},
		[dialog, runSocAction, t]
	);

	return {
		sessions,
		setSessions,
		handleKillSession,
		handleKillAllOtherSessions,
		handleRevokeAnomalousSessions,
		handleSuspendUser,
	};
}
