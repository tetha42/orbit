import { NextResponse } from 'next/server';
import { withTransaction, getPgPool } from '@/db';
import { requireDatabaseAdmin } from '@/server/databaseAccess';
import { clientAddress } from '@/lib/http';
import { InvalidBodyError, PayloadTooLargeError, readBoundedJson } from '@/lib/httpBodyGuard';
import { logSystemEvent } from '@/db/repositories/logs.repo';

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

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

interface ImportBody {
	table?: string;
	rows?: Record<string, unknown>[];
	conflictStrategy?: 'error' | 'upsert' | 'skip';
}

export async function POST(request: Request) {
	const auth = await requireDatabaseAdmin(request);
	if (!auth.authorized) return auth.response;

	if (process.env.ORBIT_DB_STUDIO_WRITE !== '1') {
		return NextResponse.json(
			{
				error: 'Direct database import is disabled. Set ORBIT_DB_STUDIO_WRITE=1 break-glass flag in your server environment to enable writes.',
				code: 'DB_STUDIO_READ_ONLY',
			},
			{ status: 403 }
		);
	}

	const ip = clientAddress(request);
	let body: ImportBody;
	try {
		body = await readBoundedJson<ImportBody>(request, MAX_IMPORT_BYTES);
	} catch (error) {
		if (error instanceof PayloadTooLargeError) {
			return NextResponse.json({ error: 'Import payload exceeds the 5 MB limit.' }, { status: 413 });
		}
		if (error instanceof InvalidBodyError) {
			return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
		}
		throw error;
	}
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return NextResponse.json({ error: 'Import payload must be a JSON object.' }, { status: 400 });
	}
	const table = String(body.table || '').trim();
	const rows = Array.isArray(body.rows) ? body.rows : [];
	const conflictStrategy = body.conflictStrategy || 'error';

	if (!table || !/^[a-zA-Z0-9_]+$/.test(table)) {
		return NextResponse.json({ error: 'Invalid table name.' }, { status: 400 });
	}

	const lowerTable = table.toLowerCase();
	if (PROTECTED_TABLES.has(lowerTable)) {
		return NextResponse.json(
			{ error: 'Bulk data cannot be imported into security and audit tables.' },
			{ status: 403 }
		);
	}

	if (rows.length === 0) {
		return NextResponse.json({ error: 'No rows found to import.' }, { status: 400 });
	}

	if (rows.length > 2000) {
		return NextResponse.json({ error: 'At most 2000 rows can be imported at once.' }, { status: 400 });
	}
	if (rows.some((r) => typeof r !== 'object' || r === null || Array.isArray(r))) {
		return NextResponse.json({ error: 'Each imported row must be a JSON object.' }, { status: 400 });
	}

	const pool = getPgPool();

	try {
		// 1. Get column list and primary keys
		const colRes = await pool.query<{ column_name?: string; columnName?: string }>(`
			SELECT column_name
			FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = $1;
		`, [table]);

		if (colRes.rows.length === 0) {
			return NextResponse.json({ error: 'Target table not found.' }, { status: 404 });
		}

		const validCols = new Set(
			colRes.rows
				.map((r) => String(r.columnName ?? r.column_name ?? '').trim())
				.filter(Boolean)
		);

		const pkRes = await pool.query<{ column_name?: string; columnName?: string }>(`
			SELECT kcu.column_name
			FROM information_schema.table_constraints tc
			JOIN information_schema.key_column_usage kcu
				ON tc.constraint_name = kcu.constraint_name
				AND tc.table_schema = kcu.table_schema
				AND tc.table_name = kcu.table_name
			WHERE tc.constraint_type = 'PRIMARY KEY'
				AND tc.table_schema = 'public'
				AND tc.table_name = $1
			ORDER BY kcu.ordinal_position ASC;
		`, [table]);

		const primaryKeys = pkRes.rows
			.map((r) => String(r.columnName ?? r.column_name ?? '').trim())
			.filter(Boolean);
		const pkCol = primaryKeys[0];

		// 2. Perform batch insert inside a single transaction
		let affectedCount = 0;

		await withTransaction(async (client) => {
			for (const r of rows) {
				if (lowerTable === 'system_settings' && PROTECTED_SETTINGS_KEYS.has(String(r.key ?? '').toLowerCase())) {
					continue;
				}
				const cols: string[] = [];
				const placeholders: string[] = [];
				const params: unknown[] = [];

				for (const [key, val] of Object.entries(r)) {
					if (!validCols.has(key)) continue;
					if (SENSITIVE_COLUMNS.has(key.toLowerCase())) continue;
					if (val === undefined) continue;

					cols.push(`"${key}"`);
					params.push(val);
					placeholders.push(`$${params.length}`);
				}

				if (cols.length === 0) continue;

				let sql = `INSERT INTO "${table}" (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`;

				if (pkCol && conflictStrategy === 'skip') {
					sql += ` ON CONFLICT ("${pkCol}") DO NOTHING`;
				} else if (pkCol && conflictStrategy === 'upsert') {
					const updateParts = cols
						.filter((c) => c !== `"${pkCol}"`)
						.map((c) => `${c} = EXCLUDED.${c}`);
					if (updateParts.length > 0) {
						sql += ` ON CONFLICT ("${pkCol}") DO UPDATE SET ${updateParts.join(', ')}`;
					} else {
						sql += ` ON CONFLICT ("${pkCol}") DO NOTHING`;
					}
				}

				const res = await client.query(sql, params);
				affectedCount += (res.rowCount || 0);
			}
		});

		await logSystemEvent({
			service: 'database',
			level: 'WARN',
			message: `Bulk data imported: ${table}`,
			detail: {
				table: table,
				rowCount: rows.length,
				affected: affectedCount,
				strategy: conflictStrategy,
			},
			userId: auth.user.id,
			ip,
		});

		return NextResponse.json({
			success: true,
			message: `Successfully processed ${affectedCount} row(s) (${table}).`,
			affectedCount,
		});
	} catch (error) {
		console.error(`Import error (${table}):`, error);
		return NextResponse.json(
			{ error: 'A database error occurred during import.' },
			{ status: 500 }
		);
	}
}
