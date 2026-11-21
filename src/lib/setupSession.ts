import crypto from 'node:crypto';
import type { NextResponse } from 'next/server';
import { clientAddress } from '@/lib/http';

export const SETUP_SESSION_COOKIE = 'orbit_setup_session';

const SETUP_SESSION_TTL_SECONDS = 3600;
const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * Derives an HMAC session token bound to the current first-run setup token and expiration unix timestamp.
 * Automatically invalidates when `data/orbit.setup.token` is deleted or rotated, or when TTL expires.
 */
export function createSetupSessionValue(diskToken: string, nowSeconds = Math.floor(Date.now() / 1000)): string {
	const exp = nowSeconds + SETUP_SESSION_TTL_SECONDS;
	const mac = crypto
		.createHmac('sha256', diskToken)
		.update(`orbit-setup-session:v2:${exp}`)
		.digest('hex');
	return `${exp}.${mac}`;
}

export function readCookieValue(cookieHeader: string | null, name: string): string | null {
	if (!cookieHeader || !name) return null;
	for (const part of cookieHeader.split(';')) {
		const eqIdx = part.indexOf('=');
		if (eqIdx <= 0) continue;
		const key = part.slice(0, eqIdx).trim();
		if (key !== name) continue;
		const rawVal = part.slice(eqIdx + 1).trim();
		if (!rawVal) return null;
		try {
			return decodeURIComponent(rawVal);
		} catch {
			// Return raw cookie token if percent-decoding fails
			return rawVal;
		}
	}
	return null;
}

export function hasValidSetupSessionCookie(request: Request, diskToken: string | null): boolean {
	if (!diskToken) return false;
	const candidate = readCookieValue(request.headers.get('cookie'), SETUP_SESSION_COOKIE);
	if (!candidate) return false;

	const dotIdx = candidate.indexOf('.');
	if (dotIdx > 0) {
		const expRaw = candidate.slice(0, dotIdx);
		const macRaw = candidate.slice(dotIdx + 1);
		if (!/^\d+$/.test(expRaw) || !macRaw) return false;
		const exp = Number(expRaw);
		const nowSeconds = Math.floor(Date.now() / 1000);
		if (!Number.isFinite(exp) || exp < nowSeconds) return false;
		const expectedMac = crypto
			.createHmac('sha256', diskToken)
			.update(`orbit-setup-session:v2:${exp}`)
			.digest('hex');
		if (macRaw.length !== expectedMac.length) return false;
		try {
			return crypto.timingSafeEqual(Buffer.from(macRaw), Buffer.from(expectedMac));
		} catch {
			return false;
		}
	}

	return false;
}

/**
 * Allows tokenless setup ONLY when explicitly opted in for local loopback development.
 */
export function isDevAutoUnlockAllowed(request: Request): boolean {
	if (process.env.NODE_ENV !== 'development') return false;
	if (process.env.ORBIT_DEV_AUTO_UNLOCK !== '1') return false;

	const rawConnectingHeader = request.headers.get('x-orbit-connecting-ip')?.trim();
	if (rawConnectingHeader && !LOOPBACK_IPS.has(rawConnectingHeader)) {
		return false;
	}

	if (
		request.headers.get('x-forwarded-for') ||
		request.headers.get('cf-connecting-ip') ||
		request.headers.get('true-client-ip') ||
		request.headers.get('x-real-ip') ||
		request.headers.get('x-forwarded-host')
	) {
		return false;
	}

	const hostHeader = (request.headers.get('host') || '').trim().toLowerCase();
	if (hostHeader) {
		const hostWithoutPort = hostHeader.startsWith('[')
			? hostHeader.slice(0, hostHeader.indexOf(']') + 1)
			: hostHeader.split(':')[0];
		if (hostWithoutPort !== 'localhost' && hostWithoutPort !== '127.0.0.1' && hostWithoutPort !== '[::1]') {
			return false;
		}
	}

	const ip = clientAddress(request);
	return LOOPBACK_IPS.has(ip);
}

export function attachSetupSessionCookie(
	response: NextResponse,
	request: Request,
	diskToken: string
): NextResponse {
	const isHttps = request.headers.get('x-forwarded-proto') === 'https' || request.url.startsWith('https:');
	response.cookies.set({
		name: SETUP_SESSION_COOKIE,
		value: createSetupSessionValue(diskToken),
		httpOnly: true,
		sameSite: 'strict',
		path: '/',
		maxAge: SETUP_SESSION_TTL_SECONDS,
		secure: isHttps,
	});
	return response;
}
