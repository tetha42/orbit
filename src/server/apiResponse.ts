import { NextResponse } from 'next/server';

export interface ApiResponseMeta {
	timestamp: number;
	requestId?: string;
	pagination?: {
		page: number;
		pageSize: number;
		total: number;
		totalPages: number;
	};
}

export interface ApiResponse<T = unknown> {
	ok: boolean;
	data?: T;
	error?: string;
	code?: string;
	meta?: ApiResponseMeta;
}

/**
 * Returns a standardized JSON success response.
 * Merges plain object data properties for backward compatibility with existing callers,
 * while always providing typed { ok: true, data, meta }.
 */
export function jsonSuccess<T>(
	data: T,
	init?: ResponseInit,
	meta?: Partial<ApiResponseMeta>
): NextResponse<ApiResponse<T>> {
	const responseMeta: ApiResponseMeta = {
		timestamp: Date.now(),
		...meta,
	};

	const payload: Record<string, unknown> = {
		ok: true,
		data,
		meta: responseMeta,
	};

	if (data && typeof data === 'object' && !Array.isArray(data)) {
		Object.assign(payload, data);
	}

	return NextResponse.json(payload as unknown as ApiResponse<T>, init);
}

/**
 * Returns a standardized JSON error response with HTTP status code and optional error code.
 */
export function jsonError(
	error: string,
	status = 400,
	code?: string
): NextResponse<ApiResponse<never>> {
	return NextResponse.json(
		{
			ok: false,
			error,
			...(code ? { code } : {}),
			meta: {
				timestamp: Date.now(),
			},
		},
		{ status }
	);
}
