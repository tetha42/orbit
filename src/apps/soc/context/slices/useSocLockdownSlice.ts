'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import socContract from '../../soc.contract.json';
import { resolveContractError } from '@/contracts/client';
import type { EmergencyKillSwitches, WebhookConfig, SocOverviewData } from '../../types';
import {
	executeToggleLockdown,
	executeToggleKillSwitch,
	executeSaveWebhook,
	executeTestWebhook,
} from '../../actions/lockdownActions';

interface LockdownSliceDeps {
	canManage: boolean;
	showNotice: (type: 'ok' | 'err', text: string) => void;
	overview: SocOverviewData | null;
	setOverview: React.Dispatch<React.SetStateAction<SocOverviewData | null>>;
	setIsSubmitting: (v: boolean) => void;
	runSocAction: (payload: Record<string, unknown>, successMsg: string) => Promise<boolean>;
}

export function useSocLockdownSlice({
	canManage,
	showNotice,
	overview,
	setOverview,
	runSocAction,
}: LockdownSliceDeps) {
	const [showLockdownModal, setShowLockdownModal] = useState<boolean>(false);
	const [showWebhookModal, setShowWebhookModal] = useState<boolean>(false);
	const showWebhookModalRef = useRef<boolean>(false);
	const { t } = useI18n();

	const [webhookConfig, setWebhookConfig] = useState<WebhookConfig>({
		enabled: false,
		provider: 'discord',
		webhookUrl: '',
		botToken: '',
		chatId: '',
		emailRecipients: '',
		alsoSendEmail: false,
		minSeverity: 'WARN',
		notifyOn: {
			lockdown: true,
			autoban: true,
			honeypot: true,
			fim: true,
			loginAnomalies: false,
		},
	});
	const [isTestingWebhook, setIsTestingWebhook] = useState<boolean>(false);

	useEffect(() => {
		showWebhookModalRef.current = showWebhookModal;
	}, [showWebhookModal]);

	const handleToggleLockdown = useCallback(async () => {
		if (!canManage) return;
		setShowLockdownModal(true);
	}, [canManage]);

	const confirmLockdownToggle = useCallback(async () => {
		if (!canManage) return;
		setShowLockdownModal(false);
		let currentlyActive = overview?.lockdown.active;
		if (currentlyActive === undefined) {
			try {
				const res = await fetch('/api/soc?action=overview');
				const payload = await res.json().catch(() => ({}));
				currentlyActive = Boolean(payload?.overview?.lockdown?.active);
			} catch {
				currentlyActive = false;
			}
		}
		const nextState = !currentlyActive;
		const reason = nextState ? t('socLockdownActivateReason') : t('socLockdownDeactivateReason');
		const successMsg = nextState ? t('socLockdownActivated') : t('socLockdownDeactivated');
		await runSocAction(
			{ __exec: () => executeToggleLockdown(nextState, reason) } as unknown as Record<string, unknown>,
			successMsg
		);
	}, [canManage, overview?.lockdown.active, runSocAction, t]);

	const handleToggleKillSwitch = useCallback(
		async (key: keyof EmergencyKillSwitches, value: boolean) => {
			if (!canManage) return;
			const stateLabel = value ? t('socStateActive') : t('socStateDisabled');
			const successMsg = fill(t('socKillSwitchStatus'), { key, state: stateLabel });
			const ok = await runSocAction(
				{ __exec: () => executeToggleKillSwitch(key, value) } as unknown as Record<string, unknown>,
				successMsg
			);
			if (ok) {
				setOverview((prev) =>
					prev
						? {
								...prev,
								emergencySwitches: {
									disableRegistrations: false,
									disableUploads: false,
									passkeyOnly: false,
									...prev.emergencySwitches,
									[key]: value,
								},
							}
						: prev
				);
			}
		},
		[canManage, runSocAction, setOverview, t]
	);

	const handleSaveWebhook = useCallback(
		async (overrideConfig?: WebhookConfig) => {
			if (!canManage) return;
			const cfgToSave = overrideConfig ?? webhookConfig;
			const ok = await runSocAction(
				{ __exec: () => executeSaveWebhook(cfgToSave) } as unknown as Record<string, unknown>,
				t('socWebhookSaved')
			);
			if (ok) {
				setWebhookConfig(cfgToSave);
				setShowWebhookModal(false);
			}
		},
		[canManage, webhookConfig, runSocAction, t]
	);

	const handleTestWebhook = useCallback(
		async (overrideConfig?: WebhookConfig) => {
			if (!canManage) return;
			setIsTestingWebhook(true);
			const cfgToTest = overrideConfig ?? webhookConfig;
			try {
				const result = await executeTestWebhook(cfgToTest);
				if (!result.ok || !result.data?.sent) {
					showNotice(
						'err',
						resolveContractError(result.data, socContract, t, result.error || t('socWebhookTestFailed'))
					);
				} else {
					showNotice('ok', t('socWebhookTestSent'));
				}
			} catch {
				showNotice('err', t('socNetworkError'));
			} finally {
				setIsTestingWebhook(false);
			}
		},
		[canManage, webhookConfig, showNotice, t]
	);

	const handleToggleNotifyOn = useCallback(
		(key: 'lockdown' | 'autoban' | 'honeypot' | 'fim' | 'loginAnomalies', val: boolean) => {
			setWebhookConfig((prev) => {
				const current = prev?.notifyOn || {
					lockdown: true,
					autoban: true,
					honeypot: true,
					fim: true,
					loginAnomalies: false,
				};
				return {
					...prev,
					notifyOn: {
						...current,
						[key]: val,
					},
				};
			});
		},
		[]
	);

	return {
		showLockdownModal,
		setShowLockdownModal,
		handleToggleLockdown,
		confirmLockdownToggle,
		handleToggleKillSwitch,
		webhookConfig,
		setWebhookConfig,
		showWebhookModal,
		setShowWebhookModal,
		showWebhookModalRef,
		isTestingWebhook,
		handleSaveWebhook,
		handleTestWebhook,
		handleToggleNotifyOn,
	};
}
