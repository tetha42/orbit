import crypto from 'node:crypto';
import { ensurePostgresInit, getPgPool } from '@/db';
import { publishEvent } from '@/db/events';
import { hashOtpCode, verifyOtpCode } from '@/lib/auth/otp';
import {
	detectDeviceMetadata,
	type DeviceLoginApprovalRecord,
	type LoginApprovalMode,
	type LoginApprovalStatus,
} from './types';
import { notifyMobileApprovalPush } from './webPush';

export const APPROVAL_TTL_MS = 120_000;
const MAX_CODE_ATTEMPTS = 5;

function sha256Hex(input: string): string {
	return crypto.createHash('sha256').update(input).digest('hex');
}

function toDbMode(mode: LoginApprovalMode): 'push_approval' | 'mobile_code' | 'qr_link' {
	if (mode === 'code') return 'mobile_code';
	if (mode === 'qr') return 'qr_link';
	return 'push_approval';
}

function fromDbMode(raw: unknown): LoginApprovalMode {
	const v = String(raw ?? 'push_approval');
	if (v === 'mobile_code' || v === 'code') return 'code';
	if (v === 'qr_link' || v === 'qr') return 'qr';
	return 'push';
}

function buildNumberOptions(correct: number): number[] {
	const set = new Set<number>([correct]);
	while (set.size < 3) set.add(crypto.randomInt(10, 100));
	const arr = Array.from(set);
	for (let i = arr.length - 1; i > 0; i--) {
		const j = crypto.randomInt(0, i + 1);
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

function deriveMobileDisplayCode(approvalId: string, challengeNumber: number, createdAt: number): string {
	const secret = process.env.AUTH_SECRET || 'orbit-mobile-approval-code';
	const digest = crypto.createHmac('sha256', secret).update(`${approvalId}:${challengeNumber}:${createdAt}`).digest();
	return String((digest.readUInt32BE(0) % 900000) + 100000);
}

function mapApprovalRow(row: Record<string, unknown>, includeMobileCode = false): DeviceLoginApprovalRecord {
	const id = String(row.id ?? '');
	const challengeNumber = Number(row.numberMatch ?? row.number_match ?? row.challengeNumber ?? row.challenge_number ?? 10);
	const createdAt = Number(row.createdAt ?? row.created_at ?? 0);
	return {
		id,
		userId: String(row.userId ?? row.user_id ?? ''),
		mode: fromDbMode(row.mode),
		challengeNumber,
		numberOptions: buildNumberOptions(challengeNumber),
		...(includeMobileCode ? { mobileDisplayCode: deriveMobileDisplayCode(id, challengeNumber, createdAt) } : {}),
		desktopIp: String(row.desktopIp ?? row.desktop_ip ?? ''),
		desktopUa: String(row.desktopUa ?? row.desktop_ua ?? ''),
		desktopDeviceName: String(row.desktopLabel ?? row.desktop_label ?? row.desktopDeviceName ?? row.desktop_device_name ?? 'Desktop'),
		status: (row.status as LoginApprovalStatus) || 'pending',
		expiresAt: Number(row.expiresAt ?? row.expires_at ?? 0),
		createdAt,
	};
}

export async function startDesktopLoginApproval(params: {
	userId: string;
	mode: LoginApprovalMode;
	request?: Request;
}): Promise<{
	approvalId: string;
	pollSecret: string;
	qrToken: string;
	mode: LoginApprovalMode;
	challengeNumber: number;
	expiresAt: number;
}> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const now = Date.now();
	const expiresAt = now + APPROVAL_TTL_MS;
	const approvalId = `dla_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
	const challengeNumber = crypto.randomInt(10, 100);
	const pollSecret = crypto.randomBytes(24).toString('base64url');
	const qrToken = crypto.randomBytes(24).toString('base64url');
	const mobileCode = deriveMobileDisplayCode(approvalId, challengeNumber, now);

	const codeHash = params.mode === 'qr' ? sha256Hex(qrToken) : hashOtpCode(mobileCode);
	const challengeHash = sha256Hex(pollSecret);
	const meta = detectDeviceMetadata(params.request);

	await pool.query('DELETE FROM device_login_approvals WHERE expires_at < $1', [now]);
	await pool.query(
		`INSERT INTO device_login_approvals (
			id, user_id, challenge_hash, mode, code_hash, number_match,
			attempts, status, desktop_ip, desktop_ua, desktop_label, created_at, expires_at
		) VALUES ($1, $2, $3, $4, $5, $6, 0, 'pending', $7, $8, $9, $10, $11)`,
		[approvalId, params.userId, challengeHash, toDbMode(params.mode), codeHash, challengeNumber, meta.ip, meta.userAgent, meta.deviceName, now, expiresAt]
	);

	await publishEvent(pool, { k: 'login_approval', userId: params.userId, approvalId, status: 'pending' });
	void notifyMobileApprovalPush(params.userId, { approvalId, mode: params.mode, desktopLabel: meta.deviceName, challengeNumber });
	return { approvalId, pollSecret, qrToken, mode: params.mode, challengeNumber, expiresAt };
}

export async function listPendingApprovalsForMobile(userId: string): Promise<DeviceLoginApprovalRecord[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT * FROM device_login_approvals
		 WHERE user_id = $1 AND status = 'pending' AND expires_at > $2
		 ORDER BY created_at DESC LIMIT 5`,
		[userId, Date.now()]
	);
	return res.rows.map((r) => mapApprovalRow(r as Record<string, unknown>, true));
}

