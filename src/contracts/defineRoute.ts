import { NextResponse } from 'next/server';
import { z } from 'zod';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RouteContractMeta {
	id: string;
	method: HttpMethod;
	path: string;
	summary?: string;
	query?: z.ZodType;
	body?: z.ZodType;
	response?: z.ZodType;
	auth?: 'public' | 'authenticated' | 'app' | 'vault' | 'admin';
}

export type RouteParseSuccess<T> = {
	ok: true;
	data: T;
};

export type RouteParseFailure = {
	ok: false;
	response: NextResponse;
};

export type RouteParseResult<T> = RouteParseSuccess<T> | RouteParseFailure;

export type RouteHandlerFn<TContext = unknown> = (
	request: Request,
	context: TContext
) => Promise<Response | NextResponse> | Response | NextResponse;

export type DefinedRouteHandler<TContext = unknown> = ((
	request: Request,
	context?: TContext
) => Promise<Response | NextResponse> | Response | NextResponse) & {
	readonly contractMeta: Readonly<RouteContractMeta>;
};

function formatValidationMessage(issues: readonly z.core.$ZodIssue[]): string {
	const first = issues[0];
	if (!first) return 'Invalid request payload.';
	const path = first.path.length > 0 ? `${first.path.join('.')}: ` : '';
	return `${path}${first.message}`;
}

export function validationErrorResponse(
	issues: readonly z.core.$ZodIssue[],
	overrideMessage?: string
): NextResponse {
	return NextResponse.json(
		{
			ok: false,
			error: overrideMessage ?? formatValidationMessage(issues),
			code: 'VALIDATION_ERROR',
			issues,
		},
		{ status: 400 }
	);
}

export function parseRouteData<TSchema extends z.ZodType>(
	value: unknown,
	schema: TSchema
): RouteParseResult<z.infer<TSchema>> {
	const parsed = schema.safeParse(value);
	if (!parsed.success) {
		return {
			ok: false,
			response: validationErrorResponse(parsed.error.issues),
		};
	}
	return { ok: true, data: parsed.data };
}

export async function parseRouteBody<TSchema extends z.ZodType>(
	request: Request,
	schema: TSchema
): Promise<RouteParseResult<z.infer<TSchema>>> {
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		// Malformed or non-JSON payloads map to HTTP 400 validation errors instead of 500.
		return {
			ok: false,
			response: validationErrorResponse([
				{
					code: 'custom',
					path: [],
					message: 'Invalid JSON request body.',
				},
			]),
		};
	}
	return parseRouteData(raw, schema);
}

function searchParamsToObject(searchParams: URLSearchParams): Record<string, string | string[]> {
	const out: Record<string, string | string[]> = {};
	for (const key of searchParams.keys()) {
		const all = searchParams.getAll(key);
		out[key] = all.length > 1 ? all : (all[0] ?? '');
	}
	return out;
}

export function parseRouteQuery<TSchema extends z.ZodType>(
	searchParams: URLSearchParams | URL | Request,
	schema: TSchema
): RouteParseResult<z.infer<TSchema>> {
	const params =
		searchParams instanceof URLSearchParams
			? searchParams
			: searchParams instanceof URL
				? searchParams.searchParams
				: new URL(searchParams.url).searchParams;
	return parseRouteData(searchParamsToObject(params), schema);
}

export function defineRouteMeta<TMeta extends RouteContractMeta>(meta: TMeta): Readonly<TMeta> {
	return Object.freeze({ ...meta });
}

export function withRouteMeta<THandler extends object>(
	handler: THandler,
	meta: RouteContractMeta
): THandler & { readonly contractMeta: Readonly<RouteContractMeta> } {
	const target = handler as THandler & { contractMeta: Readonly<RouteContractMeta> };
	target.contractMeta = defineRouteMeta(meta);
	return target;
}

export function defineRoute<TContext = unknown>(
	spec: RouteContractMeta,
	handler: RouteHandlerFn<TContext>
): DefinedRouteHandler<TContext> {
	const wrapped = ((request: Request, context?: TContext) =>
		handler(request, context as TContext)) as DefinedRouteHandler<TContext>;
	return withRouteMeta(wrapped, spec);
}
