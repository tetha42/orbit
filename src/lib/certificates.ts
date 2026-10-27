/**
 * Certificate Categories and Dynamic Themes
 *
 * Each category provides:
 * - Specific visual theme (frame border, accent color, background tones, seal badge)
 * - Distinct congratulatory/achievement messages (TR & EN)
 * - Official certificate title
 */

export type CertificateCategory = 'achievement' | 'participation' | 'service' | 'honor';

export interface CertificateTheme {
	id: CertificateCategory;
	label: { tr: string; en: string };
	title: { tr: string; en: string };
	givenTo: { tr: string; en: string };
	completion: { tr: string; en: string };
	accentColor: string;
	secondaryColor: string;
	borderColor: string;
	badgeBg: string;
	paperBg: string;
	sealIcon: string;
	ribbonColor: string;
}

export const CERTIFICATE_THEMES: Record<CertificateCategory, CertificateTheme> = {
	achievement: {
		id: 'achievement',
		label: { tr: 'Üstün Başarı Belgesi', en: 'Certificate of Achievement' },
		title: { tr: 'ÜSTÜN BAŞARI BELGESİ', en: 'CERTIFICATE OF ACHIEVEMENT' },
		givenTo: {
			tr: 'Bu belge, üstün gayret, yüksek performans ve başarı gösteren üyemize iftiharla verilmiştir:',
			en: 'This certificate is proudly presented for outstanding distinction and excellence to:',
		},
		completion: {
			tr: 'kapsamındaki tüm zorlu etapları, teknik uygulamaları ve proje hedeflerini üstün başarı ve takdire şayan gayretle tamamlamıştır.',
			en: 'for demonstrating exceptional distinction, technical excellence, and dedication in fulfilling all program milestones.',
		},
		accentColor: '#d97706', // Amber / Gold
		secondaryColor: '#b45309',
		borderColor: '#d4af37',
		badgeBg: 'rgba(217, 119, 6, 0.15)',
		paperBg: '#fffdfa',
		sealIcon: 'Trophy',
		ribbonColor: '#b45309',
	},
	participation: {
		id: 'participation',
		label: { tr: 'Katılım ve Başarı Sertifikası', en: 'Certificate of Participation' },
		title: { tr: 'KATILIM VE BAŞARI SERTİFİKASI', en: 'CERTIFICATE OF PARTICIPATION' },
		givenTo: {
			tr: 'Bu belge, ilgili eğitim, seminer ve atölye çalışmalarına eksiksiz katılım sağlayan üyemize takdim edilmiştir:',
			en: 'This certificate of participation is gladly awarded to:',
		},
		completion: {
			tr: 'programındaki uygulamalı laboratuvar oturumlarına ve etkileşimli eğitim modüllerine başarıyla katılım sağlamıştır.',
			en: 'for actively participating in all hands-on workshop sessions, technical labs, and educational modules.',
		},
		accentColor: '#0284c7', // Sky Blue
		secondaryColor: '#0369a1',
		borderColor: '#38bdf8',
		badgeBg: 'rgba(2, 132, 199, 0.15)',
		paperBg: '#f8fafc',
		sealIcon: 'Award',
		ribbonColor: '#0284c7',
	},
	service: {
		id: 'service',
		label: { tr: 'Üstün Hizmet & Emek Belgesi', en: 'Certificate of Outstanding Service' },
		title: { tr: 'ÜSTÜN HİZMET VE EMEK BELGESİ', en: 'CERTIFICATE OF OUTSTANDING SERVICE' },
		givenTo: {
			tr: 'Bu belge, topluluğumuzun faaliyetlerine, organizasyonlarına ve takım çalışmalarına sunduğu paha biçilmez katkılardan ötürü takdirle verilmiştir:',
			en: 'This certificate of service is awarded with gratitude and high appreciation to:',
		},
		completion: {
			tr: 'topluluk faaliyetlerinin gelişmesinde, Ar-Ge ekiplerinin koordinasyonunda ve topluluk kültürünün yaşatılmasında örnek bir özveri sergilemiştir.',
			en: 'for demonstrating devoted leadership, continuous volunteer commitment, and impactful contributions to our community.',
		},
		accentColor: '#059669', // Emerald
		secondaryColor: '#047857',
		borderColor: '#34d399',
		badgeBg: 'rgba(5, 150, 105, 0.15)',
		paperBg: '#f0fdf4',
		sealIcon: 'Medal',
		ribbonColor: '#059669',
	},
	honor: {
		id: 'honor',
		label: { tr: 'Onur ve Temsil Belgesi', en: 'Certificate of Honor & Representation' },
		title: { tr: 'ONUR VE YÜKSEK TEMSİL BELGESİ', en: 'CERTIFICATE OF HONOR' },
		givenTo: {
			tr: 'Bu belge, topluluğumuzu ulusal/uluslararası platformlarda en yüksek liyakatle temsil eden seçkin üyemize sunulmuştur:',
			en: 'This certificate of honor is proudly bestowed in highest recognition to:',
		},
		completion: {
			tr: 'göstermiş olduğu örnek duruş, yüksek etik değerler ve yarışmalardaki seçkin temsiliyeti ile topluluğumuzu gururlandırmıştır.',
			en: 'for exemplary representation, highest ethical leadership, and bringing great honor to our community.',
		},
		accentColor: '#7c3aed', // Royal Violet / Purple
		secondaryColor: '#6d28d9',
		borderColor: '#a78bfa',
		badgeBg: 'rgba(124, 58, 237, 0.15)',
		paperBg: '#faf5ff',
		sealIcon: 'Crown',
		ribbonColor: '#7c3aed',
	},
};

/**
 * Detects certificate category from title or explicit field.
 */
export function inferCertificateCategory(title: string, explicitCategory?: string | null): CertificateCategory {
	if (explicitCategory && explicitCategory in CERTIFICATE_THEMES) {
		return explicitCategory as CertificateCategory;
	}
	const lower = (title || '').toLowerCase();
	if (lower.includes('hizmet') || lower.includes('emek') || lower.includes('yönetim') || lower.includes('service')) {
		return 'service';
	}
	if (lower.includes('onur') || lower.includes('temsil') || lower.includes('honor')) {
		return 'honor';
	}
	if (lower.includes('katılım') || lower.includes('atölye') || lower.includes('workshop') || lower.includes('seminer') || lower.includes('participation')) {
		return 'participation';
	}
	return 'achievement';
}
