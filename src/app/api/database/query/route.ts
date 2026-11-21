import { NextResponse } from 'next/server';
import { withAudit } from '@/lib/audit/withAudit';
import { getPgPool } from '@/db';
import { requireDatabaseAdmin } from '@/server/databaseAccess';
import { clientAddress } from '@/lib/http';
import { inspectDatabaseSql, maskDatabaseRow, DB_SENSITIVE_COLUMNS } from '@/lib/waf';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { recordSecurityStrike } from '@/db/repositories/security.repo';
import databaseContract from '@/apps/database/database.contract.json';
import { contractErrorResponse } from '@/contracts/helpers';

const MAX_QUERY_LIMIT = databaseContract.limits.maxQueryLimit;
const MAX_QUERY_TIMEOUT_MS = Math.max(100, Math.trunc(Number(databaseContract.limits.maxQueryExecutionTimeoutMs) || 10000));

function detectDangerousQuery(query: string): { dangerous: boolean; reason?: string; command?: string; table?: string } {
	const cleaned = query.replace(/\/\*[\s\S]*?\*\/|--.*$/gm, '').trim();

	// Check DROP TABLE
	if (/\bDROP\s+TABLE\b/i.test(cleaned)) {
		const m = cleaned.match(/\bDROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?["']?([a-zA-Z0-9_]+)["']?/i);
		return {
			dangerous: true,
			reason: 'This query will completely drop one or more tables (DROP TABLE).',
			command: 'DROP TABLE',
			table: m ? m[1] : undefined,
		};
	}

	// Check TRUNCATE
	if (/\bTRUNCATE\s+(?:TABLE\s+)?/i.test(cleaned)) {
		const m = cleaned.match(/\bTRUNCATE\s+(?:TABLE\s+)?["']?([a-zA-Z0-9_]+)["']?/i);
		return {
			dangerous: true,
			reason: 'This query will permanently wipe all data in the table (TRUNCATE).',
			command: 'TRUNCATE',
			table: m ? m[1] : undefined,
		};
	}

	// Check DELETE without WHERE
	if (/\bDELETE\s+FROM\b/i.test(cleaned) && !/\bWHERE\b/i.test(cleaned)) {
		const m = cleaned.match(/\bDELETE\s+FROM\s+["']?([a-zA-Z0-9_]+)["']?/i);
		return {
			dangerous: true,
			reason: 'This DELETE statement has no WHERE clause and will delete ALL rows in the table.',
			command: 'DELETE (Full Table)',
			table: m ? m[1] : undefined,
		};
	}

	// Check UPDATE without WHERE
	if (/\bUPDATE\s+["']?[a-zA-Z0-9_]+["']?\s+SET\b/i.test(cleaned) && !/\bWHERE\b/i.test(cleaned)) {
		const m = cleaned.match(/\bUPDATE\s+["']?([a-zA-Z0-9_]+)["']?\s+SET\b/i);
		return {
			dangerous: true,
			reason: 'This UPDATE statement has no WHERE clause and will modify ALL rows in the table.',
			command: 'UPDATE (Full Table)',
			table: m ? m[1] : undefined,
		};
	}

	return { dangerous: false };
}

async function handlePOST(request: Request) {
	const auth = await requireDatabaseAdmin(request);
	if (!auth.authorized) return auth.response;

	const ip = clientAddress(request);
	const body = await request.json().catch(() => ({}));
	const query = String(body.query || '').trim();
	const bypassSafeMode = Boolean(body.bypassSafeMode);
	const isExplain = Boolean(body.explain);

	if (!query) {
		return contractErrorResponse(databaseContract, 'SQL_SYNTAX_ERROR', 'SQL query cannot be empty.');
	}

	// 0. Zero-Trust SQL Guard: forbid OS primitives, protected table mutations, sensitive column projections, and EXPLAIN transaction breakouts
	const sqlGuard = inspectDatabaseSql(query, { isExplain });
	if (!sqlGuard.allowed) {
		await logSystemEvent({
			service: 'security',
			level: 'ERROR',
			message: `Blocked SQL query (${sqlGuard.reason || 'Security policy'}): ${auth.user.email}`,
			detail: { querySummary: query.slice(0, 200), isExplain },
			userId: auth.user.id,
			ip,
		});
		if (sqlGuard.strikePoints > 0) {
			void recordSecurityStrike({
				ip,
				points: sqlGuard.strikePoints,
				reason: sqlGuard.reason || 'Forbidden SQL query attempt',
				path: '/api/database/query',
				userId: auth.user.id,
			});
		}
		return contractErrorResponse(
			databaseContract,
			'UNAUTHORIZED_MUTATION',
			sqlGuard.reason || 'This SQL query was blocked by security policy.'
		);
	}

	// 1. Safe Mode validation
	if (!bypassSafeMode && !isExplain) {
		const dangerCheck = detectDangerousQuery(query);
		if (dangerCheck.dangerous) {
			return NextResponse.json({
				requiresSafeConfirmation: true,
				safeReason: dangerCheck.reason,
				dangerousCommand: dangerCheck.command,
				targetTable: dangerCheck.table,
			});
		}
	}

	const pool = getPgPool();
	const startTime = performance.now();

	try {
		// 2. Handle EXPLAIN execution inside a strict READ ONLY rolled-back transaction
		if (isExplain) {
			const client = await pool.connect();
			try {
				await client.query('BEGIN TRANSACTION READ ONLY');
				await client.query('SET LOCAL default_transaction_read_only = on');
				await client.query(`SET LOCAL statement_timeout = ${MAX_QUERY_TIMEOUT_MS}`);
				const targetSql = sqlGuard.normalizedExplainTarget || query;
				const explainSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${targetSql}`;
				const result = await client.query(explainSql);
				await client.query('ROLLBACK');
				const durationMs = Math.round((performance.now() - startTime) * 10) / 10;
				const plan = result.rows[0]?.['QUERY PLAN'] || result.rows[0];

				return NextResponse.json({
					success: true,
					isExplain: true,
					command: 'EXPLAIN',
					explainPlan: plan,
					durationMs,
				});
			} finally {
				await client.query('ROLLBACK').catch(() => {});
				client.release();
			}
		}

		// 3. Normal Query execution inside strict READ ONLY transaction with contract statement_timeout
		const client = await pool.connect();
		let result;
		try {
			await client.query('BEGIN TRANSACTION READ ONLY');
			await client.query('SET LOCAL default_transaction_read_only = on');
			await client.query(`SET LOCAL statement_timeout = ${MAX_QUERY_TIMEOUT_MS}`);
			result = await client.query(query);
			await client.query('COMMIT');
		} catch (qErr) {
			await client.query('ROLLBACK').catch(() => {});
			throw qErr;
		} finally {
			client.release();
		}
		const durationMs = Math.round((performance.now() - startTime) * 10) / 10;

		const fields = (result.fields || []).map((f) => ({
			name: f.name,
			dataTypeID: f.dataTypeID,
		}));

		const rawRows = result.rows || [];
		const truncated = rawRows.length > MAX_QUERY_LIMIT;
		// Deny-list and mask sensitive columns from query results, enforcing maxQueryLimit
		const rows = rawRows.slice(0, MAX_QUERY_LIMIT).map((r) => {
			if (!r || typeof r !== 'object') return r;
			const clean = { ...(r as Record<string, unknown>) };
			for (const k of Object.keys(clean)) {
				const lower = k.toLowerCase();
				if (DB_SENSITIVE_COLUMNS.has(lower) || DB_SENSITIVE_COLUMNS.has(lower.replace(/_/g, ''))) {
					clean[k] = '[REDACTED]';
				}
			}
			return maskDatabaseRow(clean);
		});

		await logSystemEvent({
			service: 'database',
			level: 'INFO',
			message: 'Custom SQL query executed',
			detail: {
				command: result.command,
				affectedRow: result.rowCount,
				durationMs,
				truncated,
				querySummary: query.slice(0, 200),
				safeModeBypassed: bypassSafeMode,
			},
			userId: auth.user.id,
			ip,
		});

		return NextResponse.json({
			success: true,
			command: result.command,
			rowCount: result.rowCount ?? rows.length,
			truncated,
			maxQueryLimit: MAX_QUERY_LIMIT,
			fields,
			rows,
			durationMs,
		});
	} catch (error) {
		const durationMs = Math.round((performance.now() - startTime) * 10) / 10;
		const err = error as Error;

		await logSystemEvent({
			service: 'database',
			level: 'WARN',
			message: 'Custom SQL query failed with error',
			detail: {
				error: err.message,
				querySummary: query.slice(0, 200),
				durationMs,
			},
			userId: auth.user.id,
			ip,
		});

		return contractErrorResponse(
			databaseContract,
			'SQL_SYNTAX_ERROR',
			err.message || 'An error occurred while executing the query.',
			{ durationMs }
		);
	}
}

export const POST = withAudit(handlePOST, {
	action: 'database.query.execute',
	target: 'database.query',
});
