import type { SettingsTabId } from '@/configs/settings.config';

export type { SettingsTabId };

export interface SettingsSection {
	id: SettingsTabId;
	labelKey: string;
	group: 'personal' | 'account' | 'system';
	system?: boolean;
}
