import { ensurePostgresInit, getPgPool } from '@/db';
import { classifyThreatIntel } from '@/server/security/threatIntelligence';
import { getWebhookConfig, maskWebhookConfig } from '@/server/security/securityWebhook';
import { getActiveRateLimits } from '@/lib/rateLimit';
import { getSecurityBlocks } from './blocks';
import { getLiveThreatScore } from './strikes';
import { getDefconResetAt, getEmergencyKillSwitches, getLockdownState } from './lockdown';
import { getHostAndPoolTelemetry } from './telemetry';
import type { SocOverviewData, TopAttackerItem } from './types';

export * from './telemetry';

export async function getSocDefconSummary(): Promise<{
	defcon: 1 | 2 | 3 | 4 | 5;
	lockdown: SocOverviewData['lockdown'];
}> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const now = Date.now();
	const since24h = now - 24 * 60 * 60_000;
	const [lockdown, defconResetAt, blocks] = await Promise.all([
		getLockdownState(),
		getDefconResetAt(),
		getSecurityBlocks(),
	]);
	if (lockdown.active) {
		return { defcon: 1, lockdown };
	}
	const effectiveSince = Math.max(since24h, defconResetAt);
	const statsRes = await pool.query(
		`SELECT
			COUNT(*) FILTER (WHERE service = 'security' AND level IN ('WARN', 'ERROR', 'CRITICAL'))::int AS "secEvents",
			COUNT(*) FILTER (WHERE service = 'auth' AND level IN ('WARN', 'ERROR', 'CRITICAL'))::int AS "authFailures",
			COUNT(*) FILTER (WHERE service = 'security' AND message ILIKE '%Session IP%')::int AS "sessionAnomalies",
			COUNT(*) FILTER (WHERE level = 'CRITICAL')::int AS "criticalEvents"
		 FROM system_logs
		 WHERE timestamp >= $1
		   AND ip NOT IN ('127.0.0.1', '::1', 'localhost', 'unknown')`,
		[effectiveSince]
	);
	const newActiveBansCount = blocks.filter(
		(e) =>
			e.status === 'ban' &&
			(!defconResetAt || e.creation >= defconResetAt) &&
			e.ip !== '127.0.0.1' &&
			e.ip !== '::1' &&
			e.ip !== 'localhost'
	).length;
	const st = statsRes.rows[0] || {};
	const securityEvents24h = Number(st.secEvents ?? 0);
	const authFailures24h = Number(st.authFailures ?? 0);
	const sessionAnomalies24h = Number(st.sessionAnomalies ?? 0);
	const criticalEvents24h = Number(st.criticalEvents ?? 0);

	let defcon: 1 | 2 | 3 | 4 | 5 = 5;
	if (criticalEvents24h >= 1 || newActiveBansCount >= 3 || securityEvents24h >= 40) {
		defcon = 2;
	} else if (newActiveBansCount >= 1 || securityEvents24h >= 15 || sessionAnomalies24h >= 1) {
		defcon = 3;
	} else if (authFailures24h >= 5 || securityEvents24h >= 3) {
		defcon = 4;
	}
	return { defcon, lockdown };
}

