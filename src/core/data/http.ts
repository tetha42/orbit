'use client';

/**
 * The client's request helper — the one copy. Sends JSON and comes back with
 * the parsed body on success, or the server's message on failure, so every
 * caller can tell the user why something did not work.
 */
export type JsonResult<T> =
	| { ok: true; data: T; error?: undefined; status: number }
	| { ok: false; data?: undefined; error: string; status: number };

export async function sendJson<T = Record<string, unknown>>(url: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: unknown): Promise<JsonResult<T>> {
	try {
		const res = await fetch(url, {
			method,
			headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		const data = (await res.json().catch(() => ({}))) as T & { error?: string };
		if (!res.ok) return { ok: false, error: data?.error || '', status: res.status };
		return { ok: true, data, status: res.status };
	} catch {
		return { ok: false, error: '', status: 0 };
	}
}

/** `POST url {action, ...}` — the shape most of the club's endpoints take. */
export function postAction<T = Record<string, unknown>>(url: string, action: string, fields: Record<string, unknown> = {}): Promise<JsonResult<T>> {
	return sendJson<T>(url, 'POST', { action, ...fields });
}
