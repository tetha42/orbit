import { logSystemEvent } from '@/db/repositories/logs.repo';
import { sendMail } from '@/lib/mail/mailer';
import type { SecurityAlertEvent, WebhookConfig } from './config';

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

/**
 * Formats and sends an email security alert to configured recipients.
 */
export async function dispatchEmailAlert(
	config: WebhookConfig,
	event: SecurityAlertEvent
): Promise<boolean> {
	const recipients = (config.emailRecipients || '').trim();
	if (!recipients) return false;

	const ts = event.timestamp || Date.now();
	const timeStr = `${new Date(ts).toLocaleString('en-US', { timeZone: 'UTC' })} UTC`;
	const severityColor =
		event.severity === 'CRITICAL' ? '#ff453a' : event.severity === 'HIGH' ? '#ff9f0a' : '#0a84ff';

	const subject = `🛡️ [SoC ALERT - ${event.severity}] ${event.title}`;
	const msg = event.message || event.description || 'Security event detected.';

	const detailsHtml =
		event.details && Object.keys(event.details).length > 0
			? `<div style="margin-top: 16px; padding: 12px; background: #1c1c1e; border: 1px solid #2c2c2e; ` +
				`border-radius: 8px; font-family: monospace; font-size: 12px; color: #32d74b; overflow-x: auto;">
				<strong style="color: #98989d;">Forensic / Technical Details:</strong><br/>
				<pre style="margin: 8px 0 0 0; white-space: pre-wrap; font-family: inherit;">${escapeHtml(
					JSON.stringify(event.details, null, 2).slice(0, 1000)
				)}</pre>
			   </div>`
			: '';

	const html = `
		<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #2c2c2e;
			border-radius: 12px; background: #000000; color: #ffffff;">
			<div style="display: flex; align-items: center; justify-content: space-between;
				border-bottom: 1px solid #2c2c2e; padding-bottom: 14px; margin-bottom: 16px;">
				<h2 style="color: #0a84ff; margin: 0; font-size: 18px; font-weight: 700;">🛡️ Orbit Cyber Defense (SoC)</h2>
				<span style="background: ${severityColor}22; color: ${severityColor};
					border: 1px solid ${severityColor}66; padding: 4px 10px; border-radius: 6px;
					font-size: 11px; font-weight: 700; text-transform: uppercase;">
					${event.severity}
				</span>
			</div>
			<h3 style="color: #ffffff; margin: 0 0 12px 0; font-size: 16px;">${escapeHtml(event.title)}</h3>
			<p style="font-size: 14px; line-height: 1.6; color: #e5e5e7; margin: 0 0 16px 0;">${escapeHtml(msg)}</p>
			<table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px;">
				${
					event.ip
						? '<tr><td style="padding: 6px 0; color: #8e8e93; width: 120px;">Source IP:</td>' +
							`<td style="padding: 6px 0; color: #ffffff; font-family: monospace;"><code>${escapeHtml(event.ip)}</code></td></tr>`
						: ''
				}
				<tr><td style="padding: 6px 0; color: #8e8e93;">Event Type:</td><td style="padding: 6px 0; color: #ffffff; font-family: monospace;">${escapeHtml(event.type)}</td></tr>
				<tr><td style="padding: 6px 0; color: #8e8e93;">Time:</td><td style="padding: 6px 0; color: #ffffff;">${timeStr}</td></tr>
			</table>
			${detailsHtml}
			<div style="border-top: 1px solid #2c2c2e; padding-top: 16px; margin-top: 24px; font-size: 11px; color: #636366; text-align: center;">
				This email was sent by the Orbit Community OS (SoC) autonomous defense engine.
			</div>
		</div>
	`;

	const text = `[SoC SECURITY ALERT - ${event.severity}]\n${event.title}\n\n${msg}\n\nIP: ${event.ip || 'Not specified'}\nTime: ${timeStr}\nType: ${event.type}`;

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
			service: 'security',
			level: 'WARN',
			message: `⚠️ [MAIL ALERT FAILED] Failed to deliver email alert: ${err instanceof Error ? err.message : String(err)}`,
		}).catch(() => {});
		return false;
	}
}
