import { NextResponse } from 'next/server';
import { requireApp } from '@/lib/auth/access';
import { clientAddress, parseIpCandidate } from '@/lib/http';
import {
	banIp,
	unbanIp,
	whitelistIp,
	getSecurityBlocks,
	getSocOverview,
	getActiveSessions,
	setLockdownState,
	revokeUserSession,
	revokeAllNonAdminSessions,
	revokeAnomalousSessions,
	suspendUserAccount,
	isIpInCidr,
	setEmergencyKillSwitch,
	resetDefconBaseline,
	getSocIncidents,
	updateSocIncident,
	createSocIncident,
	type EmergencyKillSwitches,
} from '@/server/db/domains/security.repo';
import {
	getSystemLogsPaginated,
	logSystemEvent,
	type FilterOperator,
	type FilterColumn,
	type TimeRangePreset,
} from '@/server/db/domains/logs.repo';
import { getActiveRateLimits, resetRateLimit } from '@/lib/rateLimit';
import { getProxyAndIngressDiagnostics } from '@/lib/server/proxyDiagnostics';
import { saveWebhookConfig, sendSecurityAlert, type WebhookConfig } from '@/lib/server/securityWebhook';

function parseIpOrCidr(raw: string | null | undefined): string | null {
	if (!raw) return null;
	const candidate = raw.trim();
	if (candidate.includes('/')) {
		const parts = candidate.split('/');
		if (parts.length === 2) {
			const subnet = parseIpCandidate(parts[0]);
			const prefixStr = parts[1].trim();
			if (subnet && /^\d+$/.test(prefixStr)) {
				const prefix = parseInt(prefixStr, 10);
				const isIpv6 = subnet.includes(':');
				const minPrefix = isIpv6 ? 16 : 8;
				const maxPrefix = isIpv6 ? 128 : 32;
				// Safety: don't allow subnets broader than /8 (/16 for IPv6) to prevent accidental global lockout
				if (prefix >= minPrefix && prefix <= maxPrefix) {
					return `${subnet}/${prefix}`;
				}
			}
		}
		return null;
	}
	return parseIpCandidate(candidate);
}

export async function GET(request: Request) {
	const auth = await requireApp(request, 'soc', 'kullan');
	if (!auth.authorized) return auth.response;

	const { searchParams } = new URL(request.url);
	const action = (searchParams.get('action') || 'all').trim();

	try {
		if (action === 'overview') {
			const overview = await getSocOverview();
			return NextResponse.json({ overview, ingressDiagnostics: getProxyAndIngressDiagnostics(request) });
		}

		if (action === 'bans') {
			const bans = await getSecurityBlocks();
			return NextResponse.json({ bans });
		}

		if (action === 'sessions') {
			const sessions = await getActiveSessions();
			return NextResponse.json({ sessions, currentUserId: auth.user.id });
		}

		if (action === 'rate_limits') {
			const rateLimits = getActiveRateLimits();
			return NextResponse.json({ rateLimits });
		}

		if (action === 'incidents') {
			const incidents = await getSocIncidents();
			return NextResponse.json({ incidents });
		}

		const parseSiemFilter = () => {
			const servis = searchParams.get('servis') || undefined;
			const servisOp = (searchParams.get('servisOp') as 'eq' | 'neq') || undefined;
			const seviye = searchParams.get('seviye') || undefined;
			const seviyeOp = (searchParams.get('seviyeOp') as 'eq' | 'neq') || undefined;
			const ip = searchParams.get('ip') || undefined;
			const ipOp = (searchParams.get('ipOp') as 'eq' | 'neq' | 'contains' | 'not_contains') || undefined;
			const arama = searchParams.get('arama') || undefined;
			const aramaOp = (searchParams.get('aramaOp') as FilterOperator) || undefined;
			const aramaAlani = (searchParams.get('aramaAlani') as FilterColumn) || undefined;
			const timeRange = (searchParams.get('timeRange') as TimeRangePreset) || undefined;
			const startTime = searchParams.get('startTime') ? Number(searchParams.get('startTime')) : undefined;
			const endTime = searchParams.get('endTime') ? Number(searchParams.get('endTime')) : undefined;
			const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
			const limit = Math.min(500, Math.max(10, parseInt(searchParams.get('limit') || '50', 10)));
			return { servis, servisOp, seviye, seviyeOp, ip, ipOp, arama, aramaOp, aramaAlani, timeRange, startTime, endTime, page, limit };
		};

		if (action === 'siem') {
			const result = await getSystemLogsPaginated(parseSiemFilter());
			return NextResponse.json({
				siem: result.logs,
				totalCount: result.totalCount,
				page: result.page,
				limit: result.limit,
				totalPages: result.totalPages,
				histogram: result.histogram,
			});
		}

		// Default: fetch overview, bans, sessions, incidents, and latest security logs in parallel
		const [overview, bans, sessions, incidents, siemResult] = await Promise.all([
			getSocOverview(),
			getSecurityBlocks(),
			getActiveSessions(),
			getSocIncidents(),
			getSystemLogsPaginated(parseSiemFilter()),
		]);

		return NextResponse.json({
			overview,
			bans,
			sessions,
			incidents,
			siem: siemResult.logs,
			siemMeta: {
				totalCount: siemResult.totalCount,
				page: siemResult.page,
				limit: siemResult.limit,
				totalPages: siemResult.totalPages,
				histogram: siemResult.histogram,
			},
			ingressDiagnostics: getProxyAndIngressDiagnostics(request),
			currentUserId: auth.user.id,
			callerIp: clientAddress(request),
		});
	} catch (error) {
		console.error('API GET /api/soc error:', error);
		return NextResponse.json({ error: 'SoC güvenlik telemetrisi alınamadı.' }, { status: 500 });
	}
}

