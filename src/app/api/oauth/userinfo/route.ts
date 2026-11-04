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
			service: 'security',
			level: 'ERROR',
			message: `[WAF] OAuth userinfo saldırı imzası engellendi (${waf.signature}): GET /api/oauth/userinfo`,
			detail: { category: waf.category, signature: waf.signature },
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

		if (!user || (user.status !== 'active' && user.status !== 'alumni')) {
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
			const first = user.firstName || user.name || '';
			const last = user.lastName || user.surname || '';
			claims.name = `${first} ${last}`.trim();
			claims.given_name = first;
			claims.family_name = last;
			claims.picture = user.avatarUrl || user.profilePhoto || null;
			claims.bio = user.bio || '';
		}

		if (scopes.includes('email')) {
			claims.email = user.email;
			claims.email_verified = true;
		}

		if (scopes.includes('academic')) {
			claims.student_no = user.studentNo || null;
			claims.department = user.department || null;
			claims.grade = user.grade ?? null;
		}

		if (scopes.includes('roles')) {
			claims.role = {
				id: permission.role?.id || null,
				name: permission.role?.name || null,
				color: permission.role?.color || null,
				is_admin: permission.admin,
			};
			claims.permissions = permission.permissions;
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
