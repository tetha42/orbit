import type { Language } from '@/lib/i18n';

export interface RadarMainCopy {
	kpiQuarantinedIps: string;
	kpiWhitelistedSuffix: string;
	kpiSecEvents24h: string;
	kpiSecEventsSub: string;
	kpiAuth24h: string;
	kpiAuthSub: string;
	kpiWafTitle: string;
	kpiWafSub: string;
	kpiSessionAnomalies: string;
	kpiSessionAnomaliesSub: string;
	kpiActiveSessions: string;
	kpiYourIpPrefix: string;
	kpiLocalIp: string;
	kpiRateLimits: string;
	kpiRateLimitsSub: string;
	incidentsTitle: string;
	incidentsSub: string;
	incidentsActiveSuffix: string;
	colStatus: string;
	colSeverity: string;
	colIncidentTitle: string;
	colSourceIp: string;
	colService: string;
	colCreatedAt: string;
	colActions: string;
	inspectAndTriage: string;
	noIncidentsTitle: string;
	noIncidentsDesc: string;
	killTitle: string;
	killSub: string;
	killShieldActive: string;
	killNormal: string;
	killRegTitle: string;
	killRegDesc: string;
	killUploadTitle: string;
	killUploadDesc: string;
	killPasskeyTitle: string;
	killPasskeyDesc: string;
	killState503On: string;
	killState403On: string;
	killStateOff: string;
	ingressTitle: string;
	ingressSub: string;
	ingressBadgeBridge: string;
	ingressBadgeReal: string;
	ingressEnv: string;
	ingressEdge: string;
	ingressClientIp: string;
	ingressSelfLockout: string;
	ingressBridgeProtected: string;
	ingressDirectResolution: string;
	ingressRecommendationLabel: string;
	ingressBridgeRecText: string;
}

