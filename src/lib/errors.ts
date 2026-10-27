/**
 * Error handling helpers.
 *
 * `catch (error: any)` was used throughout to reach `error.message`. That both
 * defeats `unknown` in catch clauses (TypeScript's default, and the safer one)
 * and, in route handlers, leaked raw driver/stack text to clients.
 */

/** Extracts a human-readable message from an unknown thrown value. */
export function errorMessage(error: unknown, fallback = 'Beklenmeyen bir hata oluştu.'): string {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === 'string' && error) return error;
	return fallback;
}

/**
 * Message safe to return to a client.
 *
 * Deliberately generic: database errors carry table and column names, and file
 * errors carry absolute paths. Those belong in the server log, not the response.
 */
export function publicErrorMessage(fallback = 'İşlem tamamlanamadı.'): string {
	return fallback;
}
