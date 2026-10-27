import { getPgPool, ensurePostgresInit, withTransaction } from '@/db';
import { logAuditEvent, type AuditContext } from '@/db/audit';
import { publishEventQuiet } from '@/db/olaylar';
import { uyeHedefAdi, uyeOzeti } from '@/lib/audit';
import { encryptSecret, isEncrypted } from '@/lib/auth/secretBox';
import type { User } from '@/db/schema';

export async function updateUserPassword(
	userId: string,
	passwordHash: string,
	invalidateSession = false
): Promise<void> {
	await ensurePostgresInit();
	if (invalidateSession) {
		await getPgPool().query(
			'UPDATE users SET password_hash = $1, session_token = NULL, session_expires_at = NULL WHERE id = $2',
			[passwordHash, userId]
		);
		await publishEventQuiet(getPgPool(), { k: 'oturum', userId });
		return;
	}
	await getPgPool().query('UPDATE users SET password_hash = $1 WHERE id = $2', [
		passwordHash,
		userId,
	]);
}

export async function setUserTotpSecret(userId: string, secret: string): Promise<void> {
	await ensurePostgresInit();
	const encryptedSecret = isEncrypted(secret) ? secret : await encryptSecret(secret);
	await getPgPool().query(
		'UPDATE users SET totp_secret = $1, totp_enabled = 0, totp_confirmed_at = NULL, totp_last_step = NULL WHERE id = $2',
		[encryptedSecret, userId]
	);
}

export async function enableUserTotp(
	userId: string,
	recoveryCodeHashes: string[]
): Promise<void> {
	await ensurePostgresInit();
	await getPgPool().query(
		'UPDATE users SET totp_enabled = 1, totp_recovery_codes = $1, totp_confirmed_at = $2, totp_last_step = NULL WHERE id = $3',
		[JSON.stringify(recoveryCodeHashes), Date.now(), userId]
	);
}

export async function disableUserTotp(userId: string, denetim: AuditContext): Promise<void> {
	await withTransaction(async (client) => {
		const res = await client.query(
			'UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_recovery_codes = NULL, totp_confirmed_at = NULL, totp_last_step = NULL WHERE id = $1 RETURNING first_name AS ad, last_name AS soyad, email AS email',
			[userId]
		);
		const u = res.rows[0];
		if (!u) return;
		await logAuditEvent(client, denetim, {
			islem: 'guvenlik.2fa_kapat',
			hedefTur: 'uye',
			hedefId: userId,
			hedefAd: uyeHedefAdi(u),
			onceki: { ...uyeOzeti(u), ikiAdim: 'acik' },
			sonraki: { ...uyeOzeti(u), ikiAdim: 'kapali' },
		});
	});
}

export async function setUserTotpStep(userId: string, timeStep: number): Promise<void> {
	await ensurePostgresInit();
	await getPgPool().query('UPDATE users SET totp_last_step = $1 WHERE id = $2', [
		timeStep,
		userId,
	]);
}

export async function setUserRecoveryCodes(
	userId: string,
	recoveryCodeHashes: string[]
): Promise<void> {
	await ensurePostgresInit();
	await getPgPool().query('UPDATE users SET totp_recovery_codes = $1 WHERE id = $2', [
		JSON.stringify(recoveryCodeHashes),
		userId,
	]);
}

export function parseRecoveryCodes(user: User | null): string[] {
	if (!user?.totpRecoveryCodes) return [];
	try {
		const parsed = JSON.parse(user.totpRecoveryCodes);
		return Array.isArray(parsed) ? parsed.filter((c) => typeof c === 'string') : [];
	} catch {
		return [];
	}
}
