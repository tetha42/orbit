/**
 * HTML escaping — the one copy. Pure (no imports), so it runs in the browser, on
 * the server (mail bodies) and in scripts/check-pure.mjs alike.
 */

/** Escapes the five characters that can break out of HTML text or an attribute. */
export function escapeHtml(value: unknown): string {
	if (value === null || value === undefined) return '';
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}
