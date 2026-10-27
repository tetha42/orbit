import type { SettingsTabId } from '@/configs/settings.config';

export type { SettingsTabId };

export interface SettingsSection {
	id: SettingsTabId;
	labelKey: string;
	group: 'kisisel' | 'hesap' | 'sistem';
	sistem?: boolean;
}
