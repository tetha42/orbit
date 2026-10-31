import { NextResponse } from 'next/server';
import { clientAddress } from '@/lib/http';
import { temizIp, recordFields } from '@/lib/audit';
import { writeAuditLog } from '@/db/audit';
import { verifyAuth } from '@/lib/auth/authGuard';

export interface AuditOptions<TContext = unknown, TBody = unknown> {
	action: string;
	target: string;
	getTargetId?: (request: Request, context?: TContext, body?: TBody) => string | null | undefined;
	getDetails?: (request: Request, context?: TContext, body?: TBody) => Record<string, unknown> | null | undefined;
}

export type RouteHandler<TContext = unknown> = (
	request: Request,
	context?: TContext
) => Promise<Response | NextResponse> | Response | NextResponse;

/**
 * Higher-order function that wraps a Next.js route mutation handler (POST/PUT/DELETE/PATCH).
 * Ensures every state mutation logs an auditable event with actor, IP, action, target and redacted payload.
 */
export function withAudit<TContext = unknown, TBody = unknown>(
	handler: RouteHandler<TContext>,
	options: AuditOptions<TContext, TBody>
): RouteHandler<TContext> {
	return async (request: Request, context?: TContext) => {
		let bodyPayload: unknown = null;
		try {
			if (request.method !== 'GET' && request.method !== 'HEAD') {
				const contentType = request.headers.get('content-type') || '';
				if (contentType.includes('application/json')) {
					bodyPayload = await request.clone().json().catch(() => null);
				}
			}
		} catch {
			// Body cloning/parsing error is non-fatal for handler execution
		}

		const response = await handler(request, context);

		if (response.status >= 200 && response.status < 400) {
			try {
				const ip = temizIp(clientAddress(request));
				let actorId: string | null = null;
				let actorName = 'anonymous';

				try {
					const auth = await verifyAuth(request);
					if (auth.authorized && auth.user) {
						actorId = auth.user.id;
						actorName =
							`${auth.user.ad || ''} ${auth.user.soyad || ''}`.trim() ||
							auth.user.email ||
							auth.user.ogrenciNo ||
							actorId;
					}
				} catch {
					// Fallback to anonymous actor
				}

				let resolvedParams: Record<string, unknown> | null = null;
				if (context && typeof context === 'object' && 'params' in context) {
					const ctx = context as { params?: unknown };
					resolvedParams = (ctx.params instanceof Promise
						? await ctx.params
						: ctx.params) as Record<string, unknown> | null;
				}

				const bodyObj = typeof bodyPayload === 'object' && bodyPayload !== null ? (bodyPayload as Record<string, unknown>) : null;
				const targetId = options.getTargetId
					? options.getTargetId(request, context, bodyPayload as TBody)
					: (resolvedParams?.id as string | undefined) ||
					  (resolvedParams?.slug as string | undefined) ||
					  (bodyObj?.id as string | undefined) ||
					  null;

				const details = options.getDetails
					? options.getDetails(request, context, bodyPayload as TBody)
					: bodyObj;

				await writeAuditLog({
					yapanId: actorId,
					yapanAd: actorName,
					islem: options.action,
					hedefTur: options.target,
					hedefId: targetId ? String(targetId) : null,
					hedefAd: options.target,
					sonraki: details ? recordFields(details) : null,
					ip,
				});
			} catch (auditErr) {
				console.error('[withAudit] failed to write audit log:', auditErr);
			}
		}

		return response;
	};
}
