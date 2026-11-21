import type { EmergencyKillSwitches, WebhookConfig } from '../types';
import { postSocAction } from './sessionActions';

export async function executeResetDefcon() {
	return postSocAction({ action: 'reset_defcon' });
}

export async function executeToggleLockdown(enabled: boolean, reason?: string) {
	return postSocAction({ action: 'toggle_lockdown', enabled, reason });
}

export async function executeToggleKillSwitch(
	key: keyof EmergencyKillSwitches,
	value: boolean
) {
	return postSocAction({ action: 'toggle_kill_switch', key, value });
}

export async function executeSaveWebhook(config: WebhookConfig) {
	return postSocAction({ action: 'save_webhook', config });
}

export async function executeTestWebhook(config: WebhookConfig) {
	return postSocAction({ action: 'test_webhook', config });
}
