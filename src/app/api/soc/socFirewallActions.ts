import { NextResponse } from 'next/server';
import {
	banIp,
	unbanIp,
	whitelistIp,
	isIpInCidr,
} from '@/db/repositories/security.repo';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { parseIpOrCidr } from './socParsers';

export async function handleSocFirewallAction(
	action: string,
	body: Record<string, unknown>,
	actorId: string,
	callerIp: string
): Promise<NextResponse | null> {
	if (action === 'ban_ip' || action === 'ban') {
		const rawIp = String(body.ip || '').trim();
		const parsedIp = parseIpOrCidr(rawIp);
		const reason = String(body.reason || '').trim() || 'Manual quarantine by SoC Administrator';
		const rawDuration = body.durationMinutes;
		const numericDuration =
			typeof rawDuration === 'number' ||
			(typeof rawDuration === 'string' && rawDuration.trim() !== '' && rawDuration !== 'permanent')
				? Number(rawDuration)
				: NaN;
		const durationMinutes = Number.isFinite(numericDuration) && numericDuration > 0 ? numericDuration : null;

		if (!parsedIp) {
			return NextResponse.json(
				{ error: 'Enter a valid IPv4, IPv6, or CIDR subnet address (e.g. 198.51.100.0/24).' },
				{ status: 400 }
			);
		}

		if (parsedIp === callerIp || (parsedIp.includes('/') && isIpInCidr(callerIp, parsedIp))) {
			return NextResponse.json(
				{ error: 'You cannot quarantine your own active IP address or subnet (Session lockout protection).' },
				{ status: 400 }
			);
		}

		const durationMs = durationMinutes ? durationMinutes * 60_000 : null;
		await banIp({
			ip: parsedIp,
			reason,
			durationMs,
			threatScore: 100,
			creatorId: actorId,
		});

		await logSystemEvent({
			service: 'security',
			level: 'ERROR',
			message: `[MANUAL IP QUARANTINE] Address ${parsedIp} blocked via SoC (${durationMinutes ? `${durationMinutes}m` : 'Permanent'}).`,
			detail: { ip: parsedIp, reason, durationMinutes },
			userId: actorId,
			ip: callerIp,
		});

		return NextResponse.json({ ok: true });
	}

	if (action === 'unban_ip' || action === 'unban') {
		const rawIp = String(body.ip || '').trim();
		const ip = parseIpOrCidr(rawIp) || rawIp;
		if (!ip) {
			return NextResponse.json({ error: 'IP address is required.' }, { status: 400 });
		}

		await unbanIp(ip);
		await logSystemEvent({
			service: 'security',
			level: 'INFO',
			message: `[QUARANTINE LIFTED] Security block for ${ip} was removed.`,
			detail: { ip },
			userId: actorId,
			ip: callerIp,
		});

		return NextResponse.json({ ok: true });
	}

	if (action === 'whitelist_ip' || action === 'whitelist') {
		const rawIp = String(body.ip || '').trim();
		const parsedIp = parseIpOrCidr(rawIp);
		const reason = String(body.reason || '').trim() || 'Trusted IP (Whitelist)';
		if (!parsedIp) {
			return NextResponse.json(
				{ error: 'Enter a valid IPv4, IPv6, or CIDR subnet address.' },
				{ status: 400 }
			);
		}

		await whitelistIp({
			ip: parsedIp,
			reason,
			creatorId: actorId,
		});
		await logSystemEvent({
			service: 'security',
			level: 'INFO',
			message: `[WHITELIST ADDED] Address ${parsedIp} added to trusted IP list.`,
			detail: { ip: parsedIp, reason },
			userId: actorId,
			ip: callerIp,
		});

		return NextResponse.json({ ok: true });
	}

	return null;
}
