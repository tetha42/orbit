/** "Ayşe Nur Yılmaz" → "AY" — for avatars without a photo. Pure. */
export function initials(name: string | null | undefined): string {
	if (!name) return '?';
	const parts = name.trim().split(/\s+/);
	return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toLocaleUpperCase('tr-TR');
}
