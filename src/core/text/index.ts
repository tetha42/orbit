/**
 * Pure text helpers shared across browser, server mail bodies, and `scripts/check-pure.mjs`.
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

/** "Ayse Nur Yilmaz" -> "AY" — for avatars without a photo. Pure. */
export function initials(name: string | null | undefined): string {
	if (!name) return '?';
	const parts = name.trim().split(/\s+/);
	return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toLocaleUpperCase('tr-TR');
}
