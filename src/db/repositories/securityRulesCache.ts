import { Client } from 'pg';
import { getPgPool } from '@/db/core/pool';
import { ensurePostgresInit } from '@/db/core/init';
import { CONFIG } from '@/server/config';
import type { SecurityRule, RuleAction, SecurityRuleCondition } from '@/lib/securityRules';

interface RuleCacheGlobal {
	__cachedSecurityRules?: SecurityRule[];
	__lastSecurityRulesFetch?: number;
	__securityRulesRetryAfter?: number;
	__securityRulesListenerInitialized?: boolean;
	__securityRulesClient?: Client | null;
	__ruleHitAggregator?: Map<string, { count: number; lastHit: number }>;
	__ruleHitFlushTimer?: NodeJS.Timeout | null;
}
const g = globalThis as typeof globalThis & RuleCacheGlobal;

if (!g.__ruleHitAggregator) {
	g.__ruleHitAggregator = new Map();
}

export function mapRuleRow(row: Record<string, unknown>): SecurityRule {
	let conditions: SecurityRuleCondition[] = [];
	try {
		conditions = typeof row.conditions === 'string' ? JSON.parse(row.conditions) : ((row.conditions as SecurityRuleCondition[]) || []);
	} catch {
		conditions = [];
	}

	let actionConfig: Record<string, unknown> = {};
	try {
		actionConfig = typeof row.action_config === 'string' ? JSON.parse(row.action_config) : ((row.action_config as Record<string, unknown>) || {});
	} catch {
		actionConfig = {};
	}

	return {
		id: String(row.id),
		name: String(row.name),
		description: row.description ? String(row.description) : null,
		enabled: Boolean(row.enabled),
		priority: Number(row.priority ?? 100),
		matchMode: row.match_mode === 'any' ? 'any' : 'all',
		conditions,
		action: row.action as RuleAction,
		actionConfig,
		hitsCount: Number(row.hits_count ?? 0),
		lastHitAt: row.last_hit_at ? Number(row.last_hit_at) : null,
		creatorId: row.creator_id ? String(row.creator_id) : null,
		createdAt: Number(row.created_at ?? Date.now()),
		updatedAt: Number(row.updated_at ?? Date.now()),
	};
}

type SecurityRulesCacheExt = typeof globalThis & {
	__securityRulesClosing?: boolean;
	__securityRulesConnectPromise?: Promise<void> | null;
	__securityRulesRefreshPromise?: Promise<SecurityRule[]> | null;
};

export function ensureRuleCacheListener() {
	const ext = globalThis as SecurityRulesCacheExt;
	if (g.__securityRulesListenerInitialized || ext.__securityRulesClosing) return;
	const conn = process.env.DATABASE_URL || CONFIG.database.url;
	if (!conn) return;
	g.__securityRulesListenerInitialized = true;

	const client = new Client({ connectionString: conn });
	g.__securityRulesClient = client;
	const connectPromise = client
		.connect()
		.then(async () => {
			if (ext.__securityRulesClosing) {
				await client.end().catch(() => {});
				return;
			}
			await client.query('LISTEN soc_rule_update').catch(() => {});
		})
		.catch(() => {
			g.__securityRulesListenerInitialized = false;
			if (g.__securityRulesClient === client) g.__securityRulesClient = null;
		})
		.finally(() => {
			if (ext.__securityRulesConnectPromise === connectPromise) {
				ext.__securityRulesConnectPromise = null;
			}
		});
	ext.__securityRulesConnectPromise = connectPromise;

	client.on('notification', (msg) => {
		if (msg.channel === 'soc_rule_update') {
			g.__lastSecurityRulesFetch = 0;
			g.__securityRulesRetryAfter = 0;
			void refreshRuleCache().catch(() => {
				// Offline backoff handled in runRefreshRuleCache.
			});
		}
	});

	client.on('error', () => {
		g.__securityRulesListenerInitialized = false;
		if (g.__securityRulesClient === client) g.__securityRulesClient = null;
	});
}

export async function closeSecurityRulesListener(): Promise<void> {
	const ext = globalThis as SecurityRulesCacheExt;
	ext.__securityRulesClosing = true;
	await Promise.allSettled([
		ext.__securityRulesConnectPromise,
		ext.__securityRulesRefreshPromise,
	]);
	const client = g.__securityRulesClient;
	g.__securityRulesClient = null;
	g.__securityRulesListenerInitialized = false;
	if (client) {
		client.removeAllListeners();
		await client.end().catch(() => {});
	}
}

