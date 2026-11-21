import { ensurePostgresInit, getPgPool } from '@/db';
import { decryptSecret, encryptSecret, isEncrypted } from '@/lib/auth/secretBox';
import { logSystemEvent } from '@/db/repositories/logs.repo';

export type WebhookProvider = 'discord' | 'telegram' | 'generic' | 'email';
export type AlertSeverity = 'INFO' | 'WARN' | 'HIGH' | 'CRITICAL';

export interface WebhookConfig {
	url?: string;
	webhookUrl?: string;
	provider: WebhookProvider;
	enabled: boolean;
	alertLevel?: AlertSeverity;
	minSeverity?: 'CRITICAL' | 'ERROR' | 'WARN';
	telegramChatId?: string;
	botToken?: string;
	chatId?: string;
	emailRecipients?: string;
	alsoSendEmail?: boolean;
	notifyOn?: {
		lockdown: boolean;
		autoban: boolean;
		honeypot: boolean;
		fim: boolean;
		loginAnomalies: boolean;
	};
}

export interface SecurityAlertEvent {
	type:
		| 'LOCKDOWN_DEFCON1'
		| 'HONEYPOT_TRIPPED'
		| 'IP_AUTOBANNED'
		| 'PASS_THE_COOKIE_HIJACK'
		| 'CRITICAL_FIM_WEBSHELL'
		| 'SECURITY_ALERT'
		| 'TEST_PING';
	severity: AlertSeverity;
	title: string;
	message?: string;
	description?: string;
	ip?: string;
	actorId?: string | null;
	details?: Record<string, unknown>;
	timestamp?: number;
}

const DEFAULT_NOTIFY_ON = {
	lockdown: true,
	autoban: true,
	honeypot: true,
	fim: true,
	loginAnomalies: false,
};

const DEFAULT_CONFIG: WebhookConfig = {
	url: process.env.SOC_WEBHOOK_URL || '',
	webhookUrl: process.env.SOC_WEBHOOK_URL || '',
	provider: (process.env.SOC_WEBHOOK_PROVIDER as WebhookProvider) || 'discord',
	enabled: Boolean(process.env.SOC_WEBHOOK_URL),
	alertLevel: 'WARN',
	minSeverity: 'WARN',
	botToken: '',
	chatId: '',
	emailRecipients: process.env.SOC_ALERT_EMAIL || '',
	alsoSendEmail: false,
	notifyOn: DEFAULT_NOTIFY_ON,
};

export const SEVERITY_WEIGHT: Record<AlertSeverity, number> = {
	INFO: 0,
	WARN: 1,
	HIGH: 2,
	CRITICAL: 3,
};

export function maskWebhookUrl(rawUrl: string | undefined): string {
	if (!rawUrl) return '';
	try {
		const parsed = new URL(rawUrl);
		const parts = parsed.pathname.split('/').filter(Boolean);
		if (parts.length >= 2) {
			parts[parts.length - 1] = '••••••••';
			parsed.pathname = '/' + parts.join('/');
		} else {
			parsed.pathname = '/••••••••';
		}
		parsed.search = '';
		return parsed.toString();
	} catch {
		return '••••••••';
	}
}

export function maskWebhookConfig(config: WebhookConfig): WebhookConfig {
	const maskedUrl = maskWebhookUrl(config.url || config.webhookUrl);
	return {
		...config,
		url: maskedUrl,
		webhookUrl: maskedUrl,
		botToken: config.botToken ? '••••••••' : '',
	};
}

/**
 * Retrieves the persisted Webhook configuration from PostgreSQL (decrypting secrets) or environment fallback.
 */
export async function getWebhookConfig(): Promise<WebhookConfig> {
	try {
		await ensurePostgresInit();
		const p = getPgPool();
		const res = await p.query(
			`SELECT value AS value FROM system_settings WHERE key = 'soc_webhook_config' LIMIT 1`
		);
		if (res.rows.length > 0 && res.rows[0].value) {
			const parsed = JSON.parse(res.rows[0].value) as Partial<WebhookConfig>;
			const rawStoredUrl = parsed.url || parsed.webhookUrl || '';
			const decryptedUrl = rawStoredUrl
				? (await decryptSecret(rawStoredUrl)) || ''
				: DEFAULT_CONFIG.url || '';
			const decryptedBotToken = parsed.botToken
				? (await decryptSecret(parsed.botToken)) || ''
				: '';
			return {
				...DEFAULT_CONFIG,
				...parsed,
				url: decryptedUrl,
				webhookUrl: decryptedUrl,
				botToken: decryptedBotToken,
				emailRecipients: parsed.emailRecipients || DEFAULT_CONFIG.emailRecipients,
				alsoSendEmail: Boolean(parsed.alsoSendEmail),
				notifyOn: {
					...DEFAULT_NOTIFY_ON,
					...(parsed.notifyOn || {}),
				},
			};
		}
	} catch {
		// Fallback to env
	}
	return {
		...DEFAULT_CONFIG,
		notifyOn: { ...DEFAULT_NOTIFY_ON },
	};
}

/**
 * Persists updated Webhook configuration into PostgreSQL with AES-256-GCM encrypted credentials.
 */
export async function saveWebhookConfig(config: WebhookConfig): Promise<boolean> {
	try {
		await ensurePostgresInit();
		const existing = await getWebhookConfig();
		const rawUrl = (config.url || config.webhookUrl || '').trim();
		const resolvedUrl =
			rawUrl.includes('••••••••') ? existing.url || '' : rawUrl;
		const rawBotToken = (config.botToken || '').trim();
		const resolvedBotToken =
			rawBotToken.includes('••••••••') ? existing.botToken || '' : rawBotToken;

		const encryptedUrl =
			resolvedUrl && !isEncrypted(resolvedUrl)
				? await encryptSecret(resolvedUrl)
				: resolvedUrl;
		const encryptedBotToken =
			resolvedBotToken && !isEncrypted(resolvedBotToken)
				? await encryptSecret(resolvedBotToken)
				: resolvedBotToken;

		const toStore: WebhookConfig = {
			...config,
			url: encryptedUrl,
			webhookUrl: encryptedUrl,
			botToken: encryptedBotToken,
		};

		const p = getPgPool();
		await p.query(
			`INSERT INTO system_settings (key, value, updated_at)
			 VALUES ('soc_webhook_config', $1, $2)
			 ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = $2`,
			[JSON.stringify(toStore), Date.now()]
		);
		return true;
	} catch (err) {
		await logSystemEvent({
			service: 'security',
			level: 'ERROR',
			message: `Failed to save webhook settings: ${err instanceof Error ? err.message : String(err)}`,
		}).catch(() => {});
		return false;
	}
}