export async function POST(request: Request) {
	const auth = await requireApp(request, 'soc', 'yonet');
	if (!auth.authorized) return auth.response;

	const callerIp = clientAddress(request);

	try {
		const body = await request.json().catch(() => ({}));
		const action = String(body.action || '').trim();

		if (action === 'ban_ip' || action === 'ban') {
			const rawIp = String(body.ip || '').trim();
			const parsedIp = parseIpOrCidr(rawIp);
			const neden = String(body.neden || body.sebep || 'SoC Yöneticisi tarafından manuel karantina').trim();
			const rawDuration = body.durationMinutes;
			const durationMinutes =
				rawDuration === null || rawDuration === undefined || rawDuration === 'permanent' || Number(rawDuration) <= 0
					? null
					: Number(rawDuration);

			if (!parsedIp) {
				return NextResponse.json({ error: 'Geçerli bir IPv4, IPv6 veya CIDR alt ağ adresi (ör. 198.51.100.0/24) girin.' }, { status: 400 });
			}

			if (parsedIp === callerIp || (parsedIp.includes('/') && isIpInCidr(callerIp, parsedIp))) {
				return NextResponse.json(
					{ error: 'Kendi aktif IP adresinizi veya bulunduğunuz alt ağı karantinaya alamazsınız (Oturum kilitleme koruması).' },
					{ status: 400 }
				);
			}

			const durationMs = durationMinutes ? durationMinutes * 60_000 : null;
			await banIp({
				ip: parsedIp,
				neden,
				durationMs,
				tehditPuani: 100,
				olusturanId: auth.user.id,
			});

			await logSystemEvent({
				servis: 'security',
				seviye: 'ERROR',
				mesaj: `🛡️ [MANUEL IP KARANTİNASI] ${parsedIp} adresi SoC üzerinden engellendi (${durationMinutes ? `${durationMinutes} dk` : 'Kalıcı'}).`,
				detay: { ip: parsedIp, neden, durationMinutes },
				userId: auth.user.id,
				ip: callerIp,
			});

			return NextResponse.json({ ok: true });
		}

		if (action === 'unban_ip' || action === 'unban') {
			const rawIp = String(body.ip || '').trim();
			const ip = parseIpOrCidr(rawIp) || rawIp;
			if (!ip) {
				return NextResponse.json({ error: 'IP adresi gereklidir.' }, { status: 400 });
			}

			await unbanIp(ip);
			await logSystemEvent({
				servis: 'security',
				seviye: 'INFO',
				mesaj: `🔓 [KARANTİNA KALDIRILDI] ${ip} adresinin güvenlik engeli kaldırıldı.`,
				detay: { ip },
				userId: auth.user.id,
				ip: callerIp,
			});

			return NextResponse.json({ ok: true });
		}

		if (action === 'whitelist_ip' || action === 'whitelist') {
			const rawIp = String(body.ip || '').trim();
			const parsedIp = parseIpOrCidr(rawIp);
			const neden = String(body.neden || body.sebep || 'Güvenilir IP (Whitelist)').trim();
			if (!parsedIp) {
				return NextResponse.json({ error: 'Geçerli bir IPv4, IPv6 veya CIDR alt ağ adresi girin.' }, { status: 400 });
			}

			await whitelistIp({
				ip: parsedIp,
				neden,
				olusturanId: auth.user.id,
			});
			await logSystemEvent({
				servis: 'security',
				seviye: 'INFO',
				mesaj: `✅ [WHITELIST EKLENDİ] ${parsedIp} adresi güvenilir IP listesine alındı.`,
				detay: { ip: parsedIp, neden },
				userId: auth.user.id,
				ip: callerIp,
			});

			return NextResponse.json({ ok: true });
		}

		if (action === 'toggle_lockdown') {
			const enabled = Boolean(body.enabled);
			const reason = body.reason ? String(body.reason).trim() : undefined;
			const state = await setLockdownState({
				active: enabled,
				reason,
				actorId: auth.user.id,
				ip: callerIp,
			});
			return NextResponse.json({ ok: true, lockdown: state });
		}

		if (action === 'kill_session') {
			const userId = String(body.userId || '').trim();
			if (!userId) {
				return NextResponse.json({ error: 'Kullanıcı ID gereklidir.' }, { status: 400 });
			}
			if (userId === auth.user.id) {
				return NextResponse.json(
					{ error: 'Kendi aktif oturumunuzu SoC üzerinden düşüremezsiniz.' },
					{ status: 400 }
				);
			}

			const revoked = await revokeUserSession({
				targetUserId: userId,
				actorId: auth.user.id,
				ip: callerIp,
			});

			return NextResponse.json({ ok: true, revoked });
		}

		if (action === 'kill_user_terminals') {
			const userId = String(body.userId || '').trim();
			if (!userId) {
				return NextResponse.json({ error: 'Kullanıcı ID gereklidir.' }, { status: 400 });
			}
			const { closeUserTerminalSessions } = await import('@/lib/server/terminalManager');
			const closedCount = closeUserTerminalSessions(userId);
			await logSystemEvent({
				servis: 'terminal',
				seviye: 'WARN',
				mesaj: `[SoC Shell Guard] User #${userId} active PTY terminal shells terminated (${closedCount} shells closed).`,
				detay: { userId, closedCount, actorId: auth.user.id },
				userId: auth.user.id,
				ip: callerIp,
			});
			return NextResponse.json({ ok: true, closedCount });
		}

		if (action === 'kill_all_sessions') {
			const droppedCount = await revokeAllNonAdminSessions({
				actorId: auth.user.id,
				ip: callerIp,
			});
			return NextResponse.json({ ok: true, droppedCount });
		}

		if (action === 'revoke_anomalies') {
			const droppedCount = await revokeAnomalousSessions({
				actorId: auth.user.id,
				ip: callerIp,
			});
			return NextResponse.json({ ok: true, droppedCount });
		}

		if (action === 'suspend_user') {
			const userId = String(body.userId || '').trim();
			if (!userId) {
				return NextResponse.json({ error: 'Kullanıcı ID gereklidir.' }, { status: 400 });
			}

			const res = await suspendUserAccount({
				targetUserId: userId,
				actorId: auth.user.id,
				ip: callerIp,
			});
			if (!res.ok) {
				return NextResponse.json({ error: res.error || 'Kullanıcı askıya alınamadı.' }, { status: 400 });
			}

			return NextResponse.json({ ok: true });
		}

		if (action === 'clear_rate_limit') {
			const key = String(body.key || '').trim();
			if (!key) {
				return NextResponse.json({ error: 'Hız sınırı anahtarı (key) gereklidir.' }, { status: 400 });
			}

			const cleared = resetRateLimit(key);
			await logSystemEvent({
				servis: 'security',
				seviye: 'INFO',
				mesaj: `⚡ [HIZ SINIRI SIFIRLANDI] '${key}' anahtarlı hız sınırı kısıtlaması SoC üzerinden sıfırlandı.`,
				detay: { key, cleared },
				userId: auth.user.id,
				ip: callerIp,
			});

			return NextResponse.json({ ok: true, cleared });
		}

		if (action === 'toggle_kill_switch') {
			const key = String(body.key || '') as keyof EmergencyKillSwitches;
			const validKeys: Array<keyof EmergencyKillSwitches> = ['disableRegistrations', 'disableUploads', 'passkeyOnly'];
			if (!validKeys.includes(key)) {
				return NextResponse.json({ error: 'Geçersiz acil status güvenlik anahtarı.' }, { status: 400 });
			}
			const value = Boolean(body.value);
			const updated = await setEmergencyKillSwitch(key, value, auth.user.id);
			return NextResponse.json({ ok: true, emergencySwitches: updated });
		}

		if (action === 'save_webhook') {
			const config = body.config as WebhookConfig;
			if (!config || typeof config !== 'object') {
				return NextResponse.json({ error: 'Geçersiz webhook yapılandırması.' }, { status: 400 });
			}
			await saveWebhookConfig(config);
			await logSystemEvent({
				servis: 'security',
				seviye: 'INFO',
				mesaj: `🔔 [WEBHOOK GÜNCELLENDİ] Güvenlik uyarı webhook ayarları güncellendi (${config.provider || 'none'}).`,
				detay: { provider: config.provider, enabled: config.enabled },
				userId: auth.user.id,
				ip: callerIp,
			});
			return NextResponse.json({ ok: true, config });
		}

		if (action === 'test_webhook') {
			const overrideConfig =
				body.config && typeof body.config === 'object' ? (body.config as WebhookConfig) : undefined;
			const sent = await sendSecurityAlert(
				{
					type: 'TEST_PING',
					title: '🧪 Test Güvenlik Uyarısı (SoC Test)',
					description: 'Bu mesaj SoC yönetim merkezinden tetiklenen test amaçlı bir güvenlik bildirimdir.',
					severity: 'INFO',
					ip: callerIp,
					details: { admin: auth.user.email, timestamp: new Date().toISOString() },
				},
				overrideConfig
			);
			return NextResponse.json({ ok: true, sent });
		}

		if (action === 'update_incident') {
			const id = String(body.id || '').trim();
			if (!id) {
				return NextResponse.json({ error: 'AppEvent ID gereklidir.' }, { status: 400 });
			}
			const ok = await updateSocIncident(id, {
				status: body.status,
				analystNotes: body.analystNotes,
				assignedTo: body.assignedTo,
			});
			return NextResponse.json({ ok });
		}

		if (action === 'create_incident') {
			const inc = await createSocIncident({
				title: String(body.title || 'Security Incident'),
				severity: body.severity || 'HIGH',
				sourceIp: body.sourceIp || null,
				service: body.service || 'security',
				details: body.details || null,
				analystNotes: body.analystNotes || null,
				assignedTo: auth.user.id,
			});
			return NextResponse.json({ ok: true, incident: inc });
		}

		if (action === 'reset_defcon') {
			const res = await resetDefconBaseline({
				actorId: auth.user.id,
				actorIp: callerIp,
			});
			return NextResponse.json({
				ok: true,
				defcon: 5,
				message: 'DEFCON güvenlik alarm sayacı barış durumuna (DEFCON 5) sıfırlandı.',
				resetAt: res.resetAt,
			});
		}

		return NextResponse.json({ error: 'Geçersiz SoC aksiyonu.' }, { status: 400 });
	} catch (error) {
		console.error('API POST /api/soc error:', error);
		return NextResponse.json({ error: 'SoC işlemi gerçekleştirilemedi.' }, { status: 500 });
	}
}
