import { classifyThreatIntel } from '@/server/security/threatIntelligence';
import type { ActiveSessionInfo } from './types';

export function calculateImpossibleTravel(
	loginIp: string,
	activeIp: string,
	loginTime: number,
	activeTime: number
): ActiveSessionInfo['impossibleTravel'] {
	const deltaMs = Math.abs(activeTime - loginTime);
	const deltaMinutes = Math.max(1, Math.round(deltaMs / 60_000));

	const intelLogin = classifyThreatIntel(loginIp);
	const intelActive = classifyThreatIntel(activeIp);

	const p1 = loginIp.split('.').slice(0, 2).join('.');
	const p2 = activeIp.split('.').slice(0, 2).join('.');
	const isDiffSubnet = p1 !== p2;

	if (isDiffSubnet && deltaMinutes < 45) {
		const estDistKm = intelLogin.provider !== intelActive.provider ? 1500 : 800;
		const speedKmh = Math.round(estDistKm / (deltaMinutes / 60));
		if (speedKmh > 800) {
			return {
				detected: true,
				speedKmh,
				deltaMinutes,
				fromIp: loginIp,
				toIp: activeIp,
				reason: `${deltaMinutes}m delta between distinct prefixes (${intelLogin.provider} -> ${intelActive.provider}), calculated velocity ~${speedKmh} km/h`,
			};
		}
	}
	return undefined;
}
