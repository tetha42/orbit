import { NextResponse } from 'next/server';
import { requireApp } from '@/lib/auth/access';
import { withAudit } from '@/lib/audit/withAudit';
import {
	getAllSecurityRules,
	saveSecurityRule,
	deleteSecurityRule,
} from '@/db/repositories/securityRules.repo';
import type { RuleAction, MatchMode, SecurityRuleCondition } from '@/lib/securityRules';

export const dynamic = 'force-dynamic';

/**
 * `GET /api/soc/rules` — lists all security rules.
 */
export async function GET(request: Request) {
	const auth = await requireApp(request, 'soc', 'use');
	if (!auth.authorized) return auth.response;

	try {
		const rules = await getAllSecurityRules();
		return NextResponse.json({ ok: true, rules });
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return NextResponse.json({ ok: false, error: msg }, { status: 500 });
	}
}

/**
 * `POST /api/soc/rules` — creates or updates a dynamic security rule.
 */
async function handlePOST(request: Request) {
	const auth = await requireApp(request, 'soc', 'manage');
	if (!auth.authorized) return auth.response;

	try {
		const body = await request.json().catch(() => ({}));
		const name = String(body.name || '').trim();
		const action = body.action as RuleAction;

		if (!name) {
			return NextResponse.json({ ok: false, error: 'Rule name is required.' }, { status: 400 });
		}

		const validActions: RuleAction[] = ['block', 'rate_limit', 'score', 'honeypot', 'allow'];
		if (!action || !validActions.includes(action)) {
			return NextResponse.json(
				{ ok: false, error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
				{ status: 400 }
			);
		}

		const conditions = Array.isArray(body.conditions) ? (body.conditions as SecurityRuleCondition[]) : [];
		const priority = Number(body.priority ?? 100);
		const matchMode: MatchMode = body.matchMode === 'any' ? 'any' : 'all';

		const rule = await saveSecurityRule({
			id: body.id ? String(body.id).trim() : undefined,
			name,
			description: body.description ? String(body.description).trim() : null,
			enabled: body.enabled !== false,
			priority: isNaN(priority) ? 100 : priority,
			matchMode,
			conditions,
			action,
			actionConfig: body.actionConfig && typeof body.actionConfig === 'object' ? body.actionConfig : {},
			creatorId: auth.user.id,
		});

		return NextResponse.json({ ok: true, rule });
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return NextResponse.json({ ok: false, error: msg }, { status: 500 });
	}
}

/**
 * `DELETE /api/soc/rules` — deletes a dynamic security rule.
 */
async function handleDELETE(request: Request) {
	const auth = await requireApp(request, 'soc', 'manage');
	if (!auth.authorized) return auth.response;

	try {
		const url = new URL(request.url);
		let id = url.searchParams.get('id');
		if (!id) {
			const body = await request.json().catch(() => ({}));
			id = body.id;
		}

		if (!id || typeof id !== 'string') {
			return NextResponse.json({ ok: false, error: 'Rule ID is required.' }, { status: 400 });
		}

		const deleted = await deleteSecurityRule(id.trim());
		if (!deleted) {
			return NextResponse.json({ ok: false, error: 'Rule not found.' }, { status: 404 });
		}

		return NextResponse.json({ ok: true, deleted: true });
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return NextResponse.json({ ok: false, error: msg }, { status: 500 });
	}
}

export const POST = withAudit(handlePOST, { action: 'soc.rule.create', target: 'soc.rules' });
export const DELETE = withAudit(handleDELETE, { action: 'soc.rule.delete', target: 'soc.rules' });