export async function getSocOverview(): Promise<SocOverviewData> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const now = Date.now();
	const since24h = now - 24 * 60 * 60_000;
	const defconResetAt = await getDefconResetAt();
	const effectiveSince = Math.max(since24h, defconResetAt);

	const [
		lockdown,
		blocks,
		statsRes,
		attackersRes,
		sessionsRes,
		emergencySwitches,
		webhookConfig,
	] = await Promise.all([
		getLockdownState(),
		getSecurityBlocks(),
		pool.query(
			`SELECT
				COUNT(*) FILTER (WHERE service = 'security' AND level IN ('WARN', 'ERROR', 'CRITICAL'))::int AS "secEvents",
				COUNT(*) FILTER (WHERE service = 'auth' AND level IN ('WARN', 'ERROR', 'CRITICAL'))::int AS "authFailures",
				COUNT(*) FILTER (
					WHERE service = 'security' AND (
						message ILIKE '%CSRF%' OR message ILIKE '%IDOR%' OR
						message ILIKE '%Unauthorized%' OR message ILIKE '%WAF%' OR
						message ILIKE '%Honeypot%' OR message ILIKE '%FIM%'
					)
				)::int AS "csrfIdor",
				COUNT(*) FILTER (WHERE service = 'security' AND message ILIKE '%Session IP%')::int AS "sessionAnomalies",
				COUNT(*) FILTER (WHERE level = 'CRITICAL')::int AS "criticalEvents"
			 FROM system_logs
			 WHERE timestamp >= $1
			   AND ip NOT IN ('127.0.0.1', '::1', 'localhost', 'unknown')`,
			[effectiveSince]
		),
		pool.query(
			`SELECT
				ip,
				COUNT(*)::int AS "eventCount",
				MAX(timestamp) AS "lastSeen",
				(ARRAY_AGG(message ORDER BY timestamp DESC))[1] AS "lastMessage"
			 FROM system_logs
			 WHERE timestamp >= $1
			   AND level IN ('WARN', 'ERROR', 'CRITICAL')
			   AND ip IS NOT NULL
			   AND ip <> ''
			   AND ip <> 'unknown'
			 GROUP BY ip
			 ORDER BY COUNT(*) DESC, MAX(timestamp) DESC
			 LIMIT 12`,
			[since24h]
		),
		pool.query(
			`SELECT COUNT(*)::int AS n FROM users WHERE session_token IS NOT NULL AND (session_expires_at IS NULL OR session_expires_at > $1)`,
			[now]
		),
		getEmergencyKillSwitches(),
		getWebhookConfig(),
	]);

	const activeBansCount = blocks.filter((e) => e.status === 'ban').length;
	const whitelistedCount = blocks.filter((e) => e.status === 'whitelist').length;

	const newActiveBansCount = blocks.filter(
		(e) =>
			e.status === 'ban' &&
			(!defconResetAt || e.creation >= defconResetAt) &&
			e.ip !== '127.0.0.1' &&
			e.ip !== '::1' &&
			e.ip !== 'localhost'
	).length;

	const st = statsRes.rows[0] || {};
	const securityEvents24h = Number(st.secEvents ?? 0);
	const authFailures24h = Number(st.authFailures ?? 0);
	const csrfAndIdor24h = Number(st.csrfIdor ?? 0);
	const sessionAnomalies24h = Number(st.sessionAnomalies ?? 0);
	const criticalEvents24h = Number(st.criticalEvents ?? 0);
	const activeSessionsCount = Number(sessionsRes.rows[0]?.n ?? 0);

	const blockMap = new Map(blocks.map((e) => [e.ip, e]));

	const topAttackers: TopAttackerItem[] = attackersRes.rows.map((r) => {
		const ip = String(r.ip);
		const block = blockMap.get(ip);
		const liveScore = getLiveThreatScore(ip);
		const eventCount = Number(r.eventCount ?? 1);
		const computedScore = block
			? block.threatScore
			: Math.min(99, Math.max(liveScore, eventCount * 15));
		return {
			ip,
			eventCount,
			threatScore: computedScore,
			lastSeen: Number(r.lastSeen ?? now),
			lastMessage: String(r.lastMessage ?? ''),
			status: block ? block.status : 'monitoring',
			threatIntel: classifyThreatIntel(ip),
		};
	});

	let defcon: 1 | 2 | 3 | 4 | 5 = 5;
	if (lockdown.active) {
		defcon = 1;
	} else if (criticalEvents24h >= 1 || newActiveBansCount >= 3 || securityEvents24h >= 40) {
		defcon = 2;
	} else if (newActiveBansCount >= 1 || securityEvents24h >= 15 || sessionAnomalies24h >= 1) {
		defcon = 3;
	} else if (authFailures24h >= 5 || securityEvents24h >= 3) {
		defcon = 4;
	}

	const activeRateLimits = getActiveRateLimits();

	return {
		defcon,
		lockdown,
		emergencySwitches,
		webhookConfig: maskWebhookConfig(webhookConfig),
		metrics: {
			activeBansCount,
			whitelistedCount,
			securityEvents24h,
			authFailures24h,
			csrfAndIdor24h,
			sessionAnomalies24h,
			activeSessionsCount,
			activeRateLimits,
			activeRateLimitsCount: activeRateLimits.length,
		},
		topAttackers,
		systemTelemetry: getHostAndPoolTelemetry(),
		defconResetAt,
	};
}
