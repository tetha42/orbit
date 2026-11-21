const SENSITIVE_LOG_KEY_RE =
	/password|secret|pass_?hash|sifre_?hash|totp_?secret|recovery|cookie|authorization|private_?key|plain_?secret/i;

/**
 * Strips ANSI escape sequences and control characters (\r, \n, \0, etc.) to
 * prevent log injection / terminal escape attacks when logs are inspected.
 */
export function sanitizeLogText(value: unknown, maxLen: number): string {
	return String(value ?? '')
		.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
		.replace(/[\r\n\0]+/g, ' ')
		.replace(/\p{Cc}/gu, '')
		.trim()
		.slice(0, maxLen);
}

export function sanitizeLogDetail(
	input: Record<string, unknown> | null | undefined,
	depth = 0
): Record<string, unknown> | null {
	if (!input || typeof input !== 'object' || Array.isArray(input) || depth > 3) {
		return null;
	}
	const out: Record<string, unknown> = {};
	for (const [key, rawVal] of Object.entries(input)) {
		const cleanKey = sanitizeLogText(key, 64);
		if (!cleanKey) continue;
		if (SENSITIVE_LOG_KEY_RE.test(cleanKey)) {
			out[cleanKey] = '[REDACTED]';
			continue;
		}
		if (rawVal === null || typeof rawVal === 'boolean' || typeof rawVal === 'number') {
			out[cleanKey] = rawVal;
		} else if (typeof rawVal === 'string') {
			out[cleanKey] = sanitizeLogText(rawVal, 500);
		} else if (Array.isArray(rawVal)) {
			out[cleanKey] = rawVal.slice(0, 25).map((item) =>
				typeof item === 'string'
					? sanitizeLogText(item, 200)
					: typeof item === 'number' || typeof item === 'boolean'
						? item
						: String(item ?? '').slice(0, 100)
			);
		} else if (typeof rawVal === 'object') {
			out[cleanKey] = sanitizeLogDetail(rawVal as Record<string, unknown>, depth + 1);
		}
	}
	return Object.keys(out).length > 0 ? out : null;
}

export const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
