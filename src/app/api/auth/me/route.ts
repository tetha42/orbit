import { NextResponse } from 'next/server';
import { getUserBySessionToken } from '@/db';
import { readSessionToken } from '@/lib/auth/authGuard';
import { SESSION_COOKIE, sessionUserOf } from '@/lib/auth/session';
import { ADMIN_ROLE_ID } from '@/core/permissions';
import { clientAddress } from '@/lib/http';
import { getLockdownState, isIpBanned, recordSessionActivity } from '@/db/repositories/security.repo';

/**
 * The signed-in member, with their role and per-app permissions. The client
 * polls this, so an edited role reaches open sessions within one poll.
 */
export async function GET(request: Request) {
	try {
		const ip = clientAddress(request);
		const ban = await isIpBanned(ip);
		if (ban.banned) {
			return NextResponse.json(
				{ authenticated: false, user: null, error: 'Erişim engellendi.' },
				{ status: 403, headers: { 'Cache-Control': 'no-store' } }
			);
		}

		const sessionToken = readSessionToken(request);
		if (!sessionToken) {
			return NextResponse.json({ authenticated: false, user: null, message: 'Aktif bir oturum bulunamadı' }, { status: 401 });
		}

		const user = await getUserBySessionToken(sessionToken);

		// No user for the token: it is invalid or the account signed in on another device.
		// This is an authentication failure (401), never a lockdown (503).
		if (!user) {
			const response = NextResponse.json(
				{
					authenticated: false,
					user: null,
					conflict: true,
					error: 'Oturumunuz başka bir cihazda açıldığı için bu cihazdaki oturum sonlandırıldı.',
				},
				{ status: 401 }
			);
			response.cookies.delete(SESSION_COOKIE);
			return response;
		}

		// DEFCON 1 hard lockdown: only non-admin members are refused. The check runs
		// after the session is resolved, so an admin is never mistaken for a non-admin.
		if (user.roleId !== ADMIN_ROLE_ID) {
			const lockdown = await getLockdownState();
			if (lockdown.active) {
				return NextResponse.json(
					{
						authenticated: false,
						user: null,
						lockdown: true,
						code: 'LOCKDOWN_ACTIVE',
						error: 'Sistem DEFCON 1 siber kalkan kriz modundadır. Yönetici harici erişimler geçici olarak askıya alınmıştır.',
					},
					{ status: 503, headers: { 'Cache-Control': 'no-store' } }
				);
			}
		}

		// Pass-the-Cookie protection (detect sudden mid-session IP changes across subnets)
		const sessionCheck = recordSessionActivity(user, ip);
		if (sessionCheck.suspiciousJump) {
			const response = NextResponse.json(
				{
					authenticated: false,
					user: null,
					code: 'SESSION_IP_MISMATCH',
					error: 'Oturum açtığınız IP/ağ ile mevcut IP adresiniz uyuşmuyor. Güvenlik nedeniyle oturumunuz donduruldu (Pass-the-Cookie Koruması). Lütfen tekrar giriş yapın.',
				},
				{ status: 401 }
			);
			response.cookies.delete(SESSION_COOKIE);
			return response;
		}

		// Alumni keep a read-only session (as verifyAuth allows); pending or
		// rejected accounts are signed out.
		if (user.status !== 'aktif' && user.status !== 'mezun') {
			const response = NextResponse.json({ authenticated: false, user: null, error: 'Hesabınız aktif durumda değildir.' }, { status: 403 });
			response.cookies.delete(SESSION_COOKIE);
			return response;
		}

		return NextResponse.json({ authenticated: true, user: await sessionUserOf(user) }, { headers: { 'Cache-Control': 'no-store' } });
	} catch (error) {
		console.error('API error:', error);
		return NextResponse.json({ error: 'İşlem tamamlanamadı.' }, { status: 500 });
	}
}
