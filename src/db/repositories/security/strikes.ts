import { ensurePostgresInit, getPgPool } from '@/db';
import { cleanIp } from '@/lib/audit';
import { isInfrastructureIp } from '@/server/security/proxyDiagnostics';
import { sendSecurityAlert } from '@/server/security/securityWebhook';
import { logSystemEvent } from '../logs.repo';
import { banIp, isIpBanned } from './blocks';
import { createSocIncident } from './incidents';
import { isLocalOrUnknownIp } from './ipUtils';
import { getLockdownState } from './lockdown';

interface ThreatStrikeBucket {
	points: number;
	reasons: string[];
	resetAt: number;
	lastStrikeAt: number;
}

const STRIKE_WINDOW_MS = 15 * 60_000; // 15 minutes
const AUTO_BAN_THRESHOLD = 100;
const MAX_STRIKE_BUCKETS = 10_000;

const strikeBuckets = new Map<string, ThreatStrikeBucket>();

export function clearStrikeBucket(ip: string): void {
	strikeBuckets.delete(ip);
}

export function getLiveThreatScore(ip: string): number {
	const clean = cleanIp(ip);
	const bucket = strikeBuckets.get(clean);
	if (!bucket || bucket.resetAt <= Date.now()) return 0;
	return bucket.points;
}

function pruneStrikeBucketsIfNeeded(): void {
	if (strikeBuckets.size < MAX_STRIKE_BUCKETS) return;
	const now = Date.now();
	for (const [k, b] of strikeBuckets.entries()) {
		if (b.resetAt <= now) {
			strikeBuckets.delete(k);
		}
	}
	if (strikeBuckets.size >= MAX_STRIKE_BUCKETS) {
		let evicted = 0;
		for (const k of strikeBuckets.keys()) {
			strikeBuckets.delete(k);
			evicted++;
			if (evicted >= 1000) break;
		}
	}
}

export async function recordSecurityStrike(params: {
	ip: string;
	points: number;
	reason: string;
	path?: string;
	userId?: string | null;
}): Promise<{ autoBanned: boolean; totalPoints: number }> {
	const clean = cleanIp(params.ip);
	if (isLocalOrUnknownIp(clean) || isInfrastructureIp(clean)) {
		return { autoBanned: false, totalPoints: 0 };
	}

	const status = await isIpBanned(clean);
	if (status.whitelisted || status.banned) {
		return { autoBanned: status.banned, totalPoints: status.banned ? 100 : 0 };
	}

	pruneStrikeBucketsIfNeeded();

	const lockdown = await getLockdownState();
	const effectivePoints = Math.max(1, Math.round(params.points * (lockdown.active ? 2 : 1)));

	const now = Date.now();
	let bucket = strikeBuckets.get(clean);
	if (!bucket || bucket.resetAt <= now) {
		bucket = {
			points: effectivePoints,
			reasons: [params.reason],
			resetAt: now + STRIKE_WINDOW_MS,
			lastStrikeAt: now,
		};
		strikeBuckets.set(clean, bucket);
	} else {
		bucket.points += effectivePoints;
		if (!bucket.reasons.includes(params.reason) && bucket.reasons.length < 5) {
			bucket.reasons.push(params.reason);
		}
		bucket.lastStrikeAt = now;
	}

	if (bucket.points >= AUTO_BAN_THRESHOLD) {
		let priorViolations = 0;
		try {
			await ensurePostgresInit();
			const prev = await getPgPool().query(
				`SELECT violations FROM security_blocks WHERE ip = $1`,
				[clean]
			);
			priorViolations = Number(prev.rows[0]?.violations ?? 0);
		} catch {
			// ignore
		}

		const durationMs =
			priorViolations >= 2
				? 24 * 60 * 60_000 // 24 hours
				: priorViolations === 1
					? 2 * 60 * 60_000 // 2 hours
					: 15 * 60_000; // 15 minutes

		const combinedReason = `[IPS Auto-Quarantine] ${bucket.reasons.join(' + ')}`.slice(0, 280);
		await banIp({
			ip: clean,
			reason: combinedReason,
			durationMs,
			threatScore: bucket.points,
		});

		void createSocIncident({
			title: `IPS Auto-Quarantine: ${clean}`,
			severity: bucket.points >= 100 ? 'CRITICAL' : 'HIGH',
			sourceIp: clean,
			service: 'ips',
			details: {
				reasons: bucket.reasons,
				points: bucket.points,
				path: params.path,
			},
			analystNotes: `IPS Auto-Quarantine triggered due to strike score of ${bucket.points}. Violations: ${bucket.reasons.join(', ')}.`,
		}).catch(() => {});

		void logSystemEvent({
			service: 'security',
			level: 'ERROR',
			message: `[IPS AUTO-BAN] Hostile IP auto-quarantined: ${clean} (Threat Score: ${bucket.points})`,
			detail: {
				ip: clean,
				threatScore: bucket.points,
				reasons: bucket.reasons,
				durationMinutes: Math.round(durationMs / 60_000),
				targetPath: params.path,
			},
			userId: params.userId ?? null,
			ip: clean,
		});

		void sendSecurityAlert({
			type: 'IP_AUTOBANNED',
			title: 'Automated IP Quarantine (IPS Auto-Ban)',
			description: `Hostile IP ${clean} exceeded strike threshold (${bucket.points} points) and was quarantined.\nReason: ${combinedReason}`,
			severity: 'CRITICAL',
			ip: clean,
			details: {
				threatScore: bucket.points,
				duration: `${Math.round(durationMs / 60_000)} minutes`,
				targetPath: params.path || '-',
			},
		});

		return { autoBanned: true, totalPoints: bucket.points };
	}

	return { autoBanned: false, totalPoints: bucket.points };
}
