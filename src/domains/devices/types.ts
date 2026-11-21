import { clientAddress } from '@/lib/http';

export type DeviceClass = 'mobile' | 'desktop';
export type DesktopAuthPolicy = 'standard' | 'mobile_preferred' | 'mobile_required';
export type SessionAuthMethod =
	| 'password'
	| 'totp'
	| 'passkey'
	| 'mobile_approval'
	| 'qr_code';

export interface UserSessionRecord {
	id: string;
	userId: string;
	deviceClass: DeviceClass;
	deviceName: string;
	browser: string;
	os: string;
	ipAddress: string;
	userAgent: string;
	authMethod: string;
	createdAt: number;
	lastActiveAt: number;
	expiresAt: number;
	revokedAt: number | null;
	revokedReason: string | null;
	isCurrent?: boolean;
}

export type LoginApprovalMode = 'push' | 'code' | 'qr';
export type LoginApprovalStatus =
	| 'pending'
	| 'approved'
	| 'rejected'
	| 'expired'
	| 'consumed';

export interface DeviceLoginApprovalRecord {
	id: string;
	userId: string;
	mode: LoginApprovalMode;
	challengeNumber: number;
	numberOptions: number[];
	mobileDisplayCode?: string;
	desktopIp: string;
	desktopUa: string;
	desktopDeviceName: string;
	status: LoginApprovalStatus;
	expiresAt: number;
	createdAt: number;
}

export interface DetectedDeviceMetadata {
	deviceClass: DeviceClass;
	deviceName: string;
	browser: string;
	os: string;
	ip: string;
	userAgent: string;
}

const MOBILE_UA_RE =
	/\b(?:Android|iPhone|iPad|iPod|Mobile|Windows Phone|BlackBerry|Opera Mini|IEMobile)\b/i;

export function parseBrowserOs(userAgent: string): { browser: string; os: string } {
	let os = 'Linux';
	if (/iPhone|iPad|iPod/i.test(userAgent)) os = 'iOS';
	else if (/Android/i.test(userAgent)) os = 'Android';
	else if (/Mac OS X|Macintosh/i.test(userAgent)) os = 'macOS';
	else if (/Windows/i.test(userAgent)) os = 'Windows';
	else if (/CrOS/i.test(userAgent)) os = 'ChromeOS';

	let browser = 'Browser';
	if (/Edg\//i.test(userAgent)) browser = 'Edge';
	else if (/OPR\/|Opera/i.test(userAgent)) browser = 'Opera';
	else if (/Firefox\//i.test(userAgent)) browser = 'Firefox';
	else if (/Chrome\//i.test(userAgent) && !/Chromium/i.test(userAgent)) browser = 'Chrome';
	else if (/Safari\//i.test(userAgent) && !/Chrome/i.test(userAgent)) browser = 'Safari';

	return { browser, os };
}

export function detectDeviceMetadata(request?: Request): DetectedDeviceMetadata {
	const rawUa = request?.headers.get('user-agent') || '';
	const userAgent = rawUa.replace(/[\r\n\0]+/g, ' ').trim().slice(0, 240);
	const ip = request ? clientAddress(request) : '127.0.0.1';

	const explicitHeader = request?.headers.get('x-orbit-device-class')?.trim().toLowerCase();
	const deviceClass: DeviceClass =
		explicitHeader === 'mobile'
			? 'mobile'
			: explicitHeader === 'desktop'
			? 'desktop'
			: MOBILE_UA_RE.test(userAgent)
			? 'mobile'
			: 'desktop';

	const { browser, os } = parseBrowserOs(userAgent);
	const deviceName = `${os} • ${browser}`;
	return {
		deviceClass,
		deviceName,
		browser,
		os,
		ip,
		userAgent,
	};
}