export const RADAR_MAIN_I18N: Record<Language, RadarMainCopy> = {
	en: {
		kpiQuarantinedIps: 'Quarantined IPs',
		kpiWhitelistedSuffix: 'whitelisted trusted IPs',
		kpiSecEvents24h: 'Security Events (24h)',
		kpiSecEventsSub: 'WARN & ERROR level alerts',
		kpiAuth24h: 'Auth / Brute-Force (24h)',
		kpiAuthSub: 'Failed logins & 2FA challenges',
		kpiWafTitle: 'WAF / Honeypot / CSRF',
		kpiWafSub: 'Blocked exploit & decoy probes',
		kpiSessionAnomalies: 'Session IP Anomalies',
		kpiSessionAnomaliesSub: 'Mid-session IP changes (24h)',
		kpiActiveSessions: 'Active Sessions',
		kpiYourIpPrefix: 'Your IP:',
		kpiLocalIp: 'local',
		kpiRateLimits: 'Rate Limit Throttles',
		kpiRateLimitsSub: 'In-memory throttled keys (Click to view)',
		incidentsTitle: 'Incident Management & Triage Kanban',
		incidentsSub: 'Active security incidents, analyst notes, and end-to-end containment lifecycle',
		incidentsActiveSuffix: 'ACTIVE',
		colStatus: 'Status',
		colSeverity: 'Severity',
		colIncidentTitle: 'Incident Title',
		colSourceIp: 'Source IP',
		colService: 'Service',
		colCreatedAt: 'Created At',
		colActions: 'Actions',
		inspectAndTriage: 'Inspect & Triage',
		noIncidentsTitle: 'No Active Security Incidents',
		noIncidentsDesc:
			'All automated defense shields operational. No uncontained security breaches or intrusion alerts recorded.',
		killTitle: 'Emergency Kill-Switches (Surface Isolation)',
		killSub: 'Instant critical API surface isolation during active zero-day or credential-stuffing campaigns',
		killShieldActive: 'SHIELD ACTIVE',
		killNormal: 'NORMAL',
		killRegTitle: 'Stop Registrations',
		killRegDesc: 'Blocks all POST /api/auth/register and OTP calls with 503 Service Unavailable.',
		killUploadTitle: 'Stop File Uploads',
		killUploadDesc: 'Suspends POST /api/upload to prevent webshells or multipart payload exploits.',
		killPasskeyTitle: 'Passkey-Only Mode',
		killPasskeyDesc: 'Shuts down password logins (403); only hardware Passkey / Biometrics allowed.',
		killState503On: 'ACTIVE (503)',
		killState403On: 'ACTIVE (403)',
		killStateOff: 'OFF',
		ingressTitle: 'Docker Container & Edge Ingress Diagnostics',
		ingressSub: 'Client IP resolution pipeline, proxy headers, and Docker bridge self-lockout guard',
		ingressBadgeBridge: 'BRIDGE IP PROTECTED',
		ingressBadgeReal: 'REAL IP DETECTED',
		ingressEnv: 'Environment',
		ingressEdge: 'Detected Ingress',
		ingressClientIp: 'Resolved Client IP',
		ingressSelfLockout: 'Self-Lockout Shield',
		ingressBridgeProtected: 'Bridge / Local IP Protected',
		ingressDirectResolution: 'Direct & Secure Resolution',
		ingressRecommendationLabel: 'Recommendation:',
		ingressBridgeRecText:
			'Docker bridge / RFC1918 network detected. Reverse proxy must forward X-Forwarded-For headers.',
	},
	tr: {
		kpiQuarantinedIps: 'Karantinadaki IP',
		kpiWhitelistedSuffix: 'güvenilir (whitelist) IP',
		kpiSecEvents24h: 'Güvenlik Olayı (24s)',
		kpiSecEventsSub: 'WARN ve ERROR seviyesi alarmlar',
		kpiAuth24h: 'Kimlik & Brute-Force (24s)',
		kpiAuthSub: 'Başarısız giriş ve 2FA denemeleri',
		kpiWafTitle: 'WAF / Honeypot / CSRF',
		kpiWafSub: 'Engellenen exploit ve tuzak istekleri',
		kpiSessionAnomalies: 'Oturum IP Anomalisi',
		kpiSessionAnomaliesSub: 'Oturum içi IP değişim şüphesi (24s)',
		kpiActiveSessions: 'Aktif Oturumlar',
		kpiYourIpPrefix: 'Sizin IP:',
		kpiLocalIp: 'yerel',
		kpiRateLimits: 'Hız Sınırı Kısıtlamaları',
		kpiRateLimitsSub: 'Aktif bellek-içi limit sayaçları (Görüntüle)',
		incidentsTitle: 'Güvenlik Olayı Yönetimi ve Triyaj Masası',
		incidentsSub: 'Aktif güvenlik olayları, analist adli notları ve uçtan uca tehdit tecrit yaşam döngüsü',
		incidentsActiveSuffix: 'AKTİF',
		colStatus: 'Durum',
		colSeverity: 'Önem',
		colIncidentTitle: 'Olay Başlığı',
		colSourceIp: 'Kaynak IP',
		colService: 'Servis',
		colCreatedAt: 'Oluşturulma',
		colActions: 'Müdahale',
		inspectAndTriage: 'İncele & Triyaj',
		noIncidentsTitle: 'Aktif Tehdit Olayı Bulunmuyor',
		noIncidentsDesc:
			'Siber savunma kalkanları devrede. Sistemde müdahale bekleyen açık ihlal veya saldırı olayı bulunmuyor.',
		killTitle: 'Acil Durum Saldırı İzolasyon Anahtarları (Kill-Switches)',
		killSub:
			'Aktif saldırı veya sızıntı anında kritik saldırı yüzeylerini anında izole edin (Veritabanında kalıcıdır)',
		killShieldActive: 'KORUMA DEVREDE',
		killNormal: 'STANDART',
		killRegTitle: 'Yeni Kayıtları Durdur',
		killRegDesc: 'Tüm üye olma ve OTP doğrulama akışlarını 503 hatasıyla derhal askıya alır.',
		killUploadTitle: 'Dosya Yüklemelerini Durdur',
		killUploadDesc: 'Olası webshell ve multipart sızıntılarına karşı tüm yükleme API isteklerini durdurur.',
		killPasskeyTitle: 'Yalnızca Passkey / Biyometrik',
		killPasskeyDesc: 'Parola ile girişleri reddeder (403); yalnızca FIDO2 / Biyometrik Passkey ile girişe izin verir.',
		killState503On: 'DEVREDE (503)',
		killState403On: 'DEVREDE (403)',
		killStateOff: 'KAPALI',
		ingressTitle: 'Docker Konteyner & Ingress Ağ Teşhisi',
		ingressSub: 'Ters vekil (Reverse Proxy) IP çözümlemesi ve Docker köprü ağı self-lockout koruması',
		ingressBadgeBridge: 'DOCKER KÖPRÜ KORUMASI',
		ingressBadgeReal: 'GERÇEK İSTEMCİ IP',
		ingressEnv: 'Çalışma Ortamı',
		ingressEdge: 'Kenar Ağ (Edge Proxy)',
		ingressClientIp: 'Çözümlenen İstemci IP',
		ingressSelfLockout: 'Kendi Kendini Kilitlememe',
		ingressBridgeProtected: 'Köprü / Yerel IP Asla Banlanmaz',
		ingressDirectResolution: 'Güvenli ve Doğrudan Çözümlendi',
		ingressRecommendationLabel: 'Öneri:',
		ingressBridgeRecText:
			'Docker Köprü / RFC1918 ağı algılandı. Ters vekil (Reverse Proxy) X-Forwarded-For başlıklarını iletmelidir.',
	},
};
