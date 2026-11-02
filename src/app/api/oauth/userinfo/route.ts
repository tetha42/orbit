import { NextResponse } from 'next/server';
import { getUserById } from '@/db';
import { getRolePermission } from '@/db/roles';
import { verifyOAuthJwt } from '@/lib/auth/jwt';
import { clientAddress } from '@/lib/http';
import { isIpBanned, recordSecurityStrike } from '@/db/repositories/security.repo';
import { inspectRequestPayload } from '@/lib/waf';
import { logSystemEvent } from '@/db/repositories/logs.repo';

export async function GET(request: Request) {
	const ip = clientAddress(request);
	const ban = await isIpBanned(ip);
	if (ban.banned) {
		void recordSecurityStrike({
			ip,
			points: 10,
			reason: 'Karantinadaki IP OAuth userinfo denemesi',
			path: '/api/oauth/userinfo',
		});
		return NextResponse.json(
			{ error: 'access_denied', error_description: 'IP adresiniz siber güvenlik politikası nedeniyle karantinaya alınmıştır.' },
			{ status: 403 }
		);
	}

	const waf = inspectRequestPayload(request);
	if (waf.matched) {
		void logSystemEvent({
			servis: 'security',
			seviye: 'ERROR',
			mesaj: `[WAF] OAuth userinfo saldırı imzası engellendi (${waf.signature}): GET /api/oauth/userinfo`,
			detay: { category: waf.category, signature: waf.signature },
			ip,
		});
		void recordSecurityStrike({
			ip,
			points: waf.points,
			reason: `WAF: ${waf.signature}`,
			path: '/api/oauth/userinfo',
		});
		return NextResponse.json(
			{ error: 'access_denied', error_description: 'Güvenlik duvarı (WAF) tarafından şüpheli istek engellendi.' },
			{ status: 403 }
		);
	}

	try {
		const authHeader = request.headers.get('authorization') || '';
		if (!authHeader.startsWith('Bearer ')) {
			return NextResponse.json(
				{ error: 'invalid_token', error_description: 'Bearer jetonu eksik.' },
				{
					status: 401,
					headers: { 'WWW-Authenticate': 'Bearer error="invalid_token"' },
				}
			);
		}

		const token = authHeader.slice(7).trim();
		const verified = await verifyOAuthJwt(token);

		if (!verified.valid) {
			const errorMsg = 'error' in verified ? verified.error : 'Geçersiz token.';
			return NextResponse.json(
				{ error: 'invalid_token', error_description: errorMsg },
				{
					status: 401,
					headers: { 'WWW-Authenticate': `Bearer error="invalid_token", error_description="${errorMsg}"` },
				}
			);
		}

		const userId = verified.payload.sub;
		const user = await getUserById(userId);

		if (!user || (user.status !== 'aktif' && user.status !== 'mezun')) {
			return NextResponse.json(
				{ error: 'invalid_token', error_description: 'Kullanıcı bulunamadı veya aktif değil.' },
				{ status: 401 }
			);
		}

		const scopes = typeof verified.payload.scope === 'string'
			? verified.payload.scope.split(/\s+/)
			: ['openid', 'profile', 'email', 'academic', 'roles'];
		const permission = await getRolePermission(user.roleId);

		const claims: Record<string, unknown> = {
			sub: user.id,
		};

		if (scopes.includes('profile')) {
			claims.name = `${user.ad} ${user.soyad}`.trim();
			claims.given_name = user.ad;
			claims.family_name = user.soyad;
			claims.picture = user.profilFoto || null;
			claims.bio = user.bio || '';
		}

		if (scopes.includes('email')) {
			claims.email = user.email;
			claims.email_verified = true;
		}

		if (scopes.includes('academic')) {
			claims.student_no = user.ogrenciNo || null;
			claims.department = user.bolum || null;
			claims.grade = user.sinif ?? null;
		}

		if (scopes.includes('roles')) {
			claims.role = {
				id: permission.role?.id || null,
				name: permission.role?.ad || null,
				color: permission.role?.renk || null,
				is_admin: permission.admin,
			};
			claims.permissions = permission.izinler;
			claims.xp = user.xp;
		}

		return NextResponse.json(claims, {
			headers: {
				'Cache-Control': 'no-store',
				Pragma: 'no-cache',
			},
		});
	} catch (error) {
		console.error('API /api/oauth/userinfo error:', error);
		return NextResponse.json(
			{ error: 'server_error', error_description: 'Kullanıcı bilgisi alınamadı.' },
			{ status: 500 }
		);
	}
}
