import { NextResponse } from 'next/server';
import { requireApp } from '@/lib/auth/access';
import {
	evaluateSecurityRules,
	type SecurityRule,
	type RequestEvaluationContext,
} from '@/lib/securityRules';
import { getActiveSecurityRules } from '@/db/repositories/securityRules.repo';

export const dynamic = 'force-dynamic';

/**
 * `POST /api/soc/rules/test` — tests a simulated request against dynamic security rules.
 * audit:exempt: simulation bench without database mutation
 */
export async function POST(request: Request) {
	const auth = await requireApp(request, 'soc', 'use');
	if (!auth.authorized) return auth.response;

	try {
		const body = await request.json().catch(() => ({}));
		const mockRequest = body.mockRequest || {};

		const ctx: RequestEvaluationContext = {
			ip: String(mockRequest.ip || '127.0.0.1').trim(),
			pathname: String(mockRequest.pathname || '/').trim(),
			method: String(mockRequest.method || 'GET').trim().toUpperCase(),
			search: mockRequest.search ? String(mockRequest.search) : undefined,
			headers: mockRequest.headers && typeof mockRequest.headers === 'object' ? mockRequest.headers : {},
			bodyPayload: mockRequest.bodyPayload
				? typeof mockRequest.bodyPayload === 'string'
					? mockRequest.bodyPayload
					: JSON.stringify(mockRequest.bodyPayload)
				: undefined,
		};

		let rulesToTest: SecurityRule[] = [];
		if (body.rule && typeof body.rule === 'object') {
			// Single candidate rule simulation
			rulesToTest = [
				{
					id: body.rule.id || 'candidate_rule',
					name: body.rule.name || 'Candidate Rule',
					enabled: true,
					priority: Number(body.rule.priority ?? 100),
					matchMode: body.rule.matchMode === 'any' ? 'any' : 'all',
					conditions: Array.isArray(body.rule.conditions) ? body.rule.conditions : [],
					action: body.rule.action || 'block',
					actionConfig: body.rule.actionConfig || {},
				},
			];
		} else {
			// Test against active production rules
			rulesToTest = await getActiveSecurityRules();
		}

		const result = evaluateSecurityRules(rulesToTest, ctx);

		return NextResponse.json({
			ok: true,
			context: ctx,
			result: {
				matched: result.matched,
				ruleId: result.rule?.id ?? null,
				ruleName: result.rule?.name ?? null,
				action: result.action ?? 'pass',
				actionConfig: result.actionConfig ?? {},
				scoreIncrement: result.scoreIncrement,
				evaluationTimeUs: result.evaluationTimeUs,
			},
		});
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return NextResponse.json({ ok: false, error: msg }, { status: 500 });
	}
}
