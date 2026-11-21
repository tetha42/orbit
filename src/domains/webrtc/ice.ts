import crypto from 'node:crypto';

export interface WebRtcIceServer {
	urls: string | string[];
	username?: string;
	credential?: string;
}

const DEFAULT_STUN = 'stun:stun.l.google.com:19302';
const TURN_TTL_SECONDS = 3600;

export function buildWebRtcIceServers(userId: string): WebRtcIceServer[] {
	const rawStun = (process.env.WEBRTC_STUN_URLS || DEFAULT_STUN).trim();
	const stunUrls = rawStun
		.split(',')
		.map((u) => u.trim())
		.filter((u) => /^stuns?:/i.test(u));

	const servers: WebRtcIceServer[] = [
		{
			urls: stunUrls.length > 0 ? stunUrls : [DEFAULT_STUN],
		},
	];

	const turnUrlRaw = (process.env.WEBRTC_TURN_URL || '').trim();
	const turnSecret = (process.env.WEBRTC_TURN_SECRET || '').trim();
	if (turnUrlRaw && turnSecret) {
		const turnUrls = turnUrlRaw
			.split(',')
			.map((u) => u.trim())
			.filter((u) => /^turns?:/i.test(u));
		if (turnUrls.length > 0) {
			const expiry = Math.floor(Date.now() / 1000) + TURN_TTL_SECONDS;
			const safeUser = (userId || 'member').replace(/[^a-zA-Z0-9_-]/g, '');
			const username = `${expiry}:${safeUser}`;
			const credential = crypto
				.createHmac('sha1', turnSecret)
				.update(username)
				.digest('base64');
			servers.push({
				urls: turnUrls,
				username,
				credential,
			});
		}
	}

	return servers;
}
