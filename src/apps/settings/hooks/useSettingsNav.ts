'use client';

import { useState } from 'react';
import { SETTINGS_SECTIONS, type SettingsTabId } from '@/configs/settings.config';
import { useSession } from '@/core/session';
import { useShell } from '@/core/shell';
import { useDialog } from '@/components/Common/DialogProvider';
import { useI18n } from '@/core/i18n';
import { useFocusTarget } from '@/lib/client/useFocusTarget';

export function useSettingsNav() {
	const { canManageApp, isAdmin } = useSession();
	const { resetWorkspaceSession } = useShell();
	const dialog = useDialog();
	const { t } = useI18n();

	const [selectedTab, setActiveTab] = useState<SettingsTabId>('account');
	const yonetici = canManageApp('settings');
	const visibleSections = SETTINGS_SECTIONS.filter((sec) => {
		if (sec.id === 'integrations' || sec.id === 'roles') return isAdmin;
		return !sec.sistem || yonetici;
	});
	const activeTab: SettingsTabId = visibleSections.some((sec) => sec.id === selectedTab) ? selectedTab : 'account';
	const [resetMessage, setResetMessage] = useState<string | null>(null);

	useFocusTarget('settings', {
		ready: true,
		apply: (target) => {
			const section = target.section;
			const tab: SettingsTabId | undefined =
				section === 'display' || section === 'sound'
					? 'appearance'
					: (section as SettingsTabId | undefined);
			if (tab && visibleSections.some((sec) => sec.id === tab)) setActiveTab(tab);
		},
	});

	const handleReset = async () => {
		const confirmed = await dialog.confirm({
			message: t('settingsResetConfirm'),
			tone: 'warning',
			confirmLabel: t('dlgReset'),
		});
		if (confirmed) {
			await resetWorkspaceSession();
			setResetMessage(t('settingsResetDone'));
			setTimeout(() => setResetMessage(null), 3000);
		}
	};

	return {
		visibleSections,
		activeTab,
		setActiveTab,
		resetMessage,
		handleReset,
		yonetici,
		isAdmin,
	};
}
