/**
 * Orbit Community OS — Pure Security Rules Engine.
 *
 * Zero-dependency pure file (passes scripts/check-pure.mjs).
 * Evaluates dynamic security firewall rules in <50µs.
 */

import { isIpInCidr, ipv4ToNumber, ipv6ToBigInt } from './securityCidr.ts';

export { isIpInCidr, ipv4ToNumber, ipv6ToBigInt };

export type RuleAction = 'block' | 'rate_limit' | 'score' | 'honeypot' | 'allow';
export type MatchMode = 'all' | 'any';
export type ConditionType = 'ip_cidr' | 'path_pattern' | 'method' | 'header' | 'payload_regex';

export interface SecurityRuleCondition {
	type: ConditionType;
	operator?: 'equals' | 'not_equals' | 'matches' | 'contains' | 'starts_with' | 'exists';
	field?: string;
	value: string;
}

export interface SecurityRule {
	id: string;
	name: string;
	description?: string | null;
	enabled: boolean;
	priority: number;
	matchMode: MatchMode;
	conditions: SecurityRuleCondition[];
	action: RuleAction;
	actionConfig?: Record<string, unknown>;
	hitsCount?: number;
	lastHitAt?: number | null;
	creatorId?: string | null;
	createdAt?: number;
	updatedAt?: number;
}

export interface RequestEvaluationContext {
	ip: string;
	pathname: string;
	method: string;
	search?: string;
	headers?: Record<string, string | undefined> | Headers;
	bodyPayload?: string;
}

export interface RuleEvaluationResult {
	matched: boolean;
	rule?: SecurityRule;
	action?: RuleAction;
	actionConfig?: Record<string, unknown>;
	scoreIncrement?: number;
	evaluationTimeUs?: number;
}

const MAX_REGEX_CACHE = 512;
const PATH_PATTERN_CACHE = new Map<string, RegExp | null>();
const SAFE_REGEX_CACHE = new Map<string, RegExp | null>();

function setBoundedCache(
	cache: Map<string, RegExp | null>,
	key: string,
	value: RegExp | null
): void {
	if (cache.size >= MAX_REGEX_CACHE) {
		const oldestKey = cache.keys().next().value;
		if (oldestKey !== undefined) cache.delete(oldestKey);
	}
	cache.set(key, value);
}

export function matchPathPattern(pathname: string, pattern: string): boolean {
	if (!pattern) return false;
	if (pattern === '*' || pattern === '/**') return true;

	const qIdx = pathname.indexOf('?');
	const cleanPath = qIdx === -1 ? pathname : pathname.slice(0, qIdx);
	if (cleanPath === pattern) return true;
	if (!pattern.includes('*')) return false;

	let re = PATH_PATTERN_CACHE.get(pattern);
	if (re === undefined) {
		let regexStr = pattern
			.replace(/[.+^${}()|[\]\\]/g, '\\$&')
			.replace(/\*\*/g, '.*')
			.replace(/(?<!\.)\*/g, '[^/]*');

		if (!regexStr.startsWith('^')) regexStr = `^${regexStr}`;
		if (!regexStr.endsWith('$')) regexStr = `${regexStr}$`;

		try {
			re = new RegExp(regexStr);
		} catch {
			re = null;
		}
		setBoundedCache(PATH_PATTERN_CACHE, pattern, re);
	}

	return re !== null && re.test(cleanPath);
}

export function getCompiledSafeRegex(pattern: string): RegExp | null {
	if (!pattern || pattern.length > 250) return null;
	const cached = SAFE_REGEX_CACHE.get(pattern);
	if (cached !== undefined) return cached;

	if (/([*+?])\s*\1/.test(pattern) || /\([^)]*[*+?][^)]*\)[*+?]/.test(pattern)) {
		setBoundedCache(SAFE_REGEX_CACHE, pattern, null);
		return null;
	}

	let compiled: RegExp | null = null;
	try {
		compiled = new RegExp(pattern, 'i');
	} catch {
		compiled = null;
	}
	setBoundedCache(SAFE_REGEX_CACHE, pattern, compiled);
	return compiled;
}

