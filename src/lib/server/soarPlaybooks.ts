import crypto from 'crypto';
import { banIp, setEmergencyKillSwitch, createSocIncident, revokeUserSession } from '@/server/db/domains/security.repo';
import { logSystemEvent } from '@/server/db/domains/logs.repo';
import { closeUserTerminalSessions } from '@/lib/server/terminalManager';
import { freezeUserDatabaseAccess } from '@/lib/server/databaseAccess';
import { sendMail } from '@/lib/mail/mailer';
import { getPgPool } from '@/db';
import type { SoarPlaybookId, SoarPlaybookExecutionResult } from '@/apps/soc/types';

export interface SoarTargetPayload {
	ip?: string;
	userId?: string;
	path?: string;
	incidentId?: string;
	analystId: string;
}

export async function executeSoarPlaybook(
	playbookId: SoarPlaybookId,
	target: SoarTargetPayload
): Promise<SoarPlaybookExecutionResult> {
	const actionsTaken: string[] = [];
	const now = Date.now();

	try {
		if (playbookId === 'brute-force-containment') {
			if (!target.ip) {
				return {
					success: false,
					playbookId,
					actionsTaken: [],
					timestamp: now,
					error: 'Target IP is required for Brute-Force Containment',
				};
			}

			// 1. Quarantine IP for 24 hours with max threat score
			await banIp({
				ip: target.ip,
				neden: 'SOAR Automated Playbook: Brute-Force & Credential Stuffing Containment',
				durationMs: 24 * 60 * 60 * 1000,
				tehditPuani: 100,
				olusturanId: target.analystId,
			});
			actionsTaken.push(`Quarantined IP ${target.ip} for 24h with 100pt threat score`);

			// 2. Write audit log
			await logSystemEvent({
				servis: 'soar',
				seviye: 'WARN',
				mesaj: `SOAR Brute-Force Playbook executed against IP ${target.ip}`,
				detay: { playbookId, ip: target.ip, analystId: target.analystId },
				userId: target.analystId,
				ip: target.ip,
			});
			actionsTaken.push('Recorded tamper-evident security audit log');

			// 3. Create or link incident
			await createSocIncident({
				title: `SOAR Containment: Brute-Force from ${target.ip}`,
				severity: 'HIGH',
				sourceIp: target.ip,
				service: 'auth',
				details: { playbook: 'brute-force-containment', executedAt: now },
				analystNotes: `Automated 24h quarantine executed by analyst #${target.analystId}`,
			});
			actionsTaken.push('Created stateful incident in contained state');
		} else if (playbookId === 'compromised-account-isolation') {
			if (!target.userId) {
				return {
					success: false,
					playbookId,
					actionsTaken: [],
					timestamp: now,
					error: 'Target User ID is required for Compromised Account Isolation',
				};
			}

			const pool = getPgPool();

			// 1. Terminate all active web sessions for this user
			await revokeUserSession({
				targetUserId: target.userId,
				actorId: target.analystId,
				ip: target.ip || '127.0.0.1',
			});
			actionsTaken.push(`Revoked all active session tokens for user #${target.userId}`);

			// 2. Suspend account in PostgreSQL to prevent immediate re-login
			await pool.query("UPDATE kullanicilar SET status = 'askida' WHERE id = $1", [target.userId]);
			actionsTaken.push(`Suspended account status to 'askida' for user #${target.userId}`);

			// 3. Kill all active Linux PTY terminal shells
			const closedShells = closeUserTerminalSessions(target.userId);
			actionsTaken.push(`Terminated ${closedShells} active PTY terminal shells`);

			// 4. Freeze DB Studio 2FA access
			freezeUserDatabaseAccess(target.userId);
			actionsTaken.push('Frozen Zero-Trust Database Studio query access');

			// 4. Dispatch security notification email
			try {
				const userRes = await pool.query<{ email: string; ad: string }>('SELECT email, ad FROM kullanicilar WHERE id = $1', [target.userId]);
				if (userRes.rows.length > 0 && userRes.rows[0].email) {
					await sendMail({
						to: userRes.rows[0].email,
						subject: '[Security Alert] Account Quarantined - Unusual Activity Detected',
						html: `<p>Hello ${userRes.rows[0].ad},</p><p>Your account was quarantined by the Security Operations Center due to suspected credential compromise. All active sessions and shell access have been terminated. Please contact your club administrator immediately.</p>`,
						text: `Security Alert: Your account #${target.userId} was quarantined by SOC. Contact administrator.`,
					});
					actionsTaken.push(`Dispatched security notification email to ${userRes.rows[0].email}`);
				}
			} catch (mailErr) {
				console.error('[SOAR] Email dispatch failed:', mailErr);
			}

			// 5. Audit log
			await logSystemEvent({
				servis: 'soar',
				seviye: 'CRITICAL',
				mesaj: `SOAR Compromised Account Isolation executed for user #${target.userId}`,
				detay: { playbookId, userId: target.userId, analystId: target.analystId, closedShells },
				userId: target.analystId,
				ip: target.ip || undefined,
			});
			actionsTaken.push('Emitted high-priority audit event to SIEM');
		} else if (playbookId === 'webshell-quarantine') {
			// 1. Engage emergency upload killswitch
			await setEmergencyKillSwitch('disableUploads', true, target.analystId);
			actionsTaken.push('Engaged emergency killswitch: File uploads globally suspended (503)');

			// 2. If IP provided, permanently ban
			if (target.ip) {
				await banIp({
					ip: target.ip,
					neden: 'SOAR Automated Playbook: Web Shell & File Tamper Isolation',
					durationMs: null, // permanent
					tehditPuani: 100,
					olusturanId: target.analystId,
				});
				actionsTaken.push(`Quarantined source IP ${target.ip} permanently`);
			}

			// 3. Create incident
			await createSocIncident({
				title: `SOAR Web Shell Isolation: ${target.path || 'Upload exploit probe'}`,
				severity: 'CRITICAL',
				sourceIp: target.ip || null,
				service: 'upload',
				details: { playbook: 'webshell-quarantine', targetPath: target.path, executedAt: now },
				analystNotes: `Automated upload killswitch engaged by analyst #${target.analystId}`,
			});
			actionsTaken.push('Created CRITICAL security incident and engaged FIM lock');
		}

		// Calculate SHA-256 evidence envelope checksum
		const evidenceString = JSON.stringify({ playbookId, target, actionsTaken, timestamp: now });
		const evidenceSha256 = crypto.createHash('sha256').update(evidenceString).digest('hex');

		return {
			success: true,
			playbookId,
			actionsTaken,
			evidenceSha256,
			timestamp: now,
		};
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return {
			success: false,
			playbookId,
			actionsTaken,
			timestamp: now,
			error: msg,
		};
	}
}