export async function respondToLoginApproval(params: {
	userId: string;
	approvalId: string;
	decision: 'approve' | 'reject';
	selectedNumber?: number;
	qrToken?: string;
	mobileSessionId?: string | null;
}): Promise<{ ok: true; status: LoginApprovalStatus } | { ok: false; error: string; status: number }> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const now = Date.now();
	const res = await pool.query('SELECT * FROM device_login_approvals WHERE id = $1 AND user_id = $2 LIMIT 1', [
		params.approvalId,
		params.userId,
	]);
	const row = res.rows[0] as Record<string, unknown> | undefined;
	if (!row) return { ok: false, error: 'Login approval request not found.', status: 404 };

	const currentStatus = String(row.status ?? 'pending') as LoginApprovalStatus;
	const expiresAt = Number(row.expiresAt ?? row.expires_at ?? 0);
	if (currentStatus !== 'pending' || expiresAt <= now) {
		return { ok: false, error: 'Login approval request has expired.', status: 410 };
	}

	if (params.decision === 'reject') {
		await pool.query(`UPDATE device_login_approvals SET status = 'rejected', resolved_at = $2 WHERE id = $1`, [params.approvalId, now]);
		await publishEvent(pool, { k: 'login_approval', userId: params.userId, approvalId: params.approvalId, status: 'rejected' });
		return { ok: true, status: 'rejected' };
	}

	const mode = fromDbMode(row.mode);
	if (mode === 'push') {
		const expectedNum = Number(row.numberMatch ?? row.number_match ?? row.challengeNumber ?? row.challenge_number ?? -1);
		if (Number(params.selectedNumber) !== expectedNum) {
			await pool.query(`UPDATE device_login_approvals SET status = 'rejected', resolved_at = $2 WHERE id = $1`, [params.approvalId, now]);
			await publishEvent(pool, { k: 'login_approval', userId: params.userId, approvalId: params.approvalId, status: 'rejected' });
			return { ok: false, error: 'Selected verification number did not match. Sign-in request cancelled.', status: 403 };
		}
	} else if (mode === 'qr') {
		const rawQr = String(params.qrToken || '').trim();
		const expectedHash = String(row.codeHash ?? row.code_hash ?? '');
		if (!rawQr || sha256Hex(rawQr) !== expectedHash) {
			return { ok: false, error: 'Invalid QR verification token.', status: 403 };
		}
	}

	await pool.query(
		`UPDATE device_login_approvals SET status = 'approved', approved_by_session_id = $2, resolved_at = $3 WHERE id = $1 AND status = 'pending'`,
		[params.approvalId, params.mobileSessionId ?? null, now]
	);
	await publishEvent(pool, { k: 'login_approval', userId: params.userId, approvalId: params.approvalId, status: 'approved' });
	return { ok: true, status: 'approved' };
}

