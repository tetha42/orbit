import { NextResponse } from 'next/server';
import {
	setLockdownState,
	revokeUserSession,
	revokeAllNonAdminSessions,
	revokeAnomalousSessions,
	suspendUserAccount,
	setEmergencyKillSwitch,
	resetDefconBaseline,
	updateSocIncident,
	createSocIncident,
	type EmergencyKillSwitches,
} from '@/db/repositories/security.repo';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { validateWebhookTargetUrl } from '@/lib/mail/hosts';
import {
	maskWebhookConfig,
	saveWebhookConfig,
	sendSecurityAlert,
	type WebhookConfig,
} from '@/server/security/securityWebhook';

interface SocActor {
	id: string;
	email: string;
}

export async function handleSocSecurityAction(
	action: string,
	body: Record<string, unknown>,
	actor: SocActor,
	callerIp: string
): Promise<NextResponse | null> {
	if (action === 'toggle_lockdown') {
		const enabled = Boolean(body.enabled);
		const reason = body.reason ? String(body.reason).trim() : undefined;
		const state = await setLockdownState({
			active: enabled,
			reason,
			actorId: actor.id,
			ip: callerIp,
		});
		return NextResponse.json({ ok: true, lockdown: state });
	}

	if (action === 'kill_session') {
		const userId = String(body.userId || '').trim();
		if (!userId) {
			return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
		}
		if (userId === actor.id) {
			return NextResponse.json(
				{ error: 'You cannot terminate your own active session from SoC.' },
				{ status: 400 }
			);
		}
		const revoked = await revokeUserSession({
			targetUserId: userId,
			actorId: actor.id,
			ip: callerIp,
		});
		return NextResponse.json({ ok: true, revoked });
	}

	if (action === 'kill_all_sessions') {
		const droppedCount = await revokeAllNonAdminSessions({
			actorId: actor.id,
			ip: callerIp,
		});
		return NextResponse.json({ ok: true, droppedCount });
	}

	if (action === 'revoke_anomalies') {
		const droppedCount = await revokeAnomalousSessions({
			actorId: actor.id,
			ip: callerIp,
		});
		return NextResponse.json({ ok: true, droppedCount });
	}

	if (action === 'suspend_user') {
		const userId = String(body.userId || '').trim();
		if (!userId) {
			return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
		}
		const res = await suspendUserAccount({
			targetUserId: userId,
			actorId: actor.id,
			ip: callerIp,
		});
		if (!res.ok) {
			return NextResponse.json({ error: res.error || 'Could not suspend user.' }, { status: 400 });
		}
		return NextResponse.json({ ok: true });
	}

	if (action === 'toggle_kill_switch') {
		const key = String(body.key || '') as keyof EmergencyKillSwitches;
		const validKeys: Array<keyof EmergencyKillSwitches> = ['disableRegistrations', 'disableUploads', 'passkeyOnly'];
		if (!validKeys.includes(key)) {
			return NextResponse.json({ error: 'Invalid emergency kill-switch key.' }, { status: 400 });
		}
		const value = Boolean(body.value);
		const updated = await setEmergencyKillSwitch(key, value, actor.id);
		return NextResponse.json({ ok: true, emergencySwitches: updated });
	}

	if (action === 'save_webhook') {
		const config = body.config as WebhookConfig;
		if (!config || typeof config !== 'object') {
			return NextResponse.json({ error: 'Invalid webhook configuration.' }, { status: 400 });
		}
		const rawUrl = (config.url || config.webhookUrl || '').trim();
		if (
			rawUrl &&
			!rawUrl.includes('••••••••') &&
			config.provider !== 'telegram' &&
			config.provider !== 'email'
		) {
			const check = await validateWebhookTargetUrl(rawUrl);
			if (!check.ok) {
				return NextResponse.json({ error: check.error || 'Invalid webhook URL.' }, { status: 400 });
			}
		}
		await saveWebhookConfig(config);
		await logSystemEvent({
			service: 'security',
			level: 'INFO',
			message: `[WEBHOOK UPDATED] Security alert webhook settings updated (${config.provider || 'none'}).`,
			detail: { provider: config.provider, enabled: config.enabled },
			userId: actor.id,
			ip: callerIp,
		});
		return NextResponse.json({ ok: true, config: maskWebhookConfig(config) });
	}

	if (action === 'test_webhook') {
		const overrideConfig =
			body.config && typeof body.config === 'object' ? (body.config as WebhookConfig) : undefined;
		const sent = await sendSecurityAlert(
			{
				type: 'TEST_PING',
				title: 'Test Security Alert (SoC Test)',
				description: 'This message is a test security notification triggered from the SoC console.',
				severity: 'INFO',
				ip: callerIp,
				details: { admin: actor.email, timestamp: new Date().toISOString() },
			},
			overrideConfig
		);
		return NextResponse.json({ ok: true, sent });
	}

	if (action === 'update_incident') {
		const id = String(body.id || '').trim();
		if (!id) {
			return NextResponse.json({ error: 'Incident ID is required.' }, { status: 400 });
		}
		const ok = await updateSocIncident(id, {
			status: body.status as Parameters<typeof updateSocIncident>[1]['status'],
			analystNotes: body.analystNotes as Parameters<typeof updateSocIncident>[1]['analystNotes'],
			assignedTo: body.assignedTo as Parameters<typeof updateSocIncident>[1]['assignedTo'],
		});
		return NextResponse.json({ ok });
	}

	if (action === 'create_incident') {
		const inc = await createSocIncident({
			title: String(body.title || 'Security Incident'),
			severity: (body.severity as Parameters<typeof createSocIncident>[0]['severity']) || 'HIGH',
			sourceIp: (body.sourceIp as string | null) || null,
			service: (body.service as string) || 'security',
			details: (body.details as Record<string, unknown> | null) || null,
			analystNotes: (body.analystNotes as string | null) || null,
			assignedTo: actor.id,
		});
		return NextResponse.json({ ok: true, incident: inc });
	}

	if (action === 'reset_defcon') {
		const res = await resetDefconBaseline({
			actorId: actor.id,
			actorIp: callerIp,
		});
		return NextResponse.json({
			ok: true,
			defcon: 5,
			message: 'DEFCON alert counter has been reset to peacetime (DEFCON 5).',
			resetAt: res.resetAt,
		});
	}

	return null;
}
