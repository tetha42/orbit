'use client';

import { useState, useCallback } from 'react';
import type { useDialog } from '@/components/Common/DialogProvider';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import type { SecurityBlock } from '../../types';
import { executeFirewallAction, executeUnban, executeClearRateLimit } from '../../actions/firewallActions';

interface FirewallSliceDeps {
	dialog: ReturnType<typeof useDialog>;
	runSocAction: (
		payloadOrExec: Record<string, unknown> | (() => Promise<{ ok: boolean; error?: string }>),
		successMsg: string
	) => Promise<boolean>;
}

export function useSocFirewallSlice({ dialog, runSocAction }: FirewallSliceDeps) {
	const [bans, setBans] = useState<SecurityBlock[]>([]);
	const [fwIp, setFwIp] = useState('');
	const [fwMode, setFwMode] = useState<'ban' | 'whitelist'>('ban');
	const [fwDuration, setFwDuration] = useState<string>('120');
	const [fwReason, setFwReason] = useState('');
	const [fwFilter, setFwFilter] = useState<'all' | 'ban' | 'whitelist'>('all');
	const { t } = useI18n();

	const handleFirewallSubmit = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault();
			const targetIp = fwIp.trim();
			if (!targetIp) return;

			if (fwMode === 'ban') {
				const durationMinutes = fwDuration === 'permanent' ? null : Number(fwDuration);
				const reason = fwReason.trim() || t('socFwDefaultBanReason');
				const ok = await runSocAction(
					() => executeFirewallAction({ ip: targetIp, mode: 'ban', durationMinutes, reason }),
					fill(t('socFwIpQuarantined'), { ip: targetIp })
				);
				if (ok) {
					setFwIp('');
					setFwReason('');
				}
			} else {
				const reason = fwReason.trim() || t('socFwDefaultWhitelistReason');
				const ok = await runSocAction(
					() => executeFirewallAction({ ip: targetIp, mode: 'whitelist', reason }),
					fill(t('socFwIpWhitelisted'), { ip: targetIp })
				);
				if (ok) {
					setFwIp('');
					setFwReason('');
				}
			}
		},
		[fwIp, fwMode, fwDuration, fwReason, runSocAction, t]
	);

	const handleQuickBan = useCallback(
		async (ip: string, reason: string) => {
			if (!ip || ip === 'unknown') return;
			const confirmed = await dialog.confirm({
				title: fill(t('socFwQuickBanTitle'), { ip }),
				message: fill(t('socFwQuickBanMsg'), { ip }),
				tone: 'danger',
				confirmLabel: t('socFwQuickBanBtn'),
				cancelLabel: t('cancel'),
			});
			if (!confirmed) return;
			await runSocAction(
				() => executeFirewallAction({ ip, mode: 'ban', reason, durationMinutes: 120 }),
				fill(t('socFwQuickBanSuccess'), { ip })
			);
		},
		[dialog, runSocAction, t]
	);

	const handleUnban = useCallback(
		async (ip: string) => {
			await runSocAction(
				() => executeUnban(ip),
				fill(t('socFwRuleRemoved'), { ip })
			);
		},
		[runSocAction, t]
	);

	const handleClearRateLimit = useCallback(
		async (key: string) => {
			const confirmed = await dialog.confirm({
				title: t('socFwResetRlTitle'),
				message: fill(t('socFwResetRlMsg'), { key }),
				tone: 'warning',
				confirmLabel: t('socFwResetRlBtn'),
				cancelLabel: t('cancel'),
			});
			if (!confirmed) return;
			await runSocAction(
				() => executeClearRateLimit(key),
				fill(t('socFwResetRlSuccess'), { key })
			);
		},
		[dialog, runSocAction, t]
	);

	return {
		bans,
		setBans,
		fwIp,
		setFwIp,
		fwMode,
		setFwMode,
		fwDuration,
		setFwDuration,
		fwReason,
		setFwReason,
		fwFilter,
		setFwFilter,
		handleFirewallSubmit,
		handleQuickBan,
		handleUnban,
		handleClearRateLimit,
	};
}