export async function verifyDesktopCodeApproval(params: {
	approvalId: string;
	pollSecret: string;
	code: string;
}): Promise<{ ok: true; userId: string } | { ok: false; error: string; status: number }> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const now = Date.now();
	const res = await pool.query('SELECT * FROM device_login_approvals WHERE id = $1 LIMIT 1', [params.approvalId]);
	const row = res.rows[0] as Record<string, unknown> | undefined;
	if (!row) return { ok: false, error: 'Approval request not found.', status: 404 };

	const challengeHash = String(row.challengeHash ?? row.challenge_hash ?? row.secretHash ?? row.secret_hash ?? '');
	if (!params.pollSecret || sha256Hex(params.pollSecret) !== challengeHash) {
		return { ok: false, error: 'Invalid approval session secret.', status: 403 };
	}
	if (String(row.status ?? '') !== 'pending' || Number(row.expiresAt ?? row.expires_at ?? 0) <= now) {
		return { ok: false, error: 'Verification code has expired.', status: 410 };
	}
	if (Number(row.attempts ?? 0) >= MAX_CODE_ATTEMPTS) {
		await pool.query(`UPDATE device_login_approvals SET status = 'rejected', resolved_at = $2 WHERE id = $1`, [params.approvalId, now]);
		return { ok: false, error: 'Too many invalid code attempts.', status: 429 };
	}

	const expectedCodeHash = String(row.codeHash ?? row.code_hash ?? '');
	if (!verifyOtpCode(expectedCodeHash, String(params.code || '').trim())) {
		const inc = await pool.query('UPDATE device_login_approvals SET attempts = attempts + 1 WHERE id = $1 RETURNING attempts', [params.approvalId]);
		if (Number(inc.rows[0]?.attempts ?? 0) >= MAX_CODE_ATTEMPTS) {
			await pool.query(`UPDATE device_login_approvals SET status = 'rejected', resolved_at = $2 WHERE id = $1`, [params.approvalId, now]);
		}
		return { ok: false, error: 'Invalid 6-digit mobile verification code.', status: 400 };
	}

	await pool.query(`UPDATE device_login_approvals SET status = 'approved', resolved_at = $2 WHERE id = $1`, [params.approvalId, now]);
	return { ok: true, userId: String(row.userId ?? row.user_id ?? '') };
}

export async function pollOrClaimApproval(params: {
	approvalId: string;
	pollSecret: string;
}): Promise<{ ok: boolean; status: LoginApprovalStatus; userId?: string }> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const now = Date.now();
	const res = await pool.query('SELECT * FROM device_login_approvals WHERE id = $1 LIMIT 1', [params.approvalId]);
	const row = res.rows[0] as Record<string, unknown> | undefined;
	if (!row) return { ok: false, status: 'expired' };

	const challengeHash = String(row.challengeHash ?? row.challenge_hash ?? row.secretHash ?? row.secret_hash ?? '');
	if (!params.pollSecret || sha256Hex(params.pollSecret) !== challengeHash) {
		return { ok: false, status: 'rejected' };
	}

	const currentStatus = String(row.status ?? 'pending') as LoginApprovalStatus;
	if (Number(row.expiresAt ?? row.expires_at ?? 0) <= now && currentStatus === 'pending') {
		await pool.query(`UPDATE device_login_approvals SET status = 'expired', resolved_at = $2 WHERE id = $1`, [params.approvalId, now]);
		return { ok: true, status: 'expired' };
	}

	if (currentStatus === 'approved') {
		const claimRes = await pool.query(
			`UPDATE device_login_approvals SET status = 'consumed', resolved_at = COALESCE(resolved_at, $2) WHERE id = $1 AND status = 'approved' RETURNING user_id AS "userId"`,
			[params.approvalId, now]
		);
		if (claimRes.rows[0]) {
			return { ok: true, status: 'approved', userId: String(claimRes.rows[0].userId ?? '') };
		}
		return { ok: false, status: 'consumed' };
	}
	return { ok: true, status: currentStatus };
}
