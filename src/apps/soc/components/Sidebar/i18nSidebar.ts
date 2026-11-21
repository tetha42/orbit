import type { Language } from '@/lib/i18n';

export interface SidebarCopy {
	navAriaLabel: string;
	brandSubtitle: string;
	groupOperations: string;
	navRadar: string;
	navFirewall: string;
	navSessions: string;
	groupForensics: string;
	navSiem: string;
	navInspection: string;
	navAudit: string;
	groupLab: string;
	navFuzzer: string;
	navOAuth: string;
	navApi: string;
	navHealth: string;
	navSessionInspector: string;
	resetDefconTitle: string;
	resetLabel: string;
	lockdownActiveTitle: string;
	lockdownIdleTitle: string;
	lockdownOnLabel: string;
	lockdownOffLabel: string;
	webhookTitle: string;
}

export const SIDEBAR_I18N: Record<Language, SidebarCopy> = {
	en: {
		navAriaLabel: 'SoC Studio Navigation',
		brandSubtitle: 'Cyber Defense & Lab',
		groupOperations: 'Operations & Defense',
		navRadar: 'Live Threat Radar',
		navFirewall: 'Firewall & Rules',
		navSessions: 'Active Sessions',
		groupForensics: 'Forensics & Audit',
		navSiem: 'SIEM Forensics',
		navInspection: 'Blue Team Inspection',
		navAudit: 'Change History',
		groupLab: 'Test Lab & Diagnostics',
		navFuzzer: 'WAF & Red Team Fuzzer',
		navOAuth: 'OAuth 2.0 Simulator',
		navApi: 'API Security Suite',
		navHealth: 'System Diagnostics',
		navSessionInspector: 'Session Inspector',
		resetDefconTitle: 'Acknowledge alerts and restore DEFCON 5',
		resetLabel: 'Reset',
		lockdownActiveTitle: 'Lockdown Active: Click to Lift',
		lockdownIdleTitle: 'Emergency Lockdown: Suspend signups & double IPS strike rate',
		lockdownOnLabel: 'Lockdown ON',
		lockdownOffLabel: 'Lockdown',
		webhookTitle: 'Configure External Webhooks (Discord / Telegram)',
	},
	tr: {
		navAriaLabel: 'SoC Studio Gezinme',
		brandSubtitle: 'Siber Savunma & Test',
		groupOperations: 'Operasyon & Savunma',
		navRadar: 'Canlı Tehdit Radarı',
		navFirewall: 'Güvenlik Duvarı',
		navSessions: 'Aktif Oturumlar',
		groupForensics: 'Adli Analiz & Denetim',
		navSiem: 'SIEM Forensics',
		navInspection: 'Mavi Takım Teftiş',
		navAudit: 'Değişiklik Geçmişi',
		groupLab: 'Test Laboratuvarı',
		navFuzzer: 'WAF & Red Team Testi',
		navOAuth: 'OAuth 2.0 Simülatörü',
		navApi: 'API Test Paketi',
		navHealth: 'Sistem Teşhisleri',
		navSessionInspector: 'Oturum Röntgeni',
		resetDefconTitle: 'Alarmları onayla ve DEFCON 5 yap',
		resetLabel: 'Sıfırla',
		lockdownActiveTitle: 'Kalkan Aktif: Kaldırmak için tıklayın',
		lockdownIdleTitle: 'Acil Durum Kalkanı: Kayıtları durdur ve IPS puanını 2x yap',
		lockdownOnLabel: 'Kalkan Aktif',
		lockdownOffLabel: 'Kalkan',
		webhookTitle: 'Dış Güvenlik Webhook Bildirimleri',
	},
};
