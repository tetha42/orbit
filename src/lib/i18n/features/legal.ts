export const legalFeatureStrings = {
	tr: {
		legalTitle: "Yasal Metinler ve Onaylar",
		legalDesc: "Kayıt formunda gösterilen sözleşmeleri, gizlilik metinlerini ve onay kapsamlarını yönetin.",
		legalAdd: "Belge Ekle",
		legalSave: "Belgeyi Kaydet",
		legalSaveFailed: "Belge kaydedilemedi.",
		legalSaved: "Yasal belge kaydedildi.",
		legalEmpty: "Henüz yasal belge yok.",
		legalAllTypesUsed: "Tüm belge türleri zaten kullanılıyor. Yeni bir metin için mevcut bir belgeyi düzenleyin veya farklı bir tür seçin.",
		legalDocType: "Belge Türü",
		legalScope: "Geçerlilik Kapsamı",
		legalTitleTr: "Başlık (Türkçe)",
		legalTitleEn: "Başlık (İngilizce)",
		legalRequired: "Onay zorunlu",
		legalEnabled: "Etkin",
		legalBodyTr: "Metin (Türkçe)",
		legalBodyEn: "Metin (İngilizce)",
		legalMarkdownHint: "Markdown başlıkları (##) ve listeler (-) desteklenir.",
		legalVersionHistory: "Sürüm geçmişi",
		legalCurrentVersion: "Güncel sürüm",
		legalNoVersions: "Henüz arşivlenmiş bir sürüm yok.",
		legalSelectPrompt: "Düzenlemek için soldan bir belge seçin veya yeni bir belge ekleyin.",
		legalType_terms: "Kullanım Koşulları",
		legalType_privacy: "Gizlilik Politikası",
		legalType_cookies: "Çerez ve Oturum Politikası",
		legalType_kvkk: "KVKK Aydınlatma Metni",
		legalType_guidelines: "Topluluk Kuralları",
		legalType_custom: "Özel Belge",
		legalScope_registration: "Kayıt",
		legalScope_members: "Üyeler",
		legalScope_all: "Tümü",
		legalTabTerms: "Kullanım Koşulları",
		legalTabPrivacy: "Gizlilik Politikası (GDPR)",
		legalTabCookies: "Çerez & Oturum Politikası",
		legalModalHeaderTitle: "Küresel Yasal Standartlar & Veri Koruma",
		legalTermsH1: "1. Hizmet Koşulları ve Topluluk Kuralları",
		legalTermsP1:
			"Orbit Community OS (\"Platform\"), toplulukların iş birliği, proje yönetimi, etkinlik organizasyonu ve " +
			"güvenli iletişim yürütmesi için tetha42 tarafından geliştirilen bağımsız bir çalışma alanıdır.",
		legalTermsH2: "2. Kabul Edilebilir Kullanım ve Hesap Güvenliği",
		legalTermsP2:
			"Üyeler, hesap kimlik bilgilerini korumakla, yetkisiz erişim girişimlerinden kaçınmakla ve topluluk " +
			"çalışma alanlarında saygılı, yapıcı bir iletişim sürdürmekle yükümüdür. Otomatik tarama, yetkisiz " +
			"sızma girişimleri veya sistem bütünlüğünü bozmaya yönelik eylemler otonom güvenlik duvarı (SoC/WAF) " +
			"tarafından engellenir.",
		legalTermsH3: "3. Fikri Mülkiyet ve Sorumluluk",
		legalTermsP3:
			"Platform üzerinde paylaşılan projeler, belgeler ve katkılar ilgili yazarların ve topluluğun " +
			"belirlediği açık kaynak veya iç lisans koşullarına tabidir. Platform \"olduğu gibi\" sunulmaktadır.",
		legalPrivacyH1: "1. Küresel Veri Koruma ve GDPR Uyumluluğu",
		legalPrivacyP1:
			"Orbit Community OS, Veri Minimizasyonu (Data Minimization) ve Tasarımdan İtibaren Gizlilik (Privacy " +
			"by Design) ilkelerine göre çalışır. Yalnızca topluluk üyeliği, yetkilendirme ve çalışma alanı " +
			"işlevleri için zorunlu olan veriler (ad, e-posta, üye kimliği, çalışma alanı/seviye) işlenir.",
		legalPrivacyH2: "2. Kriptografik Güvenlik ve Saklama",
		legalPrivacyP2:
			"Parolalar Bcrypt (maliyet faktörü 12) ile özetlenir, 2FA TOTP sırları AES-256-GCM ile şifrelenir ve " +
			"tüm veriler yalnızca topluluğun kendi barındırdığı PostgreSQL veritabanında tutulur. Hiçbir veri " +
			"üçüncü taraf reklam ağlarına veya veri simsarlarına aktarılmaz.",
		legalPrivacyH3: "3. Kullanıcı Hakları (Erişim, Düzeltme, Silme ve Taşınabilirlik)",
		legalPrivacyP3:
			"Üyeler diledikleri zaman kişisel verilerine erişme, profil bilgilerini güncelleme, verilerinin dışa " +
			"aktarılmasını talep etme ve hesaplarının kalıcı olarak silinmesini (Unutulma Hakkı) isteme hakkına " +
			"sahiptir.",
		legalCookiesH1: "1. Zorunlu Oturum Çerezleri (HttpOnly)",
		legalCookiesP1:
			"Orbit Community OS, yalnızca güvenli kimlik doğrulama ve CSRF koruması için kriptografik olarak " +
			"imzalanmış, HttpOnly ve SameSite=Lax bayraklı birinci taraf oturum çerezleri kullanır. Bu çerezler " +
			"olmadan çalışma alanı oturumu açılamaz.",
		legalCookiesH2: "2. Yerel Tercih Depolaması (LocalStorage)",
		legalCookiesP2:
			"Arayüz dili, tema, pencere düzeni ve ses düzeyi gibi kullanıcı arayüzü tercihleri yalnızca " +
			"tarayıcınızın yerel depolama alanında (localStorage) saklanır.",
		legalCookiesH3: "3. Sıfır Üçüncü Taraf İzleme veya Reklam Çerezi",
		legalCookiesP3:
		"Platformda hiçbir üçüncü taraf reklam çerezi, davranışsal profilleme pikseli veya çapraz site izleyici (cross-site tracker) bulunmaz.",
		legalModalAcceptBtn: "Okudum ve Kabul Ediyorum",
	},
	en: {
		legalTitle: "Legal Agreements & Consent",
		legalDesc: "Manage the agreements, privacy texts, and consent scopes shown on the registration form.",
		legalAdd: "Add Document",
		legalSave: "Save Document",
		legalSaveFailed: "The document could not be saved.",
		legalSaved: "Legal document saved.",
		legalEmpty: "No legal documents yet.",
		legalAllTypesUsed: "Every document type is already in use. Edit an existing document or choose a different type.",
		legalDocType: "Document Type",
		legalScope: "Applies To",
		legalTitleTr: "Title (Turkish)",
		legalTitleEn: "Title (English)",
		legalRequired: "Acceptance required",
		legalEnabled: "Enabled",
		legalBodyTr: "Body (Turkish)",
		legalBodyEn: "Body (English)",
		legalMarkdownHint: "Markdown headings (##) and lists (-) are supported.",
		legalVersionHistory: "Version history",
		legalCurrentVersion: "Current version",
		legalNoVersions: "No archived version yet.",
		legalSelectPrompt: "Select a document on the left or add a new one.",
		legalType_terms: "Terms of Service",
		legalType_privacy: "Privacy Policy",
		legalType_cookies: "Cookie & Session Policy",
		legalType_kvkk: "Data Protection Notice",
		legalType_guidelines: "Community Guidelines",
		legalType_custom: "Custom Document",
		legalScope_registration: "Registration",
		legalScope_members: "Members",
		legalScope_all: "All",
		legalTabTerms: "Terms of Service",
		legalTabPrivacy: "Privacy Policy (GDPR)",
		legalTabCookies: "Cookie & Session Policy",
		legalModalHeaderTitle: "Global Legal Standards & Data Protection",
		legalTermsH1: "1. Terms of Service & Community Guidelines",
		legalTermsP1:
			"Orbit Community OS (\"the Platform\") is a self-hosted digital workspace engineered by tetha42 for " +
			"engineering teams, open-source collectives, and research communities.",
		legalTermsH2: "2. Acceptable Use & Account Security",
		legalTermsP2:
			"Members are responsible for safeguarding their credentials (passwords, TOTP authenticators, and " +
			"WebAuthn passkeys) and maintaining constructive conduct across all shared workspaces. Automated " +
			"scraping, unauthorized probing, or attempts to compromise system integrity are actively mitigated by " +
			"the autonomous SoC and WAF engine.",
		legalTermsH3: "3. Intellectual Property & Liability",
		legalTermsP3:
			"Projects, documents, and technical artifacts published within the workspace remain subject to the " +
			"licenses designated by their respective authors and community governance. The Platform is provided " +
			"\"as is\" without warranty of any kind.",
		legalPrivacyH1: "1. GDPR & Global Data Protection Compliance",
		legalPrivacyP1:
			"Orbit Community OS operates under strict Data Minimization and Privacy-by-Design principles aligned " +
			"with GDPR and global privacy regulations. Only data strictly required for identity verification, " +
			"role-based access control, and workspace collaboration (name, email, member handle, track, and " +
			"experience level) is processed.",
		legalPrivacyH2: "2. Cryptographic Security & Self-Hosted Sovereignty",
		legalPrivacyP2:
			"Passwords are hashed using Bcrypt (cost factor 12), TOTP secrets are encrypted at rest with " +
			"AES-256-GCM, and all records reside exclusively within your self-hosted PostgreSQL instance. Zero " +
			"personal data is sold, shared with data brokers, or transmitted to external telemetry networks.",
		legalPrivacyH3: "3. Your Rights (Access, Erasure & Portability)",
		legalPrivacyP3:
			"Every member retains the right to inspect their stored profile data, rectify inaccuracies, export " +
			"their records in machine-readable formats, and request permanent account erasure (\"Right to be " +
			"Forgotten\") through the workspace administrators.",
		legalCookiesH1: "1. Strictly Necessary Session Cookies (HttpOnly)",
		legalCookiesP1:
			"Orbit Community OS uses strictly necessary, cryptographically signed first-party HttpOnly session " +
			"cookies (SameSite=Lax) solely to maintain authenticated sessions and enforce CSRF protection.",
		legalCookiesH2: "2. Local Workspace Preferences",
		legalCookiesP2:
			"User interface preferences such as language selection, theme mode, window geometry, and audio volume " +
			"are stored locally in your browser via LocalStorage.",
		legalCookiesH3: "3. Zero Third-Party Advertising or Tracking Cookies",
		legalCookiesP3: "Orbit Community OS deploys zero third-party advertising cookies, behavioral profiling pixels, or cross-site analytics trackers.",
		legalModalAcceptBtn: "I Acknowledge & Accept",
	},
};
