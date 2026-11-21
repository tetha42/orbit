import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildQueries, seedSyntheticRows } from './db-explain-queries.mjs';
import { registerTsAliasHooks } from './ts-loader.mjs';

registerTsAliasHooks();

const ROOT = process.cwd();
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const jsonMode = flags.has('--json');

function getFlagValue(name, fallback = '') {
	const eq = args.find((a) => a.startsWith(`${name}=`));
	if (eq) return eq.slice(name.length + 1);
	const idx = args.indexOf(name);
	if (idx >= 0 && idx + 1 < args.length && !args[idx + 1].startsWith('--')) return args[idx + 1];
	return fallback;
}

function collectPlanNodes(node, out = []) {
	if (!node || typeof node !== 'object') return out;
	out.push({
		nodeType: node['Node Type'] || 'Unknown',
		relation: node['Relation Name'] || null,
		indexName: node['Index Name'] || null,
		actualRows: Number(node['Actual Rows'] ?? 0),
		sharedHitBlocks: Number(node['Shared Hit Blocks'] ?? 0),
		sharedReadBlocks: Number(node['Shared Read Blocks'] ?? 0),
	});
	if (Array.isArray(node.Plans)) {
		for (const child of node.Plans) collectPlanNodes(child, out);
	}
	return out;
}