export function refreshRuleCache(): Promise<SecurityRule[]> {
	const ext = globalThis as SecurityRulesCacheExt;
	if (ext.__securityRulesClosing) {
		return Promise.resolve(g.__cachedSecurityRules || []);
	}
	if (ext.__securityRulesRefreshPromise) {
		return ext.__securityRulesRefreshPromise;
	}
	const pending = runRefreshRuleCache().finally(() => {
		if (ext.__securityRulesRefreshPromise === pending) {
			ext.__securityRulesRefreshPromise = null;
		}
	});
	ext.__securityRulesRefreshPromise = pending;
	return pending;
}

async function runRefreshRuleCache(): Promise<SecurityRule[]> {
	const ext = globalThis as SecurityRulesCacheExt;
	if (ext.__securityRulesClosing) return g.__cachedSecurityRules || [];

	try {
		await ensurePostgresInit();
		if (ext.__securityRulesClosing) return g.__cachedSecurityRules || [];
		const pool = getPgPool();
		if (!pool) return g.__cachedSecurityRules || [];

		const res = await pool.query(
			`SELECT * FROM security_rules WHERE enabled = true ORDER BY priority ASC, created_at ASC`
		);
		const rules = res.rows.map(mapRuleRow);
		g.__cachedSecurityRules = rules;
		g.__lastSecurityRulesFetch = Date.now();
		g.__securityRulesRetryAfter = 0;
		return rules;
	} catch {
		g.__securityRulesRetryAfter = Date.now() + 10_000;
		return g.__cachedSecurityRules || [];
	}
}

export function invalidateRuleCacheMemory() {
	g.__lastSecurityRulesFetch = 0;
	g.__securityRulesRetryAfter = 0;
}

export function getCachedSecurityRulesSync(): SecurityRule[] {
	const ext = globalThis as SecurityRulesCacheExt;
	if (ext.__securityRulesClosing) return g.__cachedSecurityRules || [];
	ensureRuleCacheListener();
	const now = Date.now();
	if (
		(!g.__cachedSecurityRules || now - (g.__lastSecurityRulesFetch || 0) > 1000) &&
		now >= (g.__securityRulesRetryAfter || 0)
	) {
		g.__lastSecurityRulesFetch = now;
		void refreshRuleCache().catch(() => {
			// Offline backoff handled in runRefreshRuleCache.
		});
	}
	return g.__cachedSecurityRules || [];
}

export async function getActiveSecurityRules(): Promise<SecurityRule[]> {
	ensureRuleCacheListener();
	const now = Date.now();
	if (g.__cachedSecurityRules && g.__lastSecurityRulesFetch && (now - g.__lastSecurityRulesFetch < 5000)) {
		return g.__cachedSecurityRules;
	}
	return refreshRuleCache();
}

export function recordRuleHitInMemory(ruleId: string): void {
	if (!g.__ruleHitAggregator) g.__ruleHitAggregator = new Map();
	const now = Date.now();
	const existing = g.__ruleHitAggregator.get(ruleId) || { count: 0, lastHit: now };
	existing.count += 1;
	existing.lastHit = now;
	g.__ruleHitAggregator.set(ruleId, existing);

	if (!g.__ruleHitFlushTimer) {
		g.__ruleHitFlushTimer = setTimeout(() => {
			g.__ruleHitFlushTimer = null;
			void flushRuleHits().catch(() => {
				// Ignore offline DB errors while flushing rule hit counters.
			});
		}, 1000);
		g.__ruleHitFlushTimer.unref?.();
	}
}

export async function flushRuleHits(): Promise<void> {
	if (!g.__ruleHitAggregator || g.__ruleHitAggregator.size === 0) return;
	const snapshot = Array.from(g.__ruleHitAggregator.entries());
	g.__ruleHitAggregator.clear();

	let pool;
	try {
		pool = getPgPool();
	} catch {
		return;
	}
	if (!pool) return;

	for (const [id, data] of snapshot) {
		try {
			await pool.query(
				`UPDATE security_rules
				 SET hits_count = hits_count + $1, last_hit_at = GREATEST(COALESCE(last_hit_at, 0), $2)
				 WHERE id = $3`,
				[data.count, data.lastHit, id]
			);
		} catch {
			// ignore flush failure
		}
	}
}
