import { logSystemEvent } from '@/db/repositories/logs.repo';
import { validateWebhookTargetUrl } from '@/lib/mail/hosts';
import {
	getWebhookConfig,
	SEVERITY_WEIGHT,
	type SecurityAlertEvent,
	type WebhookConfig,
} from './config';
import { dispatchEmailAlert } from './emailAlert';

function escapeHtml(raw: string): string {
	return String(raw || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * Dispatches an external security alert to Discord, Telegram, Email, or generic webhook.
 * Non-blocking, fails safe with 4-second timeout and strict HTTPS + DNS SSRF validation.
 */
export async function sendSecurityAlert(
	event: SecurityAlertEvent,
	customConfig?: WebhookConfig
): Promise<boolean> {
	const stored = await getWebhookConfig();
	const config: WebhookConfig = customConfig
		? {
				...stored,
				...customConfig,
				url:
					(customConfig.url || customConfig.webhookUrl || '').includes('••••••••')
						? stored.url
						: customConfig.url || customConfig.webhookUrl || stored.url,
				botToken:
					(customConfig.botToken || '').includes('••••••••')
						? stored.botToken
						: customConfig.botToken || stored.botToken,
			}
		: stored;

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

	if (config.provider === 'email') {
		return await dispatchEmailAlert(config, event);
	}

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
					? 0xff2d55
					: event.severity === 'HIGH'
						? 0xff9500
						: 0x0a84ff;

			const fields = [
				...(event.ip ? [{ name: '🌐 Source IP', value: `\`${event.ip}\``, inline: true }] : []),
				{ name: '⚠️ Severity', value: `**${event.severity}**`, inline: true },
				{ name: '🕒 Time', value: `<t:${Math.floor(ts / 1000)}:R>`, inline: true },
			];

			if (event.details && Object.keys(event.details).length > 0) {
				fields.push({
					name: '🔍 Technical Details',
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
						title: `🛡️ [SoC ALERT] ${event.title}`,
						description: msg,
						color,
						fields,
						footer: { text: 'Orbit Community OS • Autonomous Defense' },
						timestamp: isoTime,
					},
				],
			});
		} else if (config.provider === 'telegram') {
			const msg = escapeHtml(event.message || event.description || '');
			const safeTitle = escapeHtml(event.title);
			const safeSeverity = escapeHtml(event.severity);
			const safeIp = event.ip ? escapeHtml(event.ip) : '';
			const text = [
				`🛡️ <b>[SoC ALERT] ${safeTitle}</b>`,
				`⚠️ <b>Severity:</b> ${safeSeverity}`,
				safeIp ? `🌐 <b>IP:</b> <code>${safeIp}</code>` : '',
				`💬 <b>Message:</b> ${msg}`,
				`🕒 <b>Time:</b> ${isoTime}`,
			]
				.filter(Boolean)
				.join('\n');

			body = JSON.stringify({
				chat_id: config.chatId || config.telegramChatId || '',
				text,
				parse_mode: 'HTML',
			});
		} else {
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
			if (!/^[0-9]{6,12}:[A-Za-z0-9_-]{25,60}$/.test(token)) {
				return false;
			}
			targetUrl = `https://api.telegram.org/bot${token}/sendMessage`;
		}
		if (!targetUrl) return false;

		const urlValidation = await validateWebhookTargetUrl(targetUrl);
		if (!urlValidation.ok) {
			await logSystemEvent({
				service: 'security',
				level: 'WARN',
				message: `[WEBHOOK BLOCKED] Outbound webhook URL rejected by SSRF guard: ${urlValidation.error}`,
			}).catch(() => {});
			return false;
		}

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 4000);

		const res = await fetch(targetUrl, {
			method: 'POST',
			headers,
			body,
			redirect: 'error',
			signal: controller.signal,
		});

		clearTimeout(timer);
		return res.ok;
	} catch (err) {
		await logSystemEvent({
			service: 'security',
			level: 'WARN',
			message: `⚠️ [WEBHOOK FAILED] Failed to deliver alert: ${err instanceof Error ? err.message : String(err)}`,
		}).catch(() => {});
		return false;
	}
}
