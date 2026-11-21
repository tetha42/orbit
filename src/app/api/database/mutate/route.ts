import { NextResponse } from 'next/server';
import { withTransaction } from '@/db';
import { requireDatabaseAdmin } from '@/server/databaseAccess';
import { clientAddress } from '@/lib/http';
import { logSystemEvent } from '@/db/repositories/logs.repo';

const SENSITIVE_COLUMNS = new Set([
	'password_hash',
	'passwordhash',
	'totp_secret',
	'totpsecret',
	'session_token',
	'sessiontoken',
	'totp_recovery_codes',
	'totprecoverycodes',
	'secret_hash',
	'secrethash',
	'smtp_pass',
]);

const PROTECTED_TABLES = new Set([
	'system_logs',
	'audit_logs',
	'security_blocks',
	'system_settings',
	'webauthn_credentials',
	'verification_tokens',
	'oauth_clients',
]);
const PROTECTED_SETTINGS_KEYS = new Set(['smtp_pass', 'soc_lockdown_mode', 'soc_lockdown_reason']);

interface UpdateItem {
	pk: { col: string; val: unknown };
	changes: Record<string, unknown>;
	previous?: Record<string, unknown>;
}

interface DeleteItem {
	col: string;
	val: unknown;
}

interface MutateBody {
	table?: string;
	updates?: UpdateItem[];
	inserts?: Record<string, unknown>[];
	deletes?: DeleteItem[];
}

export async function POST(request: Request) {
	const auth = await requireDatabaseAdmin(request);
	if (!auth.authorized) return auth.response;

	if (process.env.ORBIT_DB_STUDIO_WRITE !== '1') {
		return NextResponse.json(
			{
				error: 'Direct database mutation is disabled. Set ORBIT_DB_STUDIO_WRITE=1 break-glass flag in your server environment to enable writes.',
				code: 'DB_STUDIO_READ_ONLY',
			},
			{ status: 403 }
		);
	}

	const ip = clientAddress(request);
	const body = (await request.json().catch(() => ({}))) as MutateBody;
	const table = String(body.table || '').trim();
	const updates = Array.isArray(body.updates) ? body.updates : [];
	const inserts = Array.isArray(body.inserts) ? body.inserts : [];
	const deletes = Array.isArray(body.deletes) ? body.deletes : [];

	if (!table || !/^[a-zA-Z0-9_]+$/.test(table)) {
		return NextResponse.json({ error: 'Invalid table name.' }, { status: 400 });
	}

	const lowerTable = table.toLowerCase();
	if (PROTECTED_TABLES.has(lowerTable)) {
		return NextResponse.json(
			{ error: 'Security and audit tables cannot be modified or deleted directly.' },
			{ status: 403 }
		);
	}

	if (updates.length === 0 && inserts.length === 0 && deletes.length === 0) {
		return NextResponse.json({ error: 'No changes provided to apply.' }, { status: 400 });
	}

	try {
		await withTransaction(async (client) => {
			const now = Date.now();
			const actorName = `${auth.user.name} ${auth.user.surname}`.trim();

			// 1. Process Updates
			for (const u of updates) {
				const pkCol = String(u.pk.col || '').trim();
				if (!/^[a-zA-Z0-9_]+$/.test(pkCol)) throw new Error('Invalid primary key column.');
				if (lowerTable === 'system_settings' && PROTECTED_SETTINGS_KEYS.has(String(u.pk.val ?? '').toLowerCase())) {
					continue;
				}

				const setClauses: string[] = [];
				const setParams: unknown[] = [];

				for (const [key, val] of Object.entries(u.changes)) {
					if (!/^[a-zA-Z0-9_]+$/.test(key)) continue;
					if (SENSITIVE_COLUMNS.has(key.toLowerCase())) continue; // Skip sensitive fields
					if (lowerTable === 'system_settings' && key.toLowerCase() === 'key' && PROTECTED_SETTINGS_KEYS.has(String(val ?? '').toLowerCase())) {
						continue;
					}
					setParams.push(val);
					setClauses.push(`"${key}" = $${setParams.length}`);
				}

				if (setClauses.length > 0) {
					setParams.push(u.pk.val);
					const sql = `UPDATE "${table}" SET ${setClauses.join(', ')} WHERE "${pkCol}" = $${setParams.length}`;
					await client.query(sql, setParams);

					// Record audit diff in audit_logs if table exists
					try {
						const auditId = `db_${now}_${Math.random().toString(36).slice(2, 8)}`;
						await client.query(
							`INSERT INTO audit_logs (id, timestamp, actor_id, actor_name, action, target_type, target_id, target_name, before_state, after_state, ip)
							 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
							[
								auditId,
								now,
								auth.user.id,
								actorName,
								'db_cell_update',
								'database_table',
								table,
								String(u.pk.val),
								JSON.stringify({ pkCol: u.pk.col, pkVal: u.pk.val, ...(u.previous || {}) }),
								JSON.stringify({ pkCol: u.pk.col, pkVal: u.pk.val, ...u.changes }),
								ip,
							]
						);
					} catch {
						// Fail gracefully if audit schema is not initialized yet
					}
				}
			}

			// 2. Process Inserts
			for (const row of inserts) {
				if (lowerTable === 'system_settings' && PROTECTED_SETTINGS_KEYS.has(String(row.key ?? '').toLowerCase())) {
					continue;
				}
				const cols: string[] = [];
				const placeholders: string[] = [];
				const params: unknown[] = [];

				for (const [key, val] of Object.entries(row)) {
					if (!/^[a-zA-Z0-9_]+$/.test(key)) continue;
					if (SENSITIVE_COLUMNS.has(key.toLowerCase())) continue; // Skip sensitive fields
					if (val === undefined) continue;
					cols.push(`"${key}"`);
					params.push(val);
					placeholders.push(`$${params.length}`);
				}

				if (cols.length > 0) {
					const sql = `INSERT INTO "${table}" (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`;
					await client.query(sql, params);
				}
			}

			// 3. Process Deletes
			for (const d of deletes) {
				const pkCol = String(d.col || '').trim();
				if (!/^[a-zA-Z0-9_]+$/.test(pkCol)) throw new Error('Invalid delete target.');
				if (lowerTable === 'system_settings' && PROTECTED_SETTINGS_KEYS.has(String(d.val ?? '').toLowerCase())) {
					continue;
				}

				const sql = `DELETE FROM "${table}" WHERE "${pkCol}" = $1`;
				await client.query(sql, [d.val]);
			}
		});

		// 4. Log the mutation to audit trail
		await logSystemEvent({
			service: 'database',
			level: 'WARN',
			message: `Bulk data mutation performed on table "${table}"`,
			detail: {
				table: table,
				updatedCount: updates.length,
				updatedIds: updates.map((u) => u.pk.val).slice(0, 50),
				addedCount: inserts.length,
				deletedCount: deletes.length,
				deletedIds: deletes.map((d) => d.val).slice(0, 50),
			},
			userId: auth.user.id,
			ip,
		});

		return NextResponse.json({
			success: true,
			message: `Saved ${updates.length} update(s), ${inserts.length} insert(s), and ${deletes.length} delete(s).`,
		});
	} catch (error) {
		console.error(`API /api/database/mutate error on "${table}":`, error);
		const err = error as Error;
		return NextResponse.json(
			{ error: `Database operation failed: ${err?.message || 'Unknown error'}` },
			{ status: 500 }
		);
	}
}