export function isSafeRegex(pattern: string): boolean {
	return getCompiledSafeRegex(pattern) !== null;
}

function getHeaderValue(headers: Record<string, string | undefined> | Headers | undefined, name: string): string | null {
	if (!headers || !name) return null;
	const lowerName = name.toLowerCase();
	if (typeof (headers as Headers).get === 'function') {
		return (headers as Headers).get(lowerName);
	}
	const rec = headers as Record<string, string | undefined>;
	for (const [k, v] of Object.entries(rec)) {
		if (k.toLowerCase() === lowerName && typeof v === 'string') {
			return v;
		}
	}
	return null;
}

export function evaluateCondition(condition: SecurityRuleCondition, ctx: RequestEvaluationContext): boolean {
	const rawType = (condition.type || (condition as unknown as { field?: string }).field || '').toLowerCase();
	switch (rawType) {
		case 'ip_cidr':
		case 'ip':
			return isIpInCidr(ctx.ip, condition.value);

		case 'path_pattern':
		case 'path':
			return matchPathPattern(ctx.pathname, condition.value);

		case 'method':
			return ctx.method.trim().toUpperCase() === condition.value.trim().toUpperCase();

		case 'header': {
			if (!condition.field) return false;
			const val = getHeaderValue(ctx.headers, condition.field);
			const op = condition.operator || 'equals';
			if (op === 'exists') return val !== null;
			if (val === null) return op === 'not_equals';

			const targetVal = condition.value;
			if (op === 'equals') return val.toLowerCase() === targetVal.toLowerCase();
			if (op === 'not_equals') return val.toLowerCase() !== targetVal.toLowerCase();
			if (op === 'contains') return val.toLowerCase().includes(targetVal.toLowerCase());
			if (op === 'starts_with') return val.toLowerCase().startsWith(targetVal.toLowerCase());
			if (op === 'matches') {
				const re = getCompiledSafeRegex(targetVal);
				return re !== null && re.test(val);
			}
			return false;
		}

		case 'payload_regex': {
			const re = getCompiledSafeRegex(condition.value);
			if (!re) return false;
			if (ctx.search && re.test(ctx.search)) return true;
			if (ctx.pathname && re.test(ctx.pathname)) return true;
			if (ctx.bodyPayload && re.test(ctx.bodyPayload)) return true;
			return false;
		}

		default:
			return false;
	}
}

export function evaluateRule(rule: SecurityRule, ctx: RequestEvaluationContext): boolean {
	if (!rule.enabled || !rule.conditions || rule.conditions.length === 0) {
		return false;
	}

	if (rule.matchMode === 'any') {
		return rule.conditions.some((cond) => evaluateCondition(cond, ctx));
	}
	return rule.conditions.every((cond) => evaluateCondition(cond, ctx));
}

export function evaluateSecurityRules(
	rules: SecurityRule[],
	ctx: RequestEvaluationContext
): RuleEvaluationResult {
	const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
	let isSorted = true;
	for (let i = 1; i < rules.length; i++) {
		if ((rules[i - 1].priority ?? 100) > (rules[i].priority ?? 100)) {
			isSorted = false;
			break;
		}
	}
	const ordered = isSorted
		? rules
		: [...rules].sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

	for (const rule of ordered) {
		if (evaluateRule(rule, ctx)) {
			const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
			const evaluationTimeUs = Math.max(1, Math.round((t1 - t0) * 1000));

			const scoreIncrement =
				rule.action === 'score'
					? Number(rule.actionConfig?.points ?? 20)
					: undefined;

			return {
				matched: true,
				rule,
				action: rule.action,
				actionConfig: rule.actionConfig,
				scoreIncrement,
				evaluationTimeUs,
			};
		}
	}

	const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
	return {
		matched: false,
		evaluationTimeUs: Math.max(1, Math.round((t1 - t0) * 1000)),
	};
}
