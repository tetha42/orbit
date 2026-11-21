import { postSocAction } from './sessionActions';

export async function executeFirewallAction(data: {
	ip: string;
	mode: 'ban' | 'whitelist';
	durationMinutes?: number | null;
	reason: string;
}) {
	return postSocAction({
		action: data.mode === 'ban' ? 'ban_ip' : 'whitelist_ip',
		ip: data.ip,
		durationMinutes: data.durationMinutes,
		reason: data.reason,
	});
}

export async function executeUnban(ip: string) {
	return postSocAction({ action: 'unban_ip', ip });
}

export async function executeClearRateLimit(key: string) {
	return postSocAction({ action: 'clear_rate_limit', key });
}
