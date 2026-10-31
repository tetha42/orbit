/**
 * Default legal documents. They are seeded into `legal_documents` on first read
 * and can then be edited from Settings → Legal & Agreements. Keeping the seed
 * here (rather than in the migration) means an upgraded install gets the same
 * copy as a fresh one, while an edited row is never overwritten.
 */

export type LegalDocumentType = 'terms' | 'privacy' | 'cookies' | 'kvkk' | 'guidelines' | 'custom';
export type LegalDocumentScope = 'registration' | 'members' | 'all';

export interface LegalDocumentSeed {
	docType: LegalDocumentType;
	scope: LegalDocumentScope;
	titleTr: string;
	titleEn: string;
	bodyTr: string;
	bodyEn: string;
	required: boolean;
}

export const LEGAL_DOCUMENT_TYPES: readonly LegalDocumentType[] = [
	'terms',
	'privacy',
	'cookies',
	'kvkk',
	'guidelines',
	'custom',
];

export const LEGAL_DOCUMENT_SCOPES: readonly LegalDocumentScope[] = ['registration', 'members', 'all'];

export const DEFAULT_LEGAL_DOCUMENTS: readonly LegalDocumentSeed[] = [
	{
		docType: 'terms',
		scope: 'registration',
		titleTr: 'Kullanım Koşulları ve Topluluk Kuralları',
		titleEn: 'Terms of Service & Community Guidelines',
		required: true,
		bodyTr: [
			'## 1. Hizmet Koşulları',
			'Bu platform, topluluk üyelerinin iş birliği yapması, proje yürütmesi, etkinlik düzenlemesi ve güvenli iletişim kurması için tetha42 tarafından geliştirilmiş bağımsız bir çalışma alanıdır.',
			'## 2. Kabul Edilebilir Kullanım',
			'Üyeler hesap güvenliğini korumak, yetkisiz erişim girişimlerinden kaçınmak ve ortak çalışma alanlarında saygılı bir iletişim sürdürmekle yükümlüdür. Otomatik tarama, izinsiz sızma girişimi veya sistem bütünlüğünü bozma eylemleri güvenlik katmanı tarafından engellenir.',
			'## 3. Fikri Mülkiyet',
			'Platformda paylaşılan projeler, belgeler ve katkılar ilgili yazarların ve topluluğun belirlediği lisans koşullarına tabidir.',
		].join('\n\n'),
		bodyEn: [
			'## 1. Terms of Service',
			'This platform is a self-hosted workspace engineered by tetha42 for community collaboration, project execution, event organisation, and secure communication.',
			'## 2. Acceptable Use',
			'Members are responsible for safeguarding their credentials and maintaining constructive conduct across shared workspaces. Automated scraping, unauthorised probing, or attempts to compromise system integrity are actively mitigated by the security layer.',
			'## 3. Intellectual Property',
			'Projects, documents, and technical artifacts published here remain subject to the licences designated by their authors and the community.',
		].join('\n\n'),
	},
	{
		docType: 'privacy',
		scope: 'registration',
		titleTr: 'Gizlilik Politikası (GDPR)',
		titleEn: 'Privacy Policy (GDPR)',
		required: true,
		bodyTr: [
			'## 1. Veri Sorumlusu',
			'Verileriniz yalnızca topluluğun kendi barındırdığı PostgreSQL veritabanında saklanır. Üçüncü taraf reklam ağlarına veya veri simsarlarına veri aktarılmaz.',
			'## 2. İşlenen Veriler',
			'Ad, soyad, e-posta, üye kimliği, çalışma alanı ve seviye gibi üyelik için zorunlu veriler işlenir. Parolalar Bcrypt ile özetlenir, 2FA sırları AES-256-GCM ile şifrelenir.',
			'## 3. Haklarınız',
			'Verilerinize erişme, düzeltme, dışa aktarma ve hesabınızın silinmesini talep etme hakkına sahipsiniz.',
		].join('\n\n'),
		bodyEn: [
			'## 1. Data Controller',
			'Your data is stored exclusively in the community’s self-hosted PostgreSQL database. Nothing is transmitted to third-party advertising networks or data brokers.',
			'## 2. Processed Data',
			'Only data required for membership is processed: name, email, member handle, track, and level. Passwords are hashed with Bcrypt and TOTP secrets are encrypted with AES-256-GCM.',
			'## 3. Your Rights',
			'You have the right to access, rectify, export, and request erasure of your personal data.',
		].join('\n\n'),
	},
	{
		docType: 'cookies',
		scope: 'registration',
		titleTr: 'Çerez ve Oturum Politikası',
		titleEn: 'Cookie & Session Policy',
		required: true,
		bodyTr: [
			'## 1. Zorunlu Çerezler',
			'Platform yalnızca kimlik doğrulama ve CSRF koruması için HttpOnly, SameSite=Lax oturum çerezleri kullanır.',
			'## 2. Yerel Tercihler',
			'Dil, tema, duvar kağıdı ve pencere düzeni gibi tercihler tarayıcınızın yerel depolama alanında tutulur.',
			'## 3. İzleme Yok',
			'Üçüncü taraf reklam çerezi, davranışsal profilleme veya çapraz site izleyici kullanılmaz.',
		].join('\n\n'),
		bodyEn: [
			'## 1. Strictly Necessary Cookies',
			'The platform uses HttpOnly, SameSite=Lax session cookies solely for authentication and CSRF protection.',
			'## 2. Local Preferences',
			'Language, theme, wallpaper, and window layout preferences are stored locally in your browser.',
			'## 3. No Tracking',
			'No third-party advertising cookies, behavioural profiling, or cross-site trackers are used.',
		].join('\n\n'),
	},
];
