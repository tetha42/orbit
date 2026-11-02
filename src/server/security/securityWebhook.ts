import { ensurePostgresInit, getPgPool } from '@/db';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { sendMail } from '@/lib/mail/mailer';

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

const SEVERITY_WEIGHT: Record<AlertSeverity, number> = {
	INFO: 0,
	WARN: 1,
	HIGH: 2,
	CRITICAL: 3,
};

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

/**
 * Retrieves the persisted Webhook configuration from PostgreSQL or environment fallback.
 */
export async function getWebhookConfig(): Promise<WebhookConfig> {
	try {
		await ensurePostgresInit();
		const p = getPgPool();
		const res = await p.query(
			`SELECT value AS deger FROM system_settings WHERE key = 'soc_webhook_config' LIMIT 1`
		);
		if (res.rows.length > 0 && res.rows[0].deger) {
			const parsed = JSON.parse(res.rows[0].deger) as Partial<WebhookConfig>;
			const url = parsed.url || parsed.webhookUrl || DEFAULT_CONFIG.url || '';
			return {
				...DEFAULT_CONFIG,
				...parsed,
				url,
				webhookUrl: url,
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
 * Persists updated Webhook configuration into PostgreSQL.
 */
export async function saveWebhookConfig(config: WebhookConfig): Promise<boolean> {
	try {
		await ensurePostgresInit();
		const p = getPgPool();
		await p.query(
			`INSERT INTO system_settings (key, value, updated_at)
			 VALUES ('soc_webhook_config', $1, $2)
			 ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = $2`,
			[JSON.stringify(config), Date.now()]
		);
		return true;
	} catch (err) {
		await logSystemEvent({
			servis: 'security',
			seviye: 'ERROR',
			mesaj: `Webhook ayarları kaydedilemedi: ${err instanceof Error ? err.message : String(err)}`,
		}).catch(() => {});
		return false;
	}
}

/**
 * Formats and sends an email security alert to configured recipients.
 */
async function dispatchEmailAlert(config: WebhookConfig, event: SecurityAlertEvent): Promise<boolean> {
	const recipients = (config.emailRecipients || '').trim();
	if (!recipients) return false;

	const ts = event.timestamp || Date.now();
	const timeStr = new Date(ts).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
	const severityColor =
		event.severity === 'CRITICAL' ? '#ff453a' : event.severity === 'HIGH' ? '#ff9f0a' : '#0a84ff';

	const subject = `🛡️ [SoC ALARM - ${event.severity}] ${event.title}`;
	const msg = event.message || event.description || 'Güvenlik olayı tespit edildi.';

	const detailsHtml =
		event.details && Object.keys(event.details).length > 0
			? `<div style="margin-top: 16px; padding: 12px; background: #1c1c1e; border: 1px solid #2c2c2e; border-radius: 8px; font-family: monospace; font-size: 12px; color: #32d74b; overflow-x: auto;">
				<strong style="color: #98989d;">Adli / Teknik Detay:</strong><br/>
				<pre style="margin: 8px 0 0 0; white-space: pre-wrap; font-family: inherit;">${escapeHtml(JSON.stringify(event.details, null, 2).slice(0, 1000))}</pre>
			   </div>`
			: '';

	const html = `
		<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #2c2c2e; border-radius: 12px; background: #000000; color: #ffffff;">
			<div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #2c2c2e; padding-bottom: 14px; margin-bottom: 16px;">
				<h2 style="color: #0a84ff; margin: 0; font-size: 18px; font-weight: 700;">🛡️ Orbit Siber Savunma (SoC)</h2>
				<span style="background: ${severityColor}22; color: ${severityColor}; border: 1px solid ${severityColor}66; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase;">
					${event.severity}
				</span>
			</div>
			<h3 style="color: #ffffff; margin: 0 0 12px 0; font-size: 16px;">${escapeHtml(event.title)}</h3>
			<p style="font-size: 14px; line-height: 1.6; color: #e5e5e7; margin: 0 0 16px 0;">${escapeHtml(msg)}</p>
			<table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px;">
				${event.ip ? `<tr><td style="padding: 6px 0; color: #8e8e93; width: 120px;">Kaynak IP:</td><td style="padding: 6px 0; color: #ffffff; font-family: monospace;"><code>${escapeHtml(event.ip)}</code></td></tr>` : ''}
				<tr><td style="padding: 6px 0; color: #8e8e93;">AppEvent Türü:</td><td style="padding: 6px 0; color: #ffffff; font-family: monospace;">${escapeHtml(event.type)}</td></tr>
				<tr><td style="padding: 6px 0; color: #8e8e93;">Zaman:</td><td style="padding: 6px 0; color: #ffffff;">${timeStr}</td></tr>
			</table>
			${detailsHtml}
			<div style="border-top: 1px solid #2c2c2e; padding-top: 16px; margin-top: 24px; font-size: 11px; color: #636366; text-align: center;">
				Bu e-posta Orbit Community OS (SoC) otonom savunma motoru tarafından iletilmiştir.
			</div>
		</div>
	`;

	const text = `[SoC GÜVENLİK ALARMI - ${event.severity}]\n${event.title}\n\n${msg}\n\nIP: ${event.ip || 'Belirtilmedi'}\nZaman: ${timeStr}\nTür: ${event.type}`;

	try {
		const res = await sendMail({
			to: recipients,
			subject,
			html,
			text,
		});
		return res.success;
	} catch (err) {
		await logSystemEvent({
			servis: 'security',
			seviye: 'WARN',
			mesaj: `⚠️ [MAIL ALARM FAILED] E-posta alarmı iletilemedi: ${err instanceof Error ? err.message : String(err)}`,
		}).catch(() => {});
		return false;
	}
}

/**
 * Dispatches an external security alert to Discord, Telegram, Email, or generic webhook.
 * Non-blocking, fails safe with 4-second timeout.
 */
export async function sendSecurityAlert(
	event: SecurityAlertEvent,
	customConfig?: WebhookConfig
): Promise<boolean> {
	const config = customConfig || (await getWebhookConfig());
	if (!config.enabled) {
		return false;
	}

	const effectiveUrl = config.url || config.webhookUrl;
	if (config.provider === 'telegram') {
		if (!config.botToken || (!config.chatId && !config.telegramChatId)) {
			return false;
		}
	} else if (config.provider === 'email') {
		if (!config.emailRecipients) {
			return false;
		}
	} else if (!effectiveUrl) {
		return false;
	}

	// Check severity threshold (bypass for TEST_PING)
	const effectiveAlertLevel =
		config.alertLevel ||
		(config.minSeverity === 'CRITICAL' ? 'CRITICAL' : config.minSeverity === 'ERROR' ? 'HIGH' : 'WARN');
	if (event.type !== 'TEST_PING' && SEVERITY_WEIGHT[event.severity] < SEVERITY_WEIGHT[effectiveAlertLevel]) {
		return false;
	}

	// If primary provider is email
	if (config.provider === 'email') {
		return await dispatchEmailAlert(config, event);
	}

	// If secondary email alerts are enabled, dispatch email in background
	if (config.alsoSendEmail && config.emailRecipients) {
		dispatchEmailAlert(config, event).catch(() => {});
	}

	const ts = event.timestamp || Date.now();
	const isoTime = new Date(ts).toISOString();

	try {
		let body: BodyInit;
		const headers: Record<string, string> = { 'Content-Type': 'application/json' };

		if (config.provider === 'discord') {
			const color =
				event.severity === 'CRITICAL'
					? 0xff2d55 // Red
					: event.severity === 'HIGH'
						? 0xff9500 // Orange
						: 0x0a84ff; // Blue

			const fields = [
				...(event.ip ? [{ name: '🌐 Kaynak IP', value: `\`${event.ip}\``, inline: true }] : []),
				{ name: '⚠️ Seviye', value: `**${event.severity}**`, inline: true },
				{ name: '🕒 Zaman', value: `<t:${Math.floor(ts / 1000)}:R>`, inline: true },
			];

			if (event.details && Object.keys(event.details).length > 0) {
				fields.push({
					name: '🔍 Teknik Detay',
					value: `\`\`\`json\n${JSON.stringify(event.details, null, 2).slice(0, 800)}\n\`\`\``,
					inline: false,
				});
			}

			const msg = event.message || event.description || '';
			body = JSON.stringify({
				username: 'Orbit SOC',
				avatar_url: 'https://orbit.local/favicon.ico',
				embeds: [
					{
						title: `🛡️ [SoC ALARM] ${event.title}`,
						description: msg,
						color,
						fields,
						footer: { text: 'Orbit Community OS • Autonomous Defense' },
						timestamp: isoTime,
					},
				],
			});
		} else if (config.provider === 'telegram') {
			const msg = event.message || event.description || '';
			const text = [
				`🛡️ <b>[SoC ALARM] ${event.title}</b>`,
				`⚠️ <b>Seviye:</b> ${event.severity}`,
				event.ip ? `🌐 <b>IP:</b> <code>${event.ip}</code>` : '',
				`💬 <b>Mesaj:</b> ${msg}`,
				`🕒 <b>Zaman:</b> ${isoTime}`,
			]
				.filter(Boolean)
				.join('\n');

			body = JSON.stringify({
				chat_id: config.chatId || config.telegramChatId || '',
				text,
				parse_mode: 'HTML',
			});
		} else {
			// Generic JSON
			const msg = event.message || event.description || '';
			body = JSON.stringify({
				event: event.type,
				severity: event.severity,
				title: event.title,
				message: msg,
				ip: event.ip,
				details: event.details,
				timestamp: ts,
			});
		}

		let targetUrl = config.url || config.webhookUrl || '';
		if (config.provider === 'telegram') {
			const token = config.botToken || '';
			if (token) {
				targetUrl = `https://api.telegram.org/bot${token}/sendMessage`;
			}
		}
		if (!targetUrl) return false;

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 4000);

		const res = await fetch(targetUrl, {
			method: 'POST',
			headers,
			body,
			signal: controller.signal,
		});

		clearTimeout(timer);
		return res.ok;
	} catch (err) {
		await logSystemEvent({
			servis: 'security',
			seviye: 'WARN',
			mesaj: `⚠️ [WEBHOOK FAILED] Alarm iletilemedi: ${err instanceof Error ? err.message : String(err)}`,
		}).catch(() => {});
		return false;
	}
}
