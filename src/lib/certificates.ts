import { CERTIFICATE_THEMES, type CertificateCategory } from './i18n/data/certificateThemes.ts';
export { CERTIFICATE_THEMES } from './i18n/data/certificateThemes.ts';
export type { CertificateCategory, CertificateTheme } from './i18n/data/certificateThemes.ts';

/**
 * Detects certificate category from title or explicit field.
 */
export function inferCertificateCategory(title: string, explicitCategory?: string | null): CertificateCategory {
	if (explicitCategory && explicitCategory in CERTIFICATE_THEMES) {
		return explicitCategory as CertificateCategory;
	}
	const lower = (title || '').toLowerCase();
	if (lower.includes('hizmet') || lower.includes('emek') || lower.includes('y\u00f6netim') || lower.includes('service')) {
		return 'service';
	}
	if (lower.includes('onur') || lower.includes('temsil') || lower.includes('honor')) {
		return 'honor';
	}
	if (lower.includes('kat\u0131l\u0131m') || lower.includes('at\u00f6lye') || lower.includes('workshop') || lower.includes('seminar') || lower.includes('participation')) {
		return 'participation';
	}
	return 'achievement';
}