async function main() {
	const { checkDatabaseStatus, getPgPool } = await import('@/db/core/pool');
	const { ensurePostgresInit } = await import('@/db/core/init');
	const { stopListener } = await import('@/db/events');

	const status = await checkDatabaseStatus();
	if (!status.connected) {
		const msg = `Database unreachable (${status.error || 'not configured'}).`;
		if (jsonMode) console.error(JSON.stringify({ ok: false, error: msg }, null, 2));
		else console.error(`db-explain: FAILED — ${msg}`);
		process.exit(1);
	}

	await ensurePostgresInit();
	const pool = getPgPool();
	const rawRows = Number(getFlagValue('--rows', '0'));
	const rowsArg = Number.isFinite(rawRows) ? Math.max(0, Math.min(500_000, Math.trunc(rawRows))) : 0;
	const strictMode = flags.has('--strict');
	const saveBaseline = flags.has('--save-baseline') || flags.has('--baseline');
	const compareMode = flags.has('--compare');
	const baselinePath = resolve(ROOT, getFlagValue('--baseline-file', 'scripts/db-explain-baseline.json'));

	const now = Date.now();
	const ctx = {
		now,
		userId: '__explain_target_user__',
		email: 'explain-target@orbit.local',
		sessionToken: 'explain-target-session-token',
		serviceName: '__explain_service__',
		roomId: '__explain_target_room__',
		teamId: '__explain_target_team__',
	};

	const client = await pool.connect();
	let seeded = null;
	const plans = [];

	try {
		await client.query('BEGIN');
		if (rowsArg > 0) {
			seeded = await seedSyntheticRows(client, rowsArg, ctx);
		} else {
			const sampleUser = await client.query('SELECT id, email FROM users LIMIT 1');
			if (sampleUser.rows[0]) {
				ctx.userId = String(sampleUser.rows[0].id);
				ctx.email = String(sampleUser.rows[0].email);
			}
			const sampleRoom = await client.query('SELECT id FROM chat_rooms LIMIT 1');
			if (sampleRoom.rows[0]) ctx.roomId = String(sampleRoom.rows[0].id);
			ctx.serviceName = 'security';
		}

		for (const q of buildQueries(ctx)) {
			const res = await client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${q.sql}`, q.params);
			const rawPlan = res.rows[0]?.['QUERY PLAN']?.[0];
			const nodes = collectPlanNodes(rawPlan?.Plan);
			const indexNodes = nodes.filter((n) => n.indexName);
			const seqNodes = nodes.filter((n) => n.nodeType === 'Seq Scan');
			plans.push({
				id: q.id,
				expectedIndex: q.expectedIndex,
				planningTimeMs: Number((rawPlan?.['Planning Time'] ?? 0).toFixed(3)),
				executionTimeMs: Number((rawPlan?.['Execution Time'] ?? 0).toFixed(3)),
				actualRows: Number(rawPlan?.Plan?.['Actual Rows'] ?? 0),
				sharedHitBlocks: Number(rawPlan?.Plan?.['Shared Hit Blocks'] ?? 0),
				sharedReadBlocks: Number(rawPlan?.Plan?.['Shared Read Blocks'] ?? 0),
				usedIndexes: Array.from(new Set(indexNodes.map((n) => n.indexName))),
				seqScans: seqNodes.map((n) => n.relation),
				usesIndex: indexNodes.length > 0,
			});
		}

		await client.query('ROLLBACK');
	} finally {
		await client.query('ROLLBACK').catch(() => {});
		client.release();
		await stopListener().catch(() => {});
		await pool.end().catch(() => {});
	}

	const violations = [];
	const strictEvaluated = strictMode && rowsArg >= 50_000;
	if (strictEvaluated) {
		for (const p of plans) {
			if (!p.usesIndex) {
				violations.push(`${p.id}: fell back to sequential scan (${p.seqScans.join(', ') || 'none'}) without index`);
			}
		}
	}

	let comparison = null;
	if (compareMode) {
		const compareViolations = [];
		if (!existsSync(baselinePath)) {
			compareViolations.push(`Baseline file not found: ${baselinePath}`);
			comparison = { ok: false, diffs: [] };
		} else {
			const prev = JSON.parse(readFileSync(baselinePath, 'utf8'));
			const diffs = [];
			for (const p of plans) {
				const old = prev.plans?.find((x) => x.id === p.id);
				if (!old) continue;
				const limitMs = Math.max(old.executionTimeMs * 3.0, old.executionTimeMs + 5);
				diffs.push({
					id: p.id,
					prevMs: old.executionTimeMs,
					curMs: p.executionTimeMs,
					prevIndex: old.usedIndexes,
					curIndex: p.usedIndexes,
				});
				if (p.executionTimeMs > limitMs) {
					compareViolations.push(`${p.id} regressed: ${old.executionTimeMs}ms -> ${p.executionTimeMs}ms (limit ${limitMs.toFixed(2)}ms)`);
				}
				if (old.usesIndex && !p.usesIndex && rowsArg >= 10_000) {
					compareViolations.push(`${p.id} lost index usage (was ${old.usedIndexes.join(',')})`);
				}
			}
			comparison = { ok: compareViolations.length === 0, diffs };
		}
		violations.push(...compareViolations);
	}

	if (saveBaseline) {
		mkdirSync(dirname(baselinePath), { recursive: true });
		writeFileSync(
			baselinePath,
			`${JSON.stringify({ generatedAt: new Date().toISOString(), rows: rowsArg, seeded, plans }, null, 2)}\n`,
			'utf8'
		);
	}

	const ok = violations.length === 0;
	const report = {
		ok,
		database: status.databaseName,
		syntheticRows: rowsArg,
		strictEvaluated,
		seeded,
		plans,
		baselineSaved: saveBaseline ? baselinePath : null,
		comparison,
		violations,
	};

	if (jsonMode) {
		console.log(JSON.stringify(report, null, 2));
	} else {
		console.log(`db-explain: db=${status.databaseName} (${plans.length} queries, syntheticRows=${rowsArg})`);
		for (const p of plans) {
			const idxInfo = p.usedIndexes.length ? `idx=${p.usedIndexes.join(',')}` : `seq=${p.seqScans.join(',') || 'none'}`;
			console.log(`  ${p.id.padEnd(28)} exec=${p.executionTimeMs.toFixed(3)}ms plan=${p.planningTimeMs.toFixed(3)}ms hit=${p.sharedHitBlocks} ${idxInfo}`);
		}
		if (saveBaseline) console.log(`  Saved DB explain baseline -> ${baselinePath}`);
		if (!ok) {
			console.error('db-explain: FAILED');
			for (const v of violations) console.error(`  - ${v}`);
		} else {
			console.log('db-explain: PASS');
		}
	}
	if (!ok) process.exit(1);
}

main().catch((err) => {
	console.error('db-explain error:', err instanceof Error ? err.message : err);
	process.exit(1);
});
