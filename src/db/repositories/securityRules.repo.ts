import { getPgPool } from '@/db/core/pool';
import { ensurePostgresInit } from '@/db/core/init';
import type { SecurityRule, RuleAction } from '@/lib/securityRules';
import { randomUUID } from 'node:crypto';
import {
	mapRuleRow,
	refreshRuleCache,
	invalidateRuleCacheMemory,
	getCachedSecurityRulesSync,
	getActiveSecurityRules,
	recordRuleHitInMemory,
	flushRuleHits,
} from './securityRulesCache';

export {
	getCachedSecurityRulesSync,
	getActiveSecurityRules,
	recordRuleHitInMemory,
	flushRuleHits,
	refreshRuleCache,
};

export async function getAllSecurityRules(): Promise<SecurityRule[]> {
	await ensurePostgresInit();
	const pool = getPgPool();
	if (!pool) return [];

	const res = await pool.query(`SELECT * FROM security_rules ORDER BY priority ASC, created_at ASC`);
	return res.rows.map(mapRuleRow);
}

export async function getSecurityRuleById(id: string): Promise<SecurityRule | null> {
	await ensurePostgresInit();
	const pool = getPgPool();
	if (!pool) return null;

	const res = await pool.query(`SELECT * FROM security_rules WHERE id = $1 LIMIT 1`, [id]);
	if (res.rows.length === 0) return null;
	return mapRuleRow(res.rows[0]);
}

export interface CreateSecurityRuleInput {
	name: string;
	description?: string | null;
	enabled?: boolean;
	priority?: number;
	matchMode?: 'all' | 'any';
	conditions: unknown[];
	action: RuleAction;
	actionConfig?: Record<string, unknown>;
	creatorId?: string;
}

export async function saveSecurityRule(input: CreateSecurityRuleInput & { id?: string }): Promise<SecurityRule> {
	if (input.id) {
		const updated = await updateSecurityRule(input.id, input);
		if (updated) return updated;
	}
	return createSecurityRule(input);
}

export async function createSecurityRule(input: CreateSecurityRuleInput): Promise<SecurityRule> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const id = `rule_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
	const now = Date.now();

	const res = await pool.query(
		`INSERT INTO security_rules
			(id, name, description, enabled, priority, match_mode, conditions, action, action_config, hits_count, creator_id, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb, 0, $10, $11, $11)
		 RETURNING *`,
		[
			id,
			input.name.trim(),
			input.description ? input.description.trim() : null,
			input.enabled !== false,
			Number(input.priority ?? 100),
			input.matchMode === 'any' ? 'any' : 'all',
			JSON.stringify(input.conditions || []),
			input.action,
			JSON.stringify(input.actionConfig || {}),
			input.creatorId || null,
			now,
		]
	);

	try {
		await pool.query(`SELECT pg_notify('soc_rule_update', 'reload')`);
	} catch {
		// ignore notification failures
	}
	invalidateRuleCacheMemory();
	await refreshRuleCache();

	return mapRuleRow(res.rows[0]);
}

export interface UpdateSecurityRuleInput {
	name?: string;
	description?: string | null;
	enabled?: boolean;
	priority?: number;
	matchMode?: 'all' | 'any';
	conditions?: unknown[];
	action?: RuleAction;
	actionConfig?: Record<string, unknown>;
}

export async function updateSecurityRule(id: string, input: UpdateSecurityRuleInput): Promise<SecurityRule | null> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const existing = await getSecurityRuleById(id);
	if (!existing) return null;

	const now = Date.now();
	const updated = {
		name: input.name !== undefined ? input.name.trim() : existing.name,
		description: input.description !== undefined ? input.description?.trim() || null : existing.description,
		enabled: input.enabled !== undefined ? Boolean(input.enabled) : existing.enabled,
		priority: input.priority !== undefined ? Number(input.priority) : existing.priority,
		matchMode: input.matchMode !== undefined ? (input.matchMode === 'any' ? 'any' : 'all') : existing.matchMode,
		conditions: input.conditions !== undefined ? input.conditions : existing.conditions,
		action: input.action !== undefined ? input.action : existing.action,
		actionConfig: input.actionConfig !== undefined ? input.actionConfig : existing.actionConfig,
	};

	const res = await pool.query(
		`UPDATE security_rules SET
			name = $2, description = $3, enabled = $4, priority = $5, match_mode = $6,
			conditions = $7::jsonb, action = $8, action_config = $9::jsonb, updated_at = $10
		 WHERE id = $1
		 RETURNING *`,
		[
			id,
			updated.name,
			updated.description,
			updated.enabled,
			updated.priority,
			updated.matchMode,
			JSON.stringify(updated.conditions),
			updated.action,
			JSON.stringify(updated.actionConfig),
			now,
		]
	);

	if (res.rows.length === 0) return null;

	try {
		await pool.query(`SELECT pg_notify('soc_rule_update', 'reload')`);
	} catch {
		// ignore
	}
	invalidateRuleCacheMemory();
	await refreshRuleCache();

	return mapRuleRow(res.rows[0]);
}

export async function deleteSecurityRule(id: string): Promise<boolean> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const res = await pool.query(`DELETE FROM security_rules WHERE id = $1`, [id]);

	try {
		await pool.query(`SELECT pg_notify('soc_rule_update', 'reload')`);
	} catch {
		// ignore
	}
	invalidateRuleCacheMemory();
	await refreshRuleCache();

	return (res.rowCount ?? 0) > 0;
}
