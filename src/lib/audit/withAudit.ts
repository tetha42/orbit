import { NextResponse } from 'next/server';
import { clientAddress } from '@/lib/http';
import { cleanIp, recordFields } from '@/lib/audit';
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
	context: TContext
) => Promise<Response | NextResponse> | Response | NextResponse;

/**
 * Higher-order function that wraps a Next.js route mutation handler (POST/PUT/DELETE/PATCH).
 * Ensures every state mutation logs an auditable event with actor, IP, action, target and redacted payload.
 */
import { checkDeclaredContentLength, readBoundedJson } from '@/lib/httpBodyGuard';

const AUDIT_BODY_MAX_BYTES = 1024 * 1024;

export function withAudit<TContext = unknown, TBody = unknown>(
	handler: RouteHandler<TContext>,
	options: AuditOptions<TContext, TBody>
): RouteHandler<TContext> {
	return async (request: Request, context: TContext) => {
		let bodyPayload: unknown = null;
		let clonedForAudit: Request | null = null;
		try {
			if (
				request.method !== 'GET' &&
				request.method !== 'HEAD' &&
				request.body !== null &&
				request.headers.get('content-length') !== '0'
			) {
				const contentType = request.headers.get('content-type') || '';
				if (
					contentType.includes('application/json') &&
					checkDeclaredContentLength(request, AUDIT_BODY_MAX_BYTES)
				) {
					clonedForAudit = request.clone();
				}
			}
		} catch {
			clonedForAudit = null;
		}

		let response: Response | undefined = undefined;
		try {
			response = await handler(request, context);
		} finally {
			if (!response && clonedForAudit) {
				void clonedForAudit.body?.cancel().catch(() => {});
				if (!request.bodyUsed) {
					void request.body?.cancel().catch(() => {});
				}
				clonedForAudit = null;
			}
		}

		if (response.status >= 200 && response.status < 400) {
			if (clonedForAudit) {
				bodyPayload = await readBoundedJson(clonedForAudit, AUDIT_BODY_MAX_BYTES).catch(
					() => null
				);
				clonedForAudit = null;
			}
		} else if (clonedForAudit) {
			void clonedForAudit.body?.cancel().catch(() => {});
			if (!request.bodyUsed) {
				void request.body?.cancel().catch(() => {});
			}
			clonedForAudit = null;
		}

		if (response.status >= 200 && response.status < 400) {
			try {
				const ip = cleanIp(clientAddress(request));
				let actorId: string | null = null;
				let actorName = 'anonymous';

				try {
					const auth = await verifyAuth(request);
					if (auth.authorized && auth.user) {
						actorId = auth.user.id;
						actorName =
							`${auth.user.name || ''} ${auth.user.surname || ''}`.trim() ||
							auth.user.email ||
							auth.user.studentNo ||
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
					actorId: actorId,
					actorName: actorName,
					action: options.action,
					targetType: options.target,
					targetId: targetId ? String(targetId) : null,
					targetName: options.target,
					after: details ? recordFields(details) : null,
					ip,
				});
			} catch (auditErr) {
				console.error('[withAudit] failed to write audit log:', auditErr);
			}
		}

		return response;
	};
}
